#!/usr/bin/env python3
"""Orchestrates headless QEMU nrmaOS boot, one-time RDP credential provisioning,
Tailscale Serve raw TCP forwarding verification, and privacy-safe credential delivery.

Security invariants:
- One-time random passwords are generated with CSPRNG (`secrets.SystemRandom`) per run.
- Passwords NEVER touch kernel cmdline, process argv, GITHUB_ENV, logs, or plaintext artifacts.
- Passwords enter the QEMU guest solely via `stdin` over a mode-0600 host UNIX socket connected
  to VirtIO serial port `org.nrmaos.qatest` -> `/usr/bin/nrma-rdpctl set-user-password nrma`.
- QEMU host port forwarding binds strictly to `127.0.0.1:<port>` (never `0.0.0.0`).
- Guest UFW remains active (`deny incoming`) and permits TCP 3389 only from QEMU gateway `10.0.2.2/32`.
- Public repositories require an `age` public recipient (`NRMAOS_AGE_RECIPIENT`) and emit only
  armored `age` ciphertext; missing encryption configuration fails closed before credential creation.
"""

from __future__ import annotations

import argparse
from datetime import datetime, timedelta, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import signal
import socket
import ssl
import string
import subprocess
import sys
import tempfile
import time

# Standard 19-byte RDP X.224 Connection Request PDU requesting PROTOCOL_SSL (0x00000001)
RDP_X224_TLS_REQUEST = bytes.fromhex("030000130ee000000000000100080001000000")

AGE_RECIPIENT_PATTERNS = [
    re.compile(r"^age1[0-9a-z]{58}$"),
    re.compile(r"^ssh-ed25519\s+[A-Za-z0-9+/=]+(?:\s+.*)?$"),
    re.compile(r"^ssh-rsa\s+[A-Za-z0-9+/=]+(?:\s+.*)?$"),
]


class BootstrapError(RuntimeError):
    """Raised when a mandatory verification or security gate fails."""


def gh_error(title: str, message: str) -> None:
    """Emit a GitHub Actions error annotation (visible without raw log access)."""
    if os.environ.get("GITHUB_ACTIONS") != "true":
        return
    esc = message[-12000:].replace("%", "%25").replace("\r", "%0D").replace("\n", "%0A")
    esc_title = title.replace("%", "%25").replace("\n", " ").replace(",", "%2C").replace("::", ": ")
    print(f"::error title={esc_title}::{esc}", flush=True)


def collect_guest_diagnostics(guest: "QemuVirtioClient") -> str:
    """Collect non-secret guest diagnostics (service state, xrdp logs, firewall) for failures."""
    script = (
        "echo '--- systemctl xrdp ---'; systemctl --no-pager --lines=0 status xrdp xrdp-sesman 2>&1 | head -n 20; "
        "echo '--- ss -tln ---'; ss -tln 2>&1; "
        "echo '--- ufw ---'; ufw status verbose 2>&1; "
        "echo '--- xrdp.log ---'; tail -n 25 /var/log/xrdp.log 2>&1; "
        "echo '--- xrdp-sesman.log ---'; tail -n 25 /var/log/xrdp-sesman.log 2>&1; "
        "echo '--- journal xrdp ---'; journalctl --no-pager -n 20 -u xrdp -u xrdp-sesman 2>&1"
    )
    try:
        res = guest.exec_cmd(["sh", "-c", script], timeout=20.0)
        return (res.get("stdout", "") + res.get("stderr", ""))[-6000:]
    except Exception as exc:  # pragma: no cover - diagnostics only
        return f"(guest diagnostics unavailable: {exc})"


class QemuVirtioClient:
    """Communicates with guest `/usr/lib/nrmaos/nrmaos-qa-agent.py` over a private UNIX socket."""

    def __init__(self, sock_path: Path):
        self.sock_path = str(sock_path)
        self._seq = 0

    def request(self, payload: dict, timeout: float = 20.0) -> dict:
        self._seq += 1
        req_id = f"rdp-{self._seq}"
        msg = dict(payload)
        msg["id"] = req_id
        raw = (json.dumps(msg) + "\n").encode("utf-8")

        deadline = time.monotonic() + timeout
        last_err: Exception | None = None
        while time.monotonic() < deadline:
            try:
                with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as s:
                    s.settimeout(max(1.0, deadline - time.monotonic()))
                    s.connect(self.sock_path)
                    s.sendall(raw)
                    buf = b""
                    while time.monotonic() < deadline:
                        chunk = s.recv(4096)
                        if not chunk:
                            break
                        buf += chunk
                        while b"\n" in buf:
                            line, buf = buf.split(b"\n", 1)
                            line_str = line.decode("utf-8", errors="replace").strip()
                            if not line_str:
                                continue
                            resp = json.loads(line_str)
                            if resp.get("id") in (req_id, ""):
                                return resp
            except Exception as exc:
                last_err = exc
                time.sleep(0.4)
        raise TimeoutError(f"Guest VirtIO request '{payload.get('action')}' timed out: {last_err}")

    def exec_cmd(
        self,
        cmd: list[str],
        *,
        user: str | None = None,
        env: dict | None = None,
        stdin: str | None = None,
        timeout: float = 30.0,
    ) -> dict:
        req: dict = {
            "action": "exec",
            "cmd": cmd,
            "user": user,
            "env": env or {},
            "timeout": timeout,
        }
        if stdin is not None:
            req["stdin"] = stdin
        return self.request(req, timeout=timeout + 10.0)


def generate_strong_password(length: int = 24) -> str:
    if length < 16:
        raise ValueError("RDP password length must be at least 16 characters")
    rng = secrets.SystemRandom()
    upper = string.ascii_uppercase
    lower = string.ascii_lowercase
    digits = string.digits
    symbols = "!@#%^&*-_=+?"
    all_chars = upper + lower + digits + symbols

    chars = [
        rng.choice(upper),
        rng.choice(upper),
        rng.choice(lower),
        rng.choice(lower),
        rng.choice(digits),
        rng.choice(digits),
        rng.choice(symbols),
        rng.choice(symbols),
    ]
    while len(chars) < length:
        chars.append(rng.choice(all_chars))
    rng.shuffle(chars)
    return "".join(chars)


def is_valid_age_recipient(recipient: str) -> bool:
    cleaned = recipient.strip()
    if not cleaned or "\n" in cleaned or "\r" in cleaned:
        return False
    return any(pat.match(cleaned) for pat in AGE_RECIPIENT_PATTERNS)


def encrypt_with_age(plaintext: str, recipient: str) -> str:
    cleaned_recipient = recipient.strip()
    if not is_valid_age_recipient(cleaned_recipient):
        raise BootstrapError(
            "Invalid NRMAOS_AGE_RECIPIENT format. Expected an 'age1...' public key "
            "(generated with `age-keygen`) or an 'ssh-ed25519' / 'ssh-rsa' public key."
        )
    age_bin = shutil.which("age")
    if not age_bin:
        raise BootstrapError("The 'age' encryption CLI is not installed on this host.")

    proc = subprocess.run(
        [age_bin, "--armor", "--recipient", cleaned_recipient],
        input=plaintext.encode("utf-8"),
        capture_output=True,
        timeout=15,
    )
    if proc.returncode != 0:
        err = proc.stderr.decode("utf-8", errors="replace").strip()
        raise BootstrapError(f"age encryption failed: {err}")

    armored = proc.stdout.decode("utf-8", errors="replace")
    if "-----BEGIN AGE ENCRYPTED FILE-----" not in armored:
        raise BootstrapError("age did not produce a valid armored ciphertext block.")
    return armored


def validate_credential_delivery_config(repo_visibility: str, age_recipient: str) -> str:
    """Returns delivery mode ('age' or 'private-summary') or raises BootstrapError."""
    vis = repo_visibility.strip().lower()
    if vis not in ("public", "private"):
        raise BootstrapError(f"Unsupported --repo-visibility '{repo_visibility}' (expected 'public' or 'private').")

    has_recipient = bool(age_recipient.strip())
    if has_recipient:
        if not is_valid_age_recipient(age_recipient):
            raise BootstrapError(
                "Configured NRMAOS_AGE_RECIPIENT is malformed.\n"
                "Generate a keypair locally with:\n"
                "  age-keygen -o nrmaos-rdp-key.txt\n"
                "Then copy ONLY the 'age1...' public key line into GitHub Repository Variables -> NRMAOS_AGE_RECIPIENT."
            )
        if shutil.which("age"):
            encrypt_with_age("nrmaos-preflight-check\n", age_recipient)
        return "age"

    if vis == "public":
        raise BootstrapError(
            "Refusing to run on a PUBLIC repository without encrypted credential delivery.\n\n"
            "To receive your one-time nrmaOS RDP password safely without exposing it in public logs or artifacts:\n"
            "  1. On your computer or Termux, generate a private key (keep this file local, NEVER upload it):\n"
            "       age-keygen -o nrmaos-rdp-key.txt\n"
            "  2. Copy the printed public key (starts with 'age1...').\n"
            "  3. In your GitHub repository, open:\n"
            "       Settings -> Secrets and variables -> Actions -> Variables -> New repository variable\n"
            "     Name : NRMAOS_AGE_RECIPIENT\n"
            "     Value: age1...\n"
            "  4. Re-run 'nrmaOS Remote Desktop'. See docs/tailscale-rdp.md for step-by-step instructions."
        )

    return "private-summary"


def normalize_fingerprint(fp: str) -> str:
    hex_only = re.sub(r"[^0-9A-Fa-f]", "", fp).upper()
    if len(hex_only) != 64:
        return fp.strip().upper()
    return ":".join(hex_only[i : i + 2] for i in range(0, 64, 2))


def probe_rdp_tls_fingerprint(host: str, port: int, timeout: float = 8.0) -> str:
    """Performs an authentic RDP X.224 Connection Request (PROTOCOL_SSL) followed by a
    TLSv1.2/1.3 handshake and returns the peer X.509 certificate SHA-256 fingerprint."""
    with socket.create_connection((host, port), timeout=timeout) as raw_sock:
        raw_sock.settimeout(timeout)
        raw_sock.sendall(RDP_X224_TLS_REQUEST)
        resp = b""
        while len(resp) < 11:
            chunk = raw_sock.recv(64)
            if not chunk:
                break
            resp += chunk
        if len(resp) < 11 or resp[0] != 0x03 or resp[5] != 0xD0:
            raise BootstrapError(
                f"RDP X.224 Connection Confirm not received from {host}:{port} (got {resp.hex()!r})"
            )
        if len(resp) >= 19:
            # Verify server selected PROTOCOL_SSL (bit 0x01)
            selected_proto = int.from_bytes(resp[15:19], "little")
            if not (selected_proto & 0x01):
                raise BootstrapError(
                    f"RDP server at {host}:{port} did not negotiate TLS (protocol={selected_proto})"
                )

        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
        ctx.minimum_version = ssl.TLSVersion.TLSv1_2
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        with ctx.wrap_socket(raw_sock, server_hostname=host) as tls_sock:
            der_cert = tls_sock.getpeercert(binary_form=True)
            if not der_cert:
                raise BootstrapError(f"No TLS peer certificate presented by {host}:{port}")
            digest = hashlib.sha256(der_cert).hexdigest().upper()
            return ":".join(digest[i : i + 2] for i in range(0, 64, 2))


def verify_host_ports_not_public(host_forward_port: int, rdp_port: int = 3389) -> None:
    """Verifies via `ss -tln` that QEMU's forwarded port binds strictly to 127.0.0.1
    and neither `host_forward_port` nor `rdp_port` is listening on wildcard public addresses."""
    ss_bin = shutil.which("ss")
    if not ss_bin:
        return
    proc = subprocess.run([ss_bin, "-tlnH"], capture_output=True, text=True, check=False)
    if proc.returncode != 0:
        return

    found_loopback_fwd = False
    for line in proc.stdout.splitlines():
        cols = line.split()
        if len(cols) < 4:
            continue
        local_addr = cols[3]
        if local_addr.endswith(f":{host_forward_port}"):
            host_part = local_addr.rsplit(":", 1)[0]
            if host_part in ("0.0.0.0", "*", "[::]", "::"):
                raise BootstrapError(
                    f"Unsafe wildcard bind detected on QEMU host forward port: {local_addr}"
                )
            if host_part == "127.0.0.1":
                found_loopback_fwd = True
        if local_addr in (f"0.0.0.0:{rdp_port}", f"*:{rdp_port}", f"[::]:{rdp_port}", f"::{rdp_port}"):
            raise BootstrapError(
                f"Unsafe public wildcard listener detected on RDP port {rdp_port}: {local_addr}"
            )

    if not found_loopback_fwd:
        raise BootstrapError(f"Expected loopback listener 127.0.0.1:{host_forward_port} was not found in `ss -tln`.")


def verify_tailscale_serve_config(serve_status_raw: str, expected_target: str, rdp_port: int = 3389) -> dict:
    """Validates `tailscale serve status --json` output: ensures raw TCP port 3389 forwards
    to `expected_target` and Tailscale Funnel is strictly disabled."""
    data = json.loads(serve_status_raw or "{}")
    if not isinstance(data, dict):
        raise BootstrapError("Unexpected `tailscale serve status --json` output structure.")

    # Ensure Funnel is NEVER enabled on any host/port
    allow_funnel = data.get("AllowFunnel") or {}
    if isinstance(allow_funnel, dict) and any(bool(v) for v in allow_funnel.values()):
        raise BootstrapError(
            f"SECURITY VIOLATION: Tailscale Funnel is enabled ({allow_funnel})! "
            "Public internet exposure of RDP is forbidden."
        )

    tcp_map = data.get("TCP") or {}
    port_entry = tcp_map.get(str(rdp_port)) or {}
    actual_forward = str(port_entry.get("TCPForward") or "")
    if actual_forward != expected_target:
        raise BootstrapError(
            f"Tailscale Serve TCP {rdp_port} forward mismatch: expected '{expected_target}', got '{actual_forward}'."
        )
    if port_entry.get("TerminateTLS"):
        raise BootstrapError(
            "Tailscale Serve must use raw TCP forwarding (--tcp), not TLS-terminated TCP, "
            "so xrdp's end-to-end TLS handshake remains intact."
        )
    return data


def run_tailscale_cmd(args: list[str], timeout: float = 20.0) -> subprocess.CompletedProcess:
    ts_bin = shutil.which("tailscale") or "/usr/local/bin/tailscale"
    cmd = [ts_bin, *args]
    if os.geteuid() != 0 and shutil.which("sudo"):
        cmd = ["sudo", "-n", *cmd]
    return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)


def configure_and_verify_tailscale_serve(host_forward_port: int, rdp_port: int = 3389) -> dict:
    st_proc = run_tailscale_cmd(["status", "--json"])
    if st_proc.returncode != 0:
        raise BootstrapError(f"`tailscale status --json` failed: {st_proc.stderr.strip()}")

    st = json.loads(st_proc.stdout)
    backend_state = str(st.get("BackendState") or "")
    if backend_state != "Running":
        raise BootstrapError(f"Tailscale is not connected (BackendState={backend_state!r}).")

    ip4_proc = run_tailscale_cmd(["ip", "-4"])
    ts_ipv4 = ip4_proc.stdout.strip().splitlines()[0].strip() if ip4_proc.returncode == 0 and ip4_proc.stdout.strip() else ""
    if not ts_ipv4:
        self_ips = (st.get("Self") or {}).get("TailscaleIPs") or []
        ts_ipv4 = next((str(ip) for ip in self_ips if ":" not in str(ip)), "")
    if not ts_ipv4:
        raise BootstrapError("Tailscale connected, but no Tailnet IPv4 address was assigned.")

    self_node = st.get("Self") or {}
    tailnet_info = st.get("CurrentTailnet") or {}
    device_name = str(self_node.get("HostName") or socket.gethostname() or "nrmaos-rdp")
    raw_dns = str(self_node.get("DNSName") or "").rstrip(".")
    magic_enabled = bool(tailnet_info.get("MagicDNSEnabled", bool(raw_dns)))
    magic_dns = raw_dns if (magic_enabled and raw_dns) else ""

    target = f"127.0.0.1:{host_forward_port}"
    serve_proc = run_tailscale_cmd(
        ["serve", "--bg", "--yes", f"--tcp={rdp_port}", f"tcp://{target}"],
        timeout=25.0,
    )
    if serve_proc.returncode != 0:
        raise BootstrapError(
            f"`tailscale serve --bg --yes --tcp={rdp_port} tcp://{target}` failed:\n"
            f"{serve_proc.stdout}\n{serve_proc.stderr}"
        )

    verify_proc = run_tailscale_cmd(["serve", "status", "--json"])
    if verify_proc.returncode != 0:
        raise BootstrapError(f"`tailscale serve status --json` failed: {verify_proc.stderr.strip()}")

    verify_tailscale_serve_config(verify_proc.stdout, expected_target=target, rdp_port=rdp_port)
    verify_host_ports_not_public(host_forward_port=host_forward_port, rdp_port=rdp_port)

    return {
        "device_name": device_name,
        "tailscale_ipv4": ts_ipv4,
        "magic_dns_name": magic_dns,
        "rdp_address": f"{ts_ipv4}:{rdp_port}",
        "magic_dns_rdp_address": f"{magic_dns}:{rdp_port}" if magic_dns else "",
        "rdp_port": rdp_port,
    }


def build_credential_bundle_text(meta: dict, password: str) -> str:
    lines = [
        "============================================================",
        "nrmaOS One-Time Tailscale Remote Desktop Credentials",
        "============================================================",
        f"Status              : ONLINE",
        f"OS                  : {meta['os_name']}",
        f"Tailscale Device    : {meta['device_name']}",
        f"Tailscale IPv4      : {meta['tailscale_ipv4']}",
        f"MagicDNS Hostname   : {meta['magic_dns_name'] or 'Unavailable'}",
        f"RDP Address (IPv4)  : {meta['rdp_address']}",
    ]
    if meta.get("magic_dns_rdp_address"):
        lines.append(f"RDP Address (DNS)   : {meta['magic_dns_rdp_address']}")
    lines.extend(
        [
            f"RDP Port            : {meta['rdp_port']}",
            f"RDP Username        : {meta['username']}",
            f"RDP Password        : {password}",
            f"TLS Cert SHA-256    : {meta['tls_fingerprint_sha256']}",
            f"Session Expires At  : {meta['expires_at_utc']} (max {meta['max_minutes']} min)",
            "============================================================",
        ]
    )
    return "\n".join(lines) + "\n"


def build_job_summary_markdown(
    meta: dict,
    *,
    delivery_mode: str,
    private_password: str | None = None,
    artifact_name: str = "",
) -> str:
    magic_row = (
        f"| **MagicDNS Hostname** | `{meta['magic_dns_name']}` (`{meta['magic_dns_rdp_address']}`) |\n"
        if meta.get("magic_dns_name")
        else "| **MagicDNS Hostname** | _Not enabled on this Tailnet_ |\n"
    )

    md = [
        "## nrmaOS Remote Desktop — `ONLINE`",
        "",
        "| Field | Value |",
        "|---|---|",
        "| **Status** | **ONLINE** |",
        f"| **OS** | `{meta['os_name']}` |",
        f"| **Tailscale Device Name** | `{meta['device_name']}` |",
        f"| **Tailscale IPv4** | `{meta['tailscale_ipv4']}` |",
        magic_row.rstrip("\n"),
        f"| **RDP Address** | `{meta['rdp_address']}` |",
        f"| **RDP Port** | `{meta['rdp_port']}` |",
        f"| **RDP Username** | `{meta['username']}` |",
        f"| **TLS Certificate SHA-256** | `{meta['tls_fingerprint_sha256']}` |",
        f"| **Max Session Runtime** | Up to `{meta['max_minutes']}` minutes (until `{meta['expires_at_utc']}` or manual cancel) |",
        f"| **QEMU Virtualization** | `{meta['qemu_accel']}` (`{meta['cpus']}` vCPUs, `{meta['memory_mib']}` MiB RAM) |",
        "",
    ]

    if delivery_mode == "age":
        art_label = artifact_name or "nrmaos-rdp-credentials"
        md.extend(
            [
                "### One-Time Password (Encrypted with `age`)",
                "",
                "To protect your session on a public repository, the freshly generated RDP password is **never** written to logs or this summary.",
                "",
                f"1. Scroll to the **Artifacts** section of this workflow run and download **`{art_label}`**.",
                "2. Decrypt it locally using your private key (which stays on your own device):",
                "```bash",
                f"./scripts/decrypt-rdp-credentials.sh ~/Downloads/{art_label}.zip ~/nrmaos-rdp-key.txt",
                "# Or directly with age:",
                "age --decrypt -i ~/nrmaos-rdp-key.txt nrmaos-rdp-credentials.age.txt",
                "```",
                "",
            ]
        )
    elif delivery_mode == "private-summary" and private_password is not None:
        md.extend(
            [
                "### One-Time Password (Private Repository Summary)",
                "",
                "> **Security Warning:** This repository is private, so the one-time password is provided in this authenticated workflow summary (and is never printed in step logs). **Any repository collaborator with GitHub Actions read access can view this summary** while the run record exists. Configure `NRMAOS_AGE_RECIPIENT` if you prefer end-to-end `age` encryption even in a private repository.",
                "",
                "<details>",
                "<summary>Click to reveal one-time RDP password</summary>",
                "",
                "```text",
                f"Username: {meta['username']}",
                f"Password: {private_password}",
                "```",
                "</details>",
                "",
            ]
        )

    md.extend(
        [
            "### Connect from Your Device",
            "",
            f"- **Android**: Turn **Tailscale** ON -> Open **Windows App (Microsoft Remote Desktop)** or **aFreeRDP** -> Add PC **`{meta['rdp_address']}`** -> Enter username **`{meta['username']}`** and your one-time password -> Verify TLS SHA-256 fingerprint.",
            f"- **Windows**: Ensure **Tailscale** is Connected -> Open **Remote Desktop Connection (`mstsc.exe`)** -> Computer: **`{meta['rdp_address']}`** -> Username: **`{meta['username']}`**.",
            "- **Terminate Early**: Click **Cancel workflow** at the top right of this GitHub Actions page to immediately shut down QEMU, reset Tailscale Serve, and wipe temporary state.",
            "",
        ]
    )
    return "\n".join(md)


def secure_wipe_path(path: Path) -> None:
    try:
        if path.is_symlink() or not path.exists():
            path.unlink(missing_ok=True)
            return
        if path.is_file():
            size = path.stat().st_size
            if 0 < size <= 16 * 1024 * 1024:
                with path.open("r+b") as f:
                    f.write(b"\x00" * size)
                    f.flush()
            path.unlink(missing_ok=True)
        elif path.is_dir():
            for child in list(path.iterdir()):
                secure_wipe_path(child)
            path.rmdir()
    except Exception:
        shutil.rmtree(path, ignore_errors=True)


def _reap_if_child(pid: int) -> None:
    try:
        os.waitpid(pid, os.WNOHANG)
    except ChildProcessError:
        pass
    except OSError:
        pass


def pid_alive(pid: int) -> bool:
    """True when `pid` exists and is not a zombie (reaps it when it is our own child)."""
    if pid <= 1:
        return False
    _reap_if_child(pid)
    try:
        os.kill(pid, 0)
    except OSError:
        return False
    try:
        stat = Path(f"/proc/{pid}/stat").read_text(encoding="utf-8", errors="replace")
        state = stat.rsplit(")", 1)[1].split()[0]
        if state in ("Z", "X"):
            return False
    except (OSError, IndexError):
        pass
    return True


def stop_qemu_pid(pid: int) -> None:
    if not pid_alive(pid):
        return
    try:
        os.kill(pid, signal.SIGTERM)
    except OSError:
        return
    deadline = time.monotonic() + 8.0
    while time.monotonic() < deadline:
        if not pid_alive(pid):
            return
        time.sleep(0.3)
    try:
        os.kill(pid, signal.SIGKILL)
    except OSError:
        return
    deadline = time.monotonic() + 5.0
    while time.monotonic() < deadline and pid_alive(pid):
        time.sleep(0.2)


def cmd_preflight(args: argparse.Namespace) -> int:
    age_recipient = args.age_recipient or os.environ.get("NRMAOS_AGE_RECIPIENT", "")
    mode = validate_credential_delivery_config(args.repo_visibility, age_recipient)

    if args.require_tailscale_secrets:
        has_oidc = os.environ.get("HAS_TS_OIDC") == "true"
        has_oauth = os.environ.get("HAS_TS_OAUTH") == "true"
        has_authkey = os.environ.get("HAS_TS_AUTHKEY") == "true"
        if not (has_oidc or has_oauth or has_authkey):
            raise BootstrapError(
                "No Tailscale credentials configured in GitHub Actions Secrets.\n\n"
                "Configure ONE of the following in Settings -> Secrets and variables -> Actions -> Secrets:\n"
                "  • Recommended (OAuth Client): TS_OAUTH_CLIENT_ID and TS_OAUTH_SECRET (with `auth_keys` write scope for tag:nrmaos-ci)\n"
                "  • Or Workload Identity (OIDC): TS_OAUTH_CLIENT_ID and TS_AUDIENCE\n"
                "  • Alternative (Auth Key)     : TAILSCALE_AUTHKEY (ephemeral, tagged with tag:nrmaos-ci)\n"
                "See docs/tailscale-rdp.md for step-by-step setup instructions."
            )

    print(f"Preflight OK: credential delivery mode='{mode}' (visibility={args.repo_visibility})")
    return 0


def detect_qemu_accel(allow_tcg_fallback: bool) -> tuple[str, list[str]]:
    if os.path.exists("/dev/kvm") and os.access("/dev/kvm", os.R_OK | os.W_OK):
        return "kvm", ["-enable-kvm", "-cpu", "host"]
    if allow_tcg_fallback:
        return "tcg", ["-accel", "tcg,tb-size=1024", "-cpu", "max"]
    raise BootstrapError(
        "Hardware virtualization (/dev/kvm) is unavailable on this runner and TCG fallback is disabled."
    )


def boot_and_bootstrap_session(args: argparse.Namespace) -> tuple[dict, QemuVirtioClient, int]:
    iso_path = Path(args.iso).resolve()
    if not iso_path.is_file() or iso_path.stat().st_size == 0:
        raise BootstrapError(f"nrmaOS ISO not found or empty: {iso_path}")

    qemu_bin = shutil.which("qemu-system-x86_64")
    if not qemu_bin:
        raise BootstrapError("qemu-system-x86_64 is not installed.")

    age_recipient = args.age_recipient or os.environ.get("NRMAOS_AGE_RECIPIENT", "")
    delivery_mode = validate_credential_delivery_config(args.repo_visibility, age_recipient)

    state_dir = Path(args.state_dir).resolve()
    state_dir.mkdir(parents=True, exist_ok=True)
    os.chmod(state_dir, 0o700)

    qa_sock = state_dir / "qa.sock"
    serial_log = state_dir / "qemu-serial.log"
    pid_file = state_dir / "qemu.pid"
    for f in (qa_sock, serial_log, pid_file):
        f.unlink(missing_ok=True)

    accel_name, accel_flags = detect_qemu_accel(args.allow_tcg_fallback)
    host_cpus = os.cpu_count() or 2
    cpus = max(1, min(int(args.cpus), host_cpus))
    memory_mib = max(1536, int(args.memory_mib))
    host_port = int(args.host_port)

    qemu_cmd = [
        qemu_bin,
        *accel_flags,
        "-m",
        str(memory_mib),
        "-smp",
        str(cpus),
        "-cdrom",
        str(iso_path),
        "-boot",
        "d",
        "-vga",
        "std",
        "-display",
        "none",
        "-no-reboot",
        "-serial",
        f"file:{serial_log}",
        "-chardev",
        f"socket,id=qachar,path={qa_sock},server=on,wait=off",
        "-device",
        "virtio-serial-pci",
        "-device",
        "virtserialport,chardev=qachar,name=org.nrmaos.qatest",
        "-netdev",
        f"user,id=net0,net=10.0.2.0/24,host=10.0.2.2,dhcpstart=10.0.2.15,hostfwd=tcp:127.0.0.1:{host_port}-:3389",
        "-device",
        "virtio-net-pci,netdev=net0",
    ]

    print(
        f"[1/6] Booting nrmaOS ISO ({iso_path.name}) in headless QEMU ({accel_name}, {cpus} vCPUs, {memory_mib} MiB RAM)...",
        flush=True,
    )
    # QEMU must outlive this `start` step, so its stderr goes to a private log file rather than a
    # pipe (a pipe would break with EPIPE/SIGPIPE once this orchestrator process exits).
    qemu_stderr_path = state_dir / "qemu-stderr.log"
    with qemu_stderr_path.open("wb") as qemu_stderr_fh:
        os.chmod(qemu_stderr_path, 0o600)
        qemu_proc = subprocess.Popen(
            qemu_cmd,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=qemu_stderr_fh,
            start_new_session=True,
        )
    pid_file.write_text(f"{qemu_proc.pid}\n", encoding="utf-8")
    os.chmod(pid_file, 0o600)

    # Restrict VirtIO host UNIX socket permissions as soon as QEMU creates it
    for _ in range(30):
        if qa_sock.exists():
            os.chmod(qa_sock, 0o600)
            break
        if qemu_proc.poll() is not None:
            err = qemu_stderr_path.read_text(encoding="utf-8", errors="replace")[-4000:]
            raise BootstrapError(f"QEMU exited immediately (rc={qemu_proc.returncode}): {err}")
        time.sleep(0.1)

    guest = QemuVirtioClient(qa_sock)

    try:
        # Wait for VirtIO guest agent readiness
        deadline = time.monotonic() + float(args.boot_timeout)
        booted = False
        while time.monotonic() < deadline:
            if qemu_proc.poll() is not None:
                raise BootstrapError(f"QEMU terminated unexpectedly during boot (rc={qemu_proc.returncode}).")
            try:
                pong = guest.request({"action": "ping"}, timeout=3.0)
                if pong.get("ok"):
                    booted = True
                    break
            except Exception:
                time.sleep(1.5)
        if not booted:
            raise BootstrapError("Timed out waiting for nrmaOS guest boot and VirtIO channel.")

        rel = guest.exec_cmd(["cat", "/etc/nrmaos-release"])
        if not rel.get("ok") or 'NRMAOS_NAME="nrmaOS"' not in rel.get("stdout", ""):
            raise BootstrapError("Booted guest is missing valid /etc/nrmaos-release branding.")

        print("[2/6] Waiting for genuine nrmaOS desktop shell (Xorg + openbox + nrmaos-shell)...", flush=True)
        shell_ready = False
        while time.monotonic() < deadline:
            chk = guest.exec_cmd(
                [
                    "sh",
                    "-c",
                    "pgrep -x Xorg >/dev/null && pgrep -x openbox >/dev/null && pgrep -x nrmaos-shell >/dev/null",
                ]
            )
            if chk.get("ok"):
                shell_ready = True
                break
            time.sleep(1.5)
        if not shell_ready:
            raise BootstrapError("nrmaOS graphical session (Xorg + openbox + nrmaos-shell) did not start in guest.")

        print("[3/6] Provisioning fresh one-time RDP credentials & enabling hardened xrdp...", flush=True)
        one_time_password = generate_strong_password(24)
        try:
            grant = guest.exec_cmd(["/usr/bin/nrma-rdpctl", "grant-user", "nrma"])
            if not grant.get("ok"):
                raise BootstrapError(f"Failed granting nrmaos-rdp membership to 'nrma': {grant.get('stderr')}")

            pw_res = guest.exec_cmd(
                ["/usr/bin/nrma-rdpctl", "set-user-password", "nrma"],
                stdin=f"{one_time_password}\n",
            )
            if not pw_res.get("ok"):
                raise BootstrapError(f"Failed setting one-time password via nrma-rdpctl: {pw_res.get('stderr')}")

            # Verify password never leaked onto kernel cmdline or guest logs
            cmdline_txt = guest.exec_cmd(["cat", "/proc/cmdline"]).get("stdout", "")
            if one_time_password in cmdline_txt:
                raise BootstrapError("SECURITY ERROR: credential detected in /proc/cmdline")

            en_res = guest.exec_cmd(
                [
                    "/usr/bin/nrma-rdpctl",
                    "enable",
                    "--port",
                    "3389",
                    "--firewall-mode",
                    "lan",
                    "--subnet",
                    "10.0.2.2/32",
                    "--resolution",
                    args.resolution,
                ],
                timeout=45.0,
            )
            if not en_res.get("ok"):
                raise BootstrapError(f"`nrma-rdpctl enable` failed: {en_res.get('stderr')}")

            rdp_status = json.loads(en_res["stdout"])
            # xrdp may need a moment after `systemctl restart` before binding TCP 3389
            for _ in range(40):
                if rdp_status.get("active") and rdp_status.get("sesman_active") and rdp_status.get("listening"):
                    break
                time.sleep(0.75)
                st_poll = guest.exec_cmd(["/usr/bin/nrma-rdpctl", "status", "--json"], timeout=20.0)
                if st_poll.get("ok"):
                    rdp_status = json.loads(st_poll["stdout"])
            if not (
                rdp_status.get("active")
                and rdp_status.get("sesman_active")
                and rdp_status.get("listening")
                and rdp_status.get("tls_configured")
                and rdp_status.get("root_login_blocked")
                and rdp_status.get("firewall_active")
                and "nrma" in (rdp_status.get("authorized_users") or [])
            ):
                raise BootstrapError(f"Guest RDP status failed security assertions: {rdp_status}")

            startwm_chk = guest.exec_cmd(["grep", "-q", "exec /usr/bin/nrmaos-session", "/etc/xrdp/startwm.sh"])
            if not startwm_chk.get("ok"):
                raise BootstrapError("/etc/xrdp/startwm.sh does not launch /usr/bin/nrmaos-session.")

            ufw_chk = guest.exec_cmd(["ufw", "status", "verbose"])
            ufw_out = ufw_chk.get("stdout", "")
            if (
                "Status: active" not in ufw_out
                or "deny (incoming)" not in ufw_out
                or "10.0.2.2" not in ufw_out
            ):
                raise BootstrapError(f"Guest UFW rules did not match strict 10.0.2.2/32 policy:\n{ufw_out}")

            guest_fp = normalize_fingerprint(str(rdp_status.get("tls_fingerprint_sha256") or ""))
            if not guest_fp:
                raise BootstrapError("Guest xrdp TLS SHA-256 fingerprint is empty.")

            print("[4/6] Verifying loopback-only host forward & end-to-end RDP TLS certificate...", flush=True)
            verify_host_ports_not_public(host_forward_port=host_port, rdp_port=3389)
            probed_fp = probe_rdp_tls_fingerprint("127.0.0.1", host_port, timeout=10.0)
            if probed_fp != guest_fp:
                raise BootstrapError(
                    f"TLS certificate fingerprint mismatch across QEMU forward! Guest={guest_fp}, HostProbe={probed_fp}"
                )

            if args.tailscale:
                print("[5/6] Configuring & verifying Tailscale Serve raw TCP forwarding...", flush=True)
                ts_meta = configure_and_verify_tailscale_serve(host_forward_port=host_port, rdp_port=3389)
                ts_probed_fp = probe_rdp_tls_fingerprint(ts_meta["tailscale_ipv4"], 3389, timeout=12.0)
                if ts_probed_fp != guest_fp:
                    raise BootstrapError(
                        f"TLS fingerprint mismatch over Tailscale IP {ts_meta['tailscale_ipv4']}:3389!"
                    )
            else:
                print("[5/6] Skipping host Tailscale Serve (local/QEMU-only mode)...", flush=True)
                ts_meta = {
                    "device_name": socket.gethostname() or "local-qemu-host",
                    "tailscale_ipv4": "127.0.0.1",
                    "magic_dns_name": "",
                    "rdp_address": f"127.0.0.1:{host_port}",
                    "magic_dns_rdp_address": "",
                    "rdp_port": host_port,
                }

            now_utc = datetime.now(timezone.utc)
            exp_utc = now_utc + timedelta(minutes=int(args.max_minutes))
            meta = {
                "status": "ONLINE",
                "os_name": "nrmaOS 0.1.0 (Atlas)",
                "username": "nrma",
                "device_name": ts_meta["device_name"],
                "tailscale_ipv4": ts_meta["tailscale_ipv4"],
                "magic_dns_name": ts_meta["magic_dns_name"],
                "rdp_address": ts_meta["rdp_address"],
                "magic_dns_rdp_address": ts_meta["magic_dns_rdp_address"],
                "rdp_port": ts_meta["rdp_port"],
                "host_forward_port": host_port,
                "tls_fingerprint_sha256": guest_fp,
                "started_at_utc": now_utc.strftime("%Y-%m-%d %H:%M:%S UTC"),
                "expires_at_utc": exp_utc.strftime("%Y-%m-%d %H:%M:%S UTC"),
                "max_minutes": int(args.max_minutes),
                "qemu_pid": qemu_proc.pid,
                "qemu_accel": accel_name,
                "cpus": cpus,
                "memory_mib": memory_mib,
                "delivery_mode": delivery_mode,
            }

            print("[6/6] Writing privacy-safe connection summary & credential bundle...", flush=True)
            if delivery_mode == "age":
                if not args.encrypted_out:
                    raise BootstrapError("--encrypted-out is required when using 'age' credential encryption.")
                bundle_plain = build_credential_bundle_text(meta, one_time_password)
                armored = encrypt_with_age(bundle_plain, age_recipient)
                bundle_plain = ""
                if one_time_password in armored:
                    raise BootstrapError("SECURITY ERROR: plaintext password detected in encrypted output!")
                enc_path = Path(args.encrypted_out).resolve()
                enc_path.parent.mkdir(parents=True, exist_ok=True)
                enc_path.write_text(armored, encoding="utf-8")
                os.chmod(enc_path, 0o600)

            if args.summary_file:
                summary_md = build_job_summary_markdown(
                    meta,
                    delivery_mode=delivery_mode,
                    private_password=(one_time_password if delivery_mode == "private-summary" else None),
                    artifact_name=args.artifact_name,
                )
                if delivery_mode != "private-summary" and one_time_password in summary_md:
                    raise BootstrapError("SECURITY ERROR: password leaked into public job summary!")
                with Path(args.summary_file).open("a", encoding="utf-8") as sf:
                    sf.write(summary_md + "\n")

            # Optional test-only callback hook (used only by local/CI FreeRDP self-test in memory)
            if getattr(args, "_selftest_password_sink", None) is not None:
                args._selftest_password_sink.append(one_time_password)
        finally:
            one_time_password = ""

        meta_path = state_dir / "session-meta.json"
        meta_path.write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")
        os.chmod(meta_path, 0o600)

        print(
            f"ONLINE: nrmaOS Remote Desktop ready at {meta['rdp_address']} "
            f"(user: {meta['username']}, TLS SHA-256: {meta['tls_fingerprint_sha256']})",
            flush=True,
        )
        return meta, guest, qemu_proc.pid
    except Exception as exc:
        diag = ""
        if qemu_proc.poll() is None:
            diag = collect_guest_diagnostics(guest)
        serial_tail = ""
        try:
            serial_tail = "\n".join(
                serial_log.read_text(encoding="utf-8", errors="replace").splitlines()[-25:]
            )
        except Exception:
            pass
        stop_qemu_pid(qemu_proc.pid)
        if isinstance(exc, BootstrapError):
            raise BootstrapError(
                f"{exc}\n--- guest diagnostics ---\n{diag}\n--- serial tail ---\n{serial_tail}"
            ) from exc
        raise


def cmd_start(args: argparse.Namespace) -> int:
    boot_and_bootstrap_session(args)
    return 0


def cmd_keepalive(args: argparse.Namespace) -> int:
    state_dir = Path(args.state_dir).resolve()
    pid_file = state_dir / "qemu.pid"
    qa_sock = state_dir / "qa.sock"
    if not pid_file.is_file():
        raise BootstrapError(f"Missing QEMU pid file in {state_dir}")

    qemu_pid = int(pid_file.read_text(encoding="utf-8").strip())
    guest = QemuVirtioClient(qa_sock)

    stop_requested = False

    def _on_sig(_signum: int, _frame: object) -> None:
        nonlocal stop_requested
        stop_requested = True

    signal.signal(signal.SIGTERM, _on_sig)
    signal.signal(signal.SIGINT, _on_sig)

    max_seconds = max(60, int(args.max_minutes) * 60)
    start_mono = time.monotonic()
    deadline = start_mono + max_seconds
    next_log = 0.0

    print(
        f"Keeping nrmaOS Remote Desktop session alive for up to {args.max_minutes} minutes "
        "(cancel workflow at any time to terminate immediately)...",
        flush=True,
    )

    while not stop_requested and time.monotonic() < deadline:
        if not pid_alive(qemu_pid):
            raise BootstrapError("QEMU VM process exited unexpectedly.")

        now = time.monotonic()
        if now >= next_log:
            remaining_min = max(0, int((deadline - now) // 60))
            active_sessions = 0
            try:
                st = guest.exec_cmd(["/usr/bin/nrma-rdpctl", "status", "--json"], timeout=10.0)
                if st.get("ok"):
                    parsed = json.loads(st["stdout"])
                    active_sessions = len(parsed.get("connected_sessions") or [])
                    if not parsed.get("active"):
                        raise BootstrapError("xrdp service stopped inside nrmaOS guest.")
            except BootstrapError:
                raise
            except Exception:
                pass
            print(
                f"[nrmaOS RDP ONLINE] Connected sessions: {active_sessions} | Remaining limit: ~{remaining_min} min",
                flush=True,
            )
            next_log = now + 60.0

        time.sleep(5.0)

    print("Session keepalive window ended; proceeding to cleanup.", flush=True)
    return 0


def cmd_cleanup(args: argparse.Namespace) -> int:
    state_dir = Path(args.state_dir).resolve()
    if args.reset_tailscale_serve:
        try:
            run_tailscale_cmd(["serve", "reset"], timeout=10.0)
        except Exception:
            pass

    pid_file = state_dir / "qemu.pid"
    qemu_pid = 0
    if pid_file.is_file():
        try:
            qemu_pid = int(pid_file.read_text(encoding="utf-8").strip())
            stop_qemu_pid(qemu_pid)
        except Exception:
            pass
    if qemu_pid and pid_alive(qemu_pid):
        raise BootstrapError(f"QEMU process {qemu_pid} is still running after SIGTERM/SIGKILL.")

    if state_dir.exists():
        secure_wipe_path(state_dir)

    if args.summary_file:
        try:
            with Path(args.summary_file).open("a", encoding="utf-8") as sf:
                sf.write(
                    "\n---\n**Session Terminated:** QEMU virtual machine stopped, Tailscale Serve reset, "
                    "and temporary runtime state wiped.\n"
                )
        except Exception:
            pass

    print("Cleanup complete: QEMU stopped and temporary runtime state removed.", flush=True)
    return 0


def cmd_selftest(args: argparse.Namespace) -> int:
    """End-to-end automated QEMU test of the bootstrap workflow:
    1. Generates temporary `age` keypair (when `age-keygen` is installed)
    2. Boots the ISO via `boot_and_bootstrap_session` (`repo_visibility='public'`)
    3. Verifies `.age` ciphertext decrypts via `decrypt-rdp-credentials.sh` to the exact password
    4. Verifies public summary contains zero plaintext secrets
    5. Connects a real FreeRDP client (`xfreerdp3`/`xfreerdp`) to `127.0.0.1:<port>`, verifies
       `/usr/bin/nrmaos-session` + remote `nrmaos-shell` spawns, disconnects, and RECONNECTS
       a second client verifying session persistence (`KillDisconnected=false`)
    6. Runs `cmd_cleanup` and asserts QEMU PID is gone and `state_dir` is wiped.
    """
    tmp_base = Path("/dev/shm") if Path("/dev/shm").is_dir() else Path(tempfile.gettempdir())
    work = Path(tempfile.mkdtemp(prefix="nrmaos-rdp-selftest-", dir=str(tmp_base)))
    state_dir = work / "state"
    summary_file = work / "summary.md"
    enc_file = work / "nrmaos-rdp-credentials.age.txt"
    key_file = work / "age-key.txt"

    try:
        age_keygen = shutil.which("age-keygen")
        if not age_keygen:
            raise BootstrapError("age-keygen is required for --selftest")
        kg = subprocess.run([age_keygen, "-o", str(key_file)], capture_output=True, text=True, check=True)
        os.chmod(key_file, 0o600)
        combined_kg = kg.stdout + "\n" + kg.stderr + "\n" + key_file.read_text(encoding="utf-8")
        m_pub = re.search(r"(age1[0-9a-z]{58})", combined_kg)
        if not m_pub:
            raise BootstrapError("Could not extract age1 public key from age-keygen")
        recipient = m_pub.group(1)

        pw_holder: list[str] = []
        ns = argparse.Namespace(
            iso=args.iso,
            state_dir=str(state_dir),
            host_port=args.host_port,
            repo_visibility="public",
            age_recipient=recipient,
            tailscale=False,
            encrypted_out=str(enc_file),
            summary_file=str(summary_file),
            artifact_name="nrmaos-rdp-credentials-test",
            max_minutes=30,
            cpus=args.cpus,
            memory_mib=args.memory_mib,
            resolution="1280x720",
            boot_timeout=args.boot_timeout,
            allow_tcg_fallback=True,
            _selftest_password_sink=pw_holder,
        )

        meta, guest, qemu_pid = boot_and_bootstrap_session(ns)
        password = pw_holder[0]

        # Verify summary has ZERO password leak
        summary_txt = summary_file.read_text(encoding="utf-8")
        assert password not in summary_txt, "Plaintext password leaked into public summary!"
        assert meta["tls_fingerprint_sha256"] in summary_txt

        # Verify local decryption helper roundtrip
        decrypt_helper = Path(__file__).resolve().parent / "decrypt-rdp-credentials.sh"
        dec = subprocess.run(
            [str(decrypt_helper), str(enc_file), str(key_file)],
            capture_output=True,
            text=True,
            check=True,
        )
        assert f"RDP Password        : {password}" in dec.stdout, "Decrypted bundle missing expected password"
        assert meta["tls_fingerprint_sha256"] in dec.stdout

        # Verify real FreeRDP client authentication + nrmaos-shell startup + session reconnection
        freerdp_bin = shutil.which("xfreerdp3") or shutil.which("xfreerdp")
        xvfb_run = shutil.which("xvfb-run")
        if not (freerdp_bin and xvfb_run):
            raise BootstrapError("xfreerdp3/xfreerdp and xvfb-run are required for --selftest")

        def launch_rdp_client() -> subprocess.Popen:
            return subprocess.Popen(
                [
                    xvfb_run,
                    "-a",
                    freerdp_bin,
                    f"/v:127.0.0.1:{args.host_port}",
                    "/u:nrma",
                    f"/p:{password}",
                    "/sec:tls",
                    "/size:1280x720",
                    "/cert:ignore",
                ],
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
            )

        def stop_client(proc: subprocess.Popen) -> str:
            proc.terminate()
            try:
                out, _ = proc.communicate(timeout=6)
            except Exception:
                proc.kill()
                try:
                    out, _ = proc.communicate(timeout=3)
                except Exception:
                    out = ""
            return (out or "").replace(password, "********")[-2500:]

        def fail_with_diagnostics(reason: str, client_out: str) -> None:
            raise BootstrapError(
                f"{reason}\n--- FreeRDP client output ---\n{client_out}\n"
                f"--- guest diagnostics ---\n{collect_guest_diagnostics(guest)}"
            )

        def guest_log_count(pattern: str, log_path: str) -> int:
            res = guest.exec_cmd(["grep", "-Eci", pattern, log_path])
            try:
                return int((res.get("stdout") or "0").strip() or "0")
            except ValueError:
                return 0

        def xrdp_login_count() -> int:
            # xrdp 0.10 logs "login was successful"; older releases log "login successful"
            return guest_log_count("login (was )?successful", "/var/log/xrdp.log")

        def sesman_reconnect_count() -> int:
            return guest_log_count("reconnected session: username nrma", "/var/log/xrdp-sesman.log")

        # Connection #1: authenticate as `nrma` and require a remote xorgxrdp + nrmaos-shell session
        logins_before = xrdp_login_count()
        c1 = launch_rdp_client()
        remote_pid_1 = None
        t_end = time.monotonic() + 45.0
        while time.monotonic() < t_end:
            st = json.loads(guest.exec_cmd(["/usr/bin/nrma-rdpctl", "status", "--json"])["stdout"])
            sessions = [x for x in (st.get("connected_sessions") or []) if x.get("user") == "nrma"]
            shells = guest.exec_cmd(["pgrep", "-u", "nrma", "-x", "nrmaos-shell"])
            shell_pids = [p.strip() for p in shells.get("stdout", "").splitlines() if p.strip()]
            if sessions and len(shell_pids) >= 2:
                remote_pid_1 = sessions[0]["pid"]
                break
            if c1.poll() is not None:
                break
            time.sleep(1.0)
        c1_out = stop_client(c1)
        if not remote_pid_1:
            fail_with_diagnostics(
                "First FreeRDP connection did not spawn remote xorgxrdp + nrmaos-shell session.", c1_out
            )
        logins_after_1 = xrdp_login_count()
        print(
            f"Selftest: RDP login #1 OK (xorgxrdp pid {remote_pid_1}, xrdp login records {logins_before}->{logins_after_1})",
            flush=True,
        )

        time.sleep(3.0)

        # Disconnected session must survive (KillDisconnected=false)
        st_disc = json.loads(guest.exec_cmd(["/usr/bin/nrma-rdpctl", "status", "--json"])["stdout"])
        surviving = [x["pid"] for x in (st_disc.get("connected_sessions") or []) if x.get("user") == "nrma"]
        if surviving != [remote_pid_1]:
            fail_with_diagnostics(
                f"Disconnected session was not preserved (expected [{remote_pid_1}], got {surviving}).", c1_out
            )

        # Connection #2: must authenticate again AND attach to the same xorgxrdp session
        reconnects_before = sesman_reconnect_count()
        c2 = launch_rdp_client()
        reconnected_ok = False
        t_end = time.monotonic() + 40.0
        while time.monotonic() < t_end:
            st = json.loads(guest.exec_cmd(["/usr/bin/nrma-rdpctl", "status", "--json"])["stdout"])
            sessions = [x for x in (st.get("connected_sessions") or []) if x.get("user") == "nrma"]
            if (
                len(sessions) == 1
                and sessions[0]["pid"] == remote_pid_1
                and xrdp_login_count() > logins_after_1
                and sesman_reconnect_count() > reconnects_before
            ):
                reconnected_ok = True
                break
            if c2.poll() is not None:
                break
            time.sleep(1.0)
        c2_alive = c2.poll() is None
        c2_out = stop_client(c2)
        if not reconnected_ok or not c2_alive:
            fail_with_diagnostics(
                "Second FreeRDP connection failed to authenticate and reattach to the existing xorgxrdp session "
                f"(reattached={reconnected_ok}, client_alive={c2_alive}).",
                c2_out,
            )
        print(f"Selftest: RDP reconnect OK (same xorgxrdp pid {remote_pid_1})", flush=True)

        # Verify cleanup removes QEMU process and wipes state_dir
        cleanup_ns = argparse.Namespace(
            state_dir=str(state_dir),
            reset_tailscale_serve=False,
            summary_file=str(summary_file),
        )
        cmd_cleanup(cleanup_ns)

        assert not state_dir.exists(), "Cleanup did not remove state_dir (pid file, socket, session metadata)"
        assert not pid_alive(qemu_pid), f"QEMU PID {qemu_pid} still alive after cleanup!"
        port_closed = False
        try:
            with socket.create_connection(("127.0.0.1", int(args.host_port)), timeout=2.0):
                pass
        except OSError:
            port_closed = True
        assert port_closed, f"Host forward 127.0.0.1:{args.host_port} still accepting connections after cleanup!"
        password = ""
        pw_holder.clear()
        print("Selftest: cleanup OK (QEMU stopped, host forward closed, state wiped)", flush=True)

        result_txt = (
            f"qemu_accel={meta['qemu_accel']} host_forward=127.0.0.1:{args.host_port} "
            f"tls_sha256={meta['tls_fingerprint_sha256']} age_roundtrip=ok summary_password_leak=none "
            f"rdp_login_1=ok reconnect_same_xorgxrdp_pid={remote_pid_1} cleanup=qemu_stopped,port_closed,state_wiped"
        )
        print(f"PASS: rdp_qemu_session.py selftest: {result_txt}", flush=True)
        if os.environ.get("GITHUB_ACTIONS") == "true":
            print(f"::notice title=nrmaOS RDP bootstrap selftest passed::{result_txt}", flush=True)
        return 0
    finally:
        if state_dir.exists():
            try:
                cmd_cleanup(
                    argparse.Namespace(
                        state_dir=str(state_dir),
                        reset_tailscale_serve=False,
                        summary_file=None,
                    )
                )
            except Exception:
                pass
        secure_wipe_path(work)


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="nrmaOS QEMU + Tailscale Remote Desktop Session Orchestrator")
    sub = p.add_subparsers(dest="subcmd", required=True)

    p_pre = sub.add_parser("preflight", help="Validate encryption and Tailscale secret configuration")
    p_pre.add_argument("--repo-visibility", choices=["public", "private"], required=True)
    p_pre.add_argument("--age-recipient", default="")
    p_pre.add_argument("--require-tailscale-secrets", action="store_true")

    p_start = sub.add_parser("start", help="Boot nrmaOS in headless QEMU, configure RDP & Tailscale Serve")
    p_start.add_argument("--iso", required=True)
    p_start.add_argument("--state-dir", required=True)
    p_start.add_argument("--host-port", type=int, default=13389)
    p_start.add_argument("--repo-visibility", choices=["public", "private"], required=True)
    p_start.add_argument("--age-recipient", default="")
    p_start.add_argument("--tailscale", action="store_true")
    p_start.add_argument("--encrypted-out", default="")
    p_start.add_argument("--summary-file", default="")
    p_start.add_argument("--artifact-name", default="nrmaos-rdp-credentials")
    p_start.add_argument("--max-minutes", type=int, default=330)
    p_start.add_argument("--cpus", type=int, default=4)
    p_start.add_argument("--memory-mib", type=int, default=4096)
    p_start.add_argument(
        "--resolution",
        choices=["dynamic", "1920x1080", "1600x900", "1366x768", "1280x720"],
        default="dynamic",
    )
    p_start.add_argument("--boot-timeout", type=int, default=210)
    p_start.add_argument("--allow-tcg-fallback", action="store_true", default=True)

    p_keep = sub.add_parser("keepalive", help="Keep session active until cancelled or max runtime reached")
    p_keep.add_argument("--state-dir", required=True)
    p_keep.add_argument("--max-minutes", type=int, default=330)

    p_clean = sub.add_parser("cleanup", help="Stop QEMU, reset Tailscale Serve, and wipe temporary state")
    p_clean.add_argument("--state-dir", required=True)
    p_clean.add_argument("--reset-tailscale-serve", action="store_true")
    p_clean.add_argument("--summary-file", default="")

    p_test = sub.add_parser("selftest", help="Run automated QEMU + age + FreeRDP + reconnect + cleanup test")
    p_test.add_argument("--iso", required=True)
    p_test.add_argument("--host-port", type=int, default=13390)
    p_test.add_argument("--cpus", type=int, default=2)
    p_test.add_argument("--memory-mib", type=int, default=2048)
    p_test.add_argument("--boot-timeout", type=int, default=210)

    return p


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    try:
        if args.subcmd == "preflight":
            return cmd_preflight(args)
        if args.subcmd == "start":
            return cmd_start(args)
        if args.subcmd == "keepalive":
            return cmd_keepalive(args)
        if args.subcmd == "cleanup":
            return cmd_cleanup(args)
        if args.subcmd == "selftest":
            return cmd_selftest(args)
    except BootstrapError as exc:
        print(f"ERROR: {exc}", file=sys.stderr, flush=True)
        gh_error(f"nrmaOS RDP {args.subcmd} failed", str(exc))
        return 1
    except Exception as exc:  # AssertionError, TimeoutError, CalledProcessError, ...
        msg = f"{type(exc).__name__}: {exc}"
        print(f"ERROR: {msg}", file=sys.stderr, flush=True)
        gh_error(f"nrmaOS RDP {args.subcmd} failed", msg)
        return 1
    return 1


if __name__ == "__main__":
    raise SystemExit(main())

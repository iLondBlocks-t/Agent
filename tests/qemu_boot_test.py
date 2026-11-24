#!/usr/bin/env python3
"""Real QEMU full-system boot, desktop, security, runtime, and RDP integration test for nrmaOS."""

import argparse
import json
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import time
from pathlib import Path


def gh_annotation(kind: str, title: str, message: str) -> None:
    if os.environ.get("GITHUB_ACTIONS") == "true":
        escaped = (
            message.replace("%", "%25")
            .replace("\r", "%0D")
            .replace("\n", "%0A")
        )
        print(f"::{kind} title={title}::{escaped}", flush=True)


class QemuGuestClient:
    def __init__(self, sock_path: str):
        self.sock_path = sock_path
        self._counter = 0

    def request(self, payload: dict, timeout: float = 20.0) -> dict:
        self._counter += 1
        req_id = f"req-{self._counter}"
        payload = dict(payload)
        payload["id"] = req_id
        raw = (json.dumps(payload) + "\n").encode("utf-8")

        deadline = time.monotonic() + timeout
        last_err = None
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
                time.sleep(0.5)
        raise TimeoutError(f"Guest QA request {payload.get('action')} timed out: {last_err}")

    def exec_cmd(
        self,
        cmd: list[str],
        *,
        user: str | None = None,
        env: dict | None = None,
        timeout: float = 30.0,
    ) -> dict:
        return self.request(
            {
                "action": "exec",
                "cmd": cmd,
                "user": user,
                "env": env or {},
                "timeout": timeout,
            },
            timeout=timeout + 10.0,
        )


def measure_idle_cpu_percent(guest: QemuGuestClient, sample_sec: float = 2.0) -> float:
    def read_stat() -> tuple[int, int]:
        res = guest.exec_cmd(["head", "-n", "1", "/proc/stat"])
        parts = [int(x) for x in res["stdout"].strip().split()[1:]]
        idle = parts[3] + (parts[4] if len(parts) > 4 else 0)
        total = sum(parts)
        return idle, total

    idle1, total1 = read_stat()
    time.sleep(sample_sec)
    idle2, total2 = read_stat()
    dt = max(1, total2 - total1)
    didle = max(0, idle2 - idle1)
    busy_pct = 100.0 * (1.0 - (didle / dt))
    return round(max(0.0, busy_pct), 2)


def measure_memory_mib(guest: QemuGuestClient) -> dict:
    res = guest.exec_cmd(["cat", "/proc/meminfo"])
    kv = {}
    for line in res["stdout"].splitlines():
        if ":" in line:
            k, v = line.split(":", 1)
            num = v.strip().split()[0]
            if num.isdigit():
                kv[k.strip()] = int(num)
    total_kib = kv.get("MemTotal", 0)
    avail_kib = kv.get("MemAvailable", 0)
    used_kib = max(0, total_kib - avail_kib)
    return {
        "mem_total_mib": round(total_kib / 1024.0, 1),
        "mem_available_mib": round(avail_kib / 1024.0, 1),
        "mem_used_mib": round(used_kib / 1024.0, 1),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Boot and verify nrmaOS ISO in QEMU.")
    parser.add_argument("--iso", required=True, help="Path to built ISO file")
    parser.add_argument(
        "--report",
        default="nrmaos-verification-report.json",
        help="Output JSON report path",
    )
    parser.add_argument(
        "--boot-timeout",
        type=int,
        default=210,
        help="Seconds to wait for live boot and graphical session",
    )
    parser.add_argument(
        "--require-rdp",
        action="store_true",
        help="Run full xrdp + external FreeRDP client session test",
    )
    parser.add_argument(
        "--require-runtime",
        action="store_true",
        help="Verify nrma Runtime CLI, PE analysis, prefix workflow, and MIME integration",
    )
    args = parser.parse_args()

    iso_path = Path(args.iso).resolve()
    if not iso_path.is_file() or iso_path.stat().st_size == 0:
        print(f"FAIL: ISO not found or empty: {iso_path}", file=sys.stderr)
        return 1

    qemu_bin = shutil.which("qemu-system-x86_64")
    if not qemu_bin:
        print("FAIL: qemu-system-x86_64 is not installed", file=sys.stderr)
        return 1

    use_kvm = os.path.exists("/dev/kvm") and os.access("/dev/kvm", os.R_OK | os.W_OK)
    accel_args = ["-enable-kvm", "-cpu", "host"] if use_kvm else ["-accel", "tcg", "-cpu", "max"]

    tmpdir = Path(tempfile.mkdtemp(prefix="nrmaos-qemu-"))
    qa_sock = str(tmpdir / "qa.sock")
    serial_log = Path("qemu-serial.log").resolve()
    if serial_log.exists():
        serial_log.unlink()

    rdp_host_port = 13389

    qemu_cmd = [
        qemu_bin,
        *accel_args,
        "-m",
        "2048",
        "-smp",
        "2",
        "-cdrom",
        str(iso_path),
        "-boot",
        "d",
        "-vga",
        "std",
        "-display",
        "vnc=127.0.0.1:19",
        "-serial",
        f"file:{serial_log}",
        "-device",
        "virtio-serial",
        "-chardev",
        f"socket,path={qa_sock},server=on,wait=off,id=qa0",
        "-device",
        "virtserialport,chardev=qa0,name=org.nrmaos.qatest",
        "-netdev",
        f"user,id=net0,hostfwd=tcp:127.0.0.1:{rdp_host_port}-:3389",
        "-device",
        "virtio-net-pci,netdev=net0",
        "-no-reboot",
    ]

    print(f"Starting QEMU ({'KVM' if use_kvm else 'TCG'}): {' '.join(qemu_cmd)}", flush=True)
    t_vm_start = time.monotonic()
    vm = subprocess.Popen(qemu_cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    guest = QemuGuestClient(qa_sock)

    report: dict = {
        "iso_file": iso_path.name,
        "iso_size_bytes": iso_path.stat().st_size,
        "iso_size_mib": round(iso_path.stat().st_size / (1024.0 * 1024.0), 2),
        "qemu_acceleration": "kvm" if use_kvm else "tcg",
        "checks": {},
        "benchmarks": {},
    }

    try:
        # 1. Wait for guest kernel + systemd to activate VirtIO QA port
        deadline = time.monotonic() + args.boot_timeout
        connected = False
        while time.monotonic() < deadline:
            if vm.poll() is not None:
                raise RuntimeError(f"QEMU exited prematurely with code {vm.returncode}")
            try:
                pong = guest.request({"action": "ping"}, timeout=3.0)
                if pong.get("ok"):
                    connected = True
                    break
            except Exception:
                time.sleep(1.0)

        if not connected:
            raise TimeoutError("Timed out waiting for nrmaOS guest systemd QA responder")

        report["benchmarks"]["vm_qa_ready_seconds"] = round(time.monotonic() - t_vm_start, 2)
        print(f"Guest systemd online in {report['benchmarks']['vm_qa_ready_seconds']}s", flush=True)

        # 2. Wait for LightDM + Xorg + Openbox + nrmaos-shell graphical desktop
        desktop_ready = False
        last_ps = ""
        while time.monotonic() < deadline:
            ps_res = guest.exec_cmd(["ps", "-eo", "user,comm,rss"])
            last_ps = ps_res.get("stdout", "")
            has_xorg = "Xorg" in last_ps
            has_openbox = "openbox" in last_ps
            has_shell = "nrmaos-shell" in last_ps
            if has_xorg and has_openbox and has_shell:
                desktop_ready = True
                break
            time.sleep(1.5)

        if not desktop_ready:
            log_res = guest.exec_cmd(
                ["sh", "-c", "journalctl -u lightdm --no-pager -n 50; cat /home/nrma/.local/state/nrmaos/nrmaos-shell.log 2>/dev/null || true"]
            )
            raise RuntimeError(
                f"Graphical session did not reach Xorg+openbox+nrmaos-shell.\nProcesses:\n{last_ps}\nLogs:\n{log_res.get('stdout', '')}"
            )

        report["benchmarks"]["graphical_desktop_ready_seconds"] = round(
            time.monotonic() - t_vm_start, 2
        )
        report["checks"]["boot_and_shell_processes"] = True

        # 3. Verify /etc/nrmaos-release and X11 window tree
        rel_res = guest.exec_cmd(["cat", "/etc/nrmaos-release"])
        assert rel_res["ok"] and 'NRMAOS_NAME="nrmaOS"' in rel_res["stdout"], "Missing /etc/nrmaos-release"
        report["checks"]["nrmaos_release_branding"] = True

        # Allow QML first frame to map cleanly on X11
        time.sleep(2.0)
        xwin_res = guest.exec_cmd(
            ["xwininfo", "-root", "-tree"],
            user="nrma",
            env={"DISPLAY": ":0"},
        )
        assert xwin_res["ok"] and "nrmaOS" in xwin_res["stdout"], (
            f"nrmaOS window not mapped on X11 root tree: {xwin_res}"
        )
        report["checks"]["x11_shell_window_mapped"] = True

        # 4. Verify firewall default & no open RDP port by default
        ss_res = guest.exec_cmd(["ss", "-tln"])
        assert ":3389 " not in ss_res["stdout"], f"Port 3389 must NOT listen by default:\n{ss_res['stdout']}"
        report["checks"]["rdp_disabled_by_default"] = True

        ufw_res = guest.exec_cmd(["ufw", "status", "verbose"])
        report["checks"]["firewall_active_default_deny"] = (
            ufw_res["ok"] and ("Status: active" in ufw_res["stdout"]) and ("deny (incoming)" in ufw_res["stdout"])
        )
        assert report["checks"]["firewall_active_default_deny"], f"UFW not active deny-incoming:\n{ufw_res}"

        # 5. Measure systemd-analyze, idle RAM, process RSS, and idle CPU
        sa_res = guest.exec_cmd(["systemd-analyze"])
        report["benchmarks"]["systemd_analyze"] = sa_res["stdout"].strip().splitlines()[0] if sa_res["stdout"].strip() else "unavailable"

        uname_res = guest.exec_cmd(["uname", "-r"])
        report["kernel_version"] = uname_res["stdout"].strip()

        mem_info = measure_memory_mib(guest)
        report["benchmarks"].update(mem_info)
        report["benchmarks"]["idle_cpu_percent"] = measure_idle_cpu_percent(guest, 2.0)

        rss_res = guest.exec_cmd(["ps", "-C", "Xorg,openbox,nrmaos-shell", "-o", "comm=,rss="])
        rss_mib = {}
        for line in rss_res["stdout"].splitlines():
            parts = line.split()
            if len(parts) == 2 and parts[1].isdigit():
                rss_mib[parts[0]] = round(int(parts[1]) / 1024.0, 1)
        report["benchmarks"]["process_rss_mib"] = rss_mib

        # 6. Test interactive Shell IPC & Window Management when nrma-shellctl is installed
        shellctl_check = guest.exec_cmd(["which", "nrma-shellctl"])
        if shellctl_check["ok"]:
            t0 = time.monotonic()
            st_res = guest.exec_cmd(
                ["nrma-shellctl", "status"],
                user="nrma",
                env={"DISPLAY": ":0", "XDG_RUNTIME_DIR": "/tmp/nrmaos-runtime-1000"},
            )
            ipc_ms = round((time.monotonic() - t0) * 1000.0, 1)
            report["benchmarks"]["shell_ipc_latency_ms"] = ipc_ms
            assert st_res["ok"], f"nrma-shellctl status failed: {st_res}"

            # Launch Terminal via launcher IPC and verify xterm maps on X11
            t_launch = time.monotonic()
            l_res = guest.exec_cmd(
                ["nrma-shellctl", "launch", "terminal"],
                user="nrma",
                env={"DISPLAY": ":0"},
            )
            assert l_res["ok"], f"Failed launching terminal via shellctl: {l_res}"
            xterm_mapped = False
            for _ in range(15):
                xw = guest.exec_cmd(["xwininfo", "-root", "-tree"], user="nrma", env={"DISPLAY": ":0"})
                if "xterm" in xw["stdout"].lower():
                    xterm_mapped = True
                    break
                time.sleep(0.3)
            report["benchmarks"]["app_launch_to_x11_map_ms"] = round(
                (time.monotonic() - t_launch) * 1000.0, 1
            )
            assert xterm_mapped, "xterm window did not map after launcher invocation"
            report["checks"]["app_launcher_and_window_management"] = True

            # Test notification delivery
            n_res = guest.exec_cmd(
                ["nrma-notify", "Automated Test", "Desktop notification verified"],
                user="nrma",
                env={"DISPLAY": ":0"},
            )
            assert n_res["ok"], f"nrma-notify failed: {n_res}"
            report["checks"]["notifications"] = True

        # 7. Verify nrma Runtime (EXE compatibility layer) if present / required
        rt_check = guest.exec_cmd(["which", "nrma-runtime"])
        if args.require_runtime or rt_check["ok"]:
            assert rt_check["ok"], "nrma-runtime executable missing"
            diag_res = guest.exec_cmd(["nrma-runtime", "status", "--json"], user="nrma")
            assert diag_res["ok"], f"nrma-runtime status failed: {diag_res}"
            rt_status = json.loads(diag_res["stdout"])
            assert rt_status.get("wine_installed") is False, "Base image must keep Wine optional/uninstalled"

            # Synthesize a minimal valid 64-bit PE header .exe to test inspection & shortcut creation
            pe_test = guest.exec_cmd(
                [
                    "python3",
                    "-c",
                    (
                        "import struct, pathlib; "
                        "dos = bytearray(128); dos[0:2] = b'MZ'; struct.pack_into('<I', dos, 0x3C, 128); "
                        "pe = b'PE\\x00\\x00' + struct.pack('<HHIIIHH', 0x8664, 1, 0, 0, 0, 240, 0x0022); "
                        "opt = bytearray(240); struct.pack_into('<H', opt, 0, 0x20B); struct.pack_into('<H', opt, 68, 2); "
                        "p = pathlib.Path('/home/nrma/SampleTool.exe'); p.write_bytes(bytes(dos + pe + opt)); "
                    ),
                ],
                user="nrma",
            )
            assert pe_test["ok"], f"Failed creating synthetic PE sample: {pe_test}"
            insp = guest.exec_cmd(["nrma-runtime", "inspect", "/home/nrma/SampleTool.exe", "--json"], user="nrma")
            assert insp["ok"], f"nrma-runtime inspect failed: {insp}"
            insp_data = json.loads(insp["stdout"])
            assert insp_data.get("architecture") == "x86_64" and insp_data.get("subsystem") == "Windows GUI", (
                f"Unexpected PE inspection output: {insp_data}"
            )
            pfx_res = guest.exec_cmd(["nrma-runtime", "create-prefix", "sample-app"], user="nrma")
            assert pfx_res["ok"], f"Prefix creation failed: {pfx_res}"
            sc_res = guest.exec_cmd(
                ["nrma-runtime", "create-shortcut", "/home/nrma/SampleTool.exe", "--name", "Sample Windows App", "--prefix", "sample-app"],
                user="nrma",
            )
            assert sc_res["ok"], f"Shortcut creation failed: {sc_res}"
            report["checks"]["nrma_runtime_exe_workflow"] = True

        # 8. Verify Remote Desktop (xrdp + xorgxrdp + PAM root block + external FreeRDP connection)
        rdpctl_check = guest.exec_cmd(["which", "nrma-rdpctl"])
        if args.require_rdp or rdpctl_check["ok"]:
            assert rdpctl_check["ok"], "nrma-rdpctl missing"
            st0 = json.loads(guest.exec_cmd(["nrma-rdpctl", "status", "--json"])["stdout"])
            assert st0["enabled"] is False and st0["active"] is False, f"RDP must start disabled: {st0}"

            # Configure regular user access and temporary test password via stdin (never saved in plaintext)
            pw_setup = guest.exec_cmd(
                ["sh", "-c", "printf 'nrma:NrmaTest#2026!\\n' | chpasswd && nrma-rdpctl grant-user nrma"]
            )
            assert pw_setup["ok"], f"Failed granting RDP user access: {pw_setup}"

            # Also set a temporary root password SOLELY inside this disposable VM to prove PAM/xrdp blocks root RDP login!
            guest.exec_cmd(["sh", "-c", "printf 'root:RootBlockTest#2026!\\n' | chpasswd"])

            en_res = guest.exec_cmd(["nrma-rdpctl", "enable", "--port", "3389", "--subnet", "10.0.0.0/8"])
            assert en_res["ok"], f"nrma-rdpctl enable failed: {en_res}"

            st1 = json.loads(guest.exec_cmd(["nrma-rdpctl", "status", "--json"])["stdout"])
            assert st1["active"] is True and st1["tls_configured"] is True and st1["root_login_blocked"] is True, (
                f"Unexpected active RDP status: {st1}"
            )

            freerdp_bin = shutil.which("xfreerdp3") or shutil.which("xfreerdp") or shutil.which("wlfreerdp")
            xvfb_run = shutil.which("xvfb-run")
            if freerdp_bin and xvfb_run:
                # 8a. Verify root login over RDP is DENIED
                root_cmd = [
                    xvfb_run,
                    "-a",
                    freerdp_bin,
                    f"/v:127.0.0.1:{rdp_host_port}",
                    "/u:root",
                    "/p:RootBlockTest#2026!",
                    "/cert:ignore",
                    "+auth-only",
                ]
                root_try = subprocess.run(root_cmd, capture_output=True, text=True, timeout=25)
                assert root_try.returncode != 0, "SECURITY FAILURE: root RDP authentication succeeded!"
                report["checks"]["rdp_root_login_denied"] = True

                # 8b. Connect real FreeRDP client as regular user `nrma` and launch full remote nrmaOS session!
                mem_before_rdp = measure_memory_mib(guest)["mem_used_mib"]
                t_rdp = time.monotonic()
                rdp_client_proc = subprocess.Popen(
                    [
                        xvfb_run,
                        "-a",
                        freerdp_bin,
                        f"/v:127.0.0.1:{rdp_host_port}",
                        "/u:nrma",
                        "/p:NrmaTest#2026!",
                        "/size:1280x720",
                        "/cert:ignore",
                    ],
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                )
                try:
                    remote_shell_up = False
                    for _ in range(30):
                        ps_rdp = guest.exec_cmd(["pgrep", "-a", "nrmaos-shell"])
                        lines = [ln for ln in ps_rdp["stdout"].splitlines() if "nrmaos-shell" in ln]
                        if len(lines) >= 2:
                            remote_shell_up = True
                            break
                        time.sleep(1.0)
                    assert remote_shell_up, (
                        f"Remote RDP connection did not spawn second nrmaos-shell instance.\n"
                        f"sesman log:\n{guest.exec_cmd(['tail', '-n', '40', '/var/log/xrdp-sesman.log']).get('stdout', '')}\n"
                        f"xrdp log:\n{guest.exec_cmd(['tail', '-n', '40', '/var/log/xrdp.log']).get('stdout', '')}"
                    )
                    report["benchmarks"]["rdp_session_startup_seconds"] = round(
                        time.monotonic() - t_rdp, 2
                    )
                    time.sleep(1.5)
                    mem_during_rdp = measure_memory_mib(guest)["mem_used_mib"]
                    report["benchmarks"]["rdp_session_ram_overhead_mib"] = round(
                        max(0.0, mem_during_rdp - mem_before_rdp), 1
                    )
                    report["checks"]["rdp_remote_nrmaos_session_verified"] = True
                finally:
                    rdp_client_proc.terminate()
                    try:
                        rdp_client_proc.wait(timeout=5)
                    except Exception:
                        rdp_client_proc.kill()

            # 8c. Disable RDP and verify service stops & port closes
            dis_res = guest.exec_cmd(["nrma-rdpctl", "disable"])
            assert dis_res["ok"], f"nrma-rdpctl disable failed: {dis_res}"
            ss_after = guest.exec_cmd(["ss", "-tln"])
            assert ":3389 " not in ss_after["stdout"], "Port 3389 still listening after disable!"
            report["checks"]["rdp_clean_shutdown"] = True

        report["overall_pass"] = True
        Path(args.report).write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
        summary_json = json.dumps(report, indent=2)
        print("=== nrmaOS QEMU VERIFICATION REPORT ===")
        print(summary_json, flush=True)
        gh_annotation("notice", "nrmaOS QEMU Verification & Benchmarks", summary_json)
        return 0

    except Exception as exc:
        report["overall_pass"] = False
        report["error"] = str(exc)
        Path(args.report).write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
        serial_tail = ""
        if serial_log.exists():
            serial_tail = "\n".join(
                serial_log.read_text(encoding="utf-8", errors="replace").splitlines()[-45:]
            )
        err_msg = f"{exc}\n--- Serial tail ---\n{serial_tail}"
        print(f"FAIL: {err_msg}", file=sys.stderr, flush=True)
        gh_annotation("error", "QEMU Integration Test Failed", err_msg)
        return 1

    finally:
        vm.terminate()
        try:
            vm.wait(timeout=8)
        except Exception:
            vm.kill()
        shutil.rmtree(tmpdir, ignore_errors=True)


if __name__ == "__main__":
    sys.exit(main())

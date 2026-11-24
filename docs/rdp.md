# Remote Desktop (RDP) in nrmaOS

## Overview

nrmaOS integrates `xrdp` and `xorgxrdp` with a hardened system controller (`/usr/bin/nrma-rdpctl`) and a native configuration panel under **nrma Settings → Remote Desktop**.

Remote connections launch a dedicated Xorg (`xorgxrdp`) display running `/etc/xrdp/startwm.sh` → `/usr/bin/nrmaos-session` → `/usr/bin/nrmaos-shell`, delivering the authentic nrmaOS desktop environment rather than a generic fallback session.

## Security Defaults & Safeguards

1. **Disabled by Default**: Both `xrdp.service` and `xrdp-sesman.service` are disabled in the ISO build (`remote-desktop/setup-rdp.sh`), and TCP port `3389` does not listen until an administrator explicitly enables Remote Desktop.
2. **No Root Login**: Root and system accounts (`UID < 1000`) are blocked at two independent layers:
   - `/etc/pam.d/xrdp-sesman` prepends `auth requisite pam_succeed_if.so uid >= 1000 quiet`.
   - `/etc/xrdp/sesman.ini` sets `AllowRootLogin=false`, `AlwaysGroupCheck=true`, and `TerminalServerUsers=nrmaos-rdp`.
3. **Per-Machine TLS 1.2 / 1.3**: Build-time snakeoil keys are stripped from the image so no shared private key is distributed in the ISO. When Remote Desktop is enabled, `nrma-rdpctl` generates a unique local ECDSA P-256 certificate (`/etc/xrdp/cert.pem`, `/etc/xrdp/key.pem` `0640 root:xrdp`) and enforces `ssl_protocols=TLSv1.2, TLSv1.3`.
4. **No Plaintext Password Storage**: Account passwords set through **Settings → Remote Desktop** are piped over `stdin` directly to `chpasswd` (`nrma-rdpctl set-user-password <user>`) and zeroed in memory; passwords are never passed on `argv` or stored in configuration files.
5. **Local Network & Tailscale Interface Firewall Scope**: `ufw` defaults to `deny (incoming)`. Remote Desktop supports three explicit firewall scopes (`nrma-rdpctl --firewall-mode {lan,tailscale,lan+tailscale}`):
   - **`lan` (Default)**: Opens the configured TCP port only for trusted local RFC1918 subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`). Raw `100.64.0.0/10` (RFC 6598 CGNAT) and public/global CIDRs (`0.0.0.0/0`) are rejected on untrusted interfaces.
   - **`tailscale`**: Restricts incoming RDP strictly to the encrypted `tailscale0` WireGuard interface (`ufw allow in on tailscale0 from 100.64.0.0/10` and `fd7a:115c:a1e0::/48`), keeping LAN/Wi-Fi ports closed.
   - **`lan+tailscale`**: Allows both validated local RFC1918 subnets and `tailscale0`.
   Automatic router port forwarding (UPnP/NAT-PMP) and public Tailscale Funnel are never used.

## Session Model

Each authenticated remote connection starts an isolated Xorg display (`:10`, `:11`, …) via `xorgxrdp` with its own D-Bus session bus, per-display shell IPC socket (`/tmp/nrmaos-ipc-<uid>/shell-<display>.sock`), dynamic resolution negotiation, clipboard channel support (`cliprdr`), and automatic software-rendering motion tuning (`XRDP_SESSION=1`). Disconnecting without logging out allows reconnecting to the existing `xrdp-sesman` session for the same user and resolution policy.

## Connecting from Clients

1. Open **nrma Settings → Remote Desktop** on nrmaOS.
2. Authorize a non-root local user (e.g. `nrma`), set a strong account password (8+ characters), and click **Enable Remote Desktop**.
3. Note the displayed local endpoint (`<local-ip>:3389`).
4. Connect from any standard RDP client:
   - **Windows**: Open **Remote Desktop Connection (`mstsc.exe`)**, enter `<local-ip>:3389`, accept the machine's TLS certificate fingerprint shown in Settings, and sign in with your nrmaOS username and password.
   - **Android**: Install **Windows App (Microsoft Remote Desktop)** or **aFreeRDP**, add PC `<local-ip>:3389`, and sign in.
   - **Linux**: `xfreerdp /v:<local-ip>:3389 /u:<username> /sec:tls /dynamic-resolution`

## Secure Access Outside Your LAN

Never forward port `3389` directly on an internet-facing router. To reach nrmaOS safely across the internet:

- **Native Tailscale on nrmaOS**: Open **nrma Settings → Tailscale VPN**, click **Connect to Tailscale**, complete browser sign-in, and switch **Settings → Remote Desktop → Firewall Access Scope** to **Tailscale Only (`tailscale0` interface)** (`nrma-rdpctl enable --firewall-mode tailscale`).
- **One-Click Cloud Session on GitHub Actions**: Run the **nrmaOS Remote Desktop** workflow (`.github/workflows/nrmaos-rdp.yml`) to boot a live nrmaOS VM on GitHub Actions connected privately to your Tailnet — see [One-Click Tailscale RDP Guide](tailscale-rdp.md).
- **SSH Tunnel**: `ssh -L 13389:127.0.0.1:3389 <user>@<host>` and connect your RDP client to `127.0.0.1:13389`.

# Security Policy

## Security Posture of nrmaOS

nrmaOS is an open-source Debian-based live desktop operating system designed with secure-by-default network settings:

- **Incoming Firewall Active by Default**: `ufw` (`nftables` backend) is enabled at boot with `deny (incoming)` and `allow (outgoing)`.
- **Remote Desktop Disabled by Default**: `xrdp` and `xrdp-sesman` ship disabled (`systemctl disable`). Port `3389` is closed until an administrator explicitly enables Remote Desktop.
- **No Root RDP Access**: Root and system accounts (`UID < 1000`) are blocked from RDP authentication in both `/etc/pam.d/xrdp-sesman` (`pam_succeed_if.so uid >= 1000`) and `/etc/xrdp/sesman.ini` (`AllowRootLogin=false`), and authorized RDP users must belong to the `nrmaos-rdp` group.
- **Unique Per-Machine TLS Keys**: Build-time snakeoil certificates/keys are removed during ISO creation so no static private key is shared across installations; `nrma-rdpctl enable` generates a unique local ECDSA P-256 certificate (`0640 root:xrdp`) and enforces `TLSv1.2` / `TLSv1.3`.
- **No Plaintext Credentials**: User passwords configured for RDP are piped over `stdin` to `chpasswd` and never passed via command-line arguments or saved to disk in plaintext.
- **No Automatic Router Port Forwarding**: UPnP / NAT-PMP utilities are prohibited by automated source checks (`scripts/test-source.sh`), and `nrma-rdpctl` rejects public `0.0.0.0/0` firewall rules unless explicitly overridden on the CLI.
- **Interface-Scoped Tailscale RDP**: Raw `100.64.0.0/10` (RFC 6598 shared/CGNAT space) is rejected as an ordinary "trusted subnet" because ISPs also use it. Tailscale access is instead granted only through `nrma-rdpctl --firewall-mode tailscale` (or `lan+tailscale`), which emits `ufw allow in on tailscale0 ...` rules bound to the WireGuard interface.
- **Native Tailscale Disconnected by Default**: The official `tailscale` Debian package is installed, but `tailscaled.service` ships disabled, `/var/lib/tailscale` is empty in the ISO, and no auth keys are baked in. Connecting requires the normal interactive Tailscale login from **nrma Settings → Tailscale VPN** (`nrma-tailscalectl connect`, Polkit admin authentication).
- **GitHub Actions Remote Desktop Credentials**: The `nrmaOS Remote Desktop` workflow generates a fresh password per run and passes it into the QEMU guest only over the `stdin` of a mode-0600 VirtIO serial UNIX socket — never on the kernel command line, process arguments, step logs, or `GITHUB_ENV`. On public repositories the credential bundle is `age`-encrypted to `NRMAOS_AGE_RECIPIENT` and only ciphertext is uploaded; the workflow fails closed if that variable is missing. QEMU forwards only `127.0.0.1:13389`, the guest UFW allows only the SLIRP gateway `10.0.2.2/32`, and the runner exposes port `3389` only inside the Tailnet via `tailscale serve --tcp` (Funnel is checked and refused).
- **Live Session Caveat**: For local evaluation convenience, the live ISO logs into the local `nrma` account automatically on physical/VM console `:0` with `sudo` group membership. Do not leave an unattended live evaluation session unlocked in untrusted physical environments.

## Reporting a Vulnerability

Do not post exploitable vulnerability details or credentials in public issues. Report security issues privately through GitHub's Security Advisory tab on this repository, including the commit hash, affected component (`shell/`, `remote-desktop/`, `runtime/`, `system/`), and reproduction steps.

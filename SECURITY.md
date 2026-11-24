# Security Policy

## Security Posture of nrmaOS

nrmaOS is an open-source Debian-based live desktop operating system designed with secure-by-default network settings:

- **Incoming Firewall Active by Default**: `ufw` (`nftables` backend) is enabled at boot with `deny (incoming)` and `allow (outgoing)`.
- **Remote Desktop Disabled by Default**: `xrdp` and `xrdp-sesman` ship disabled (`systemctl disable`). Port `3389` is closed until an administrator explicitly enables Remote Desktop.
- **No Root RDP Access**: Root and system accounts (`UID < 1000`) are blocked from RDP authentication in both `/etc/pam.d/xrdp-sesman` (`pam_succeed_if.so uid >= 1000`) and `/etc/xrdp/sesman.ini` (`AllowRootLogin=false`), and authorized RDP users must belong to the `nrmaos-rdp` group.
- **Unique Per-Machine TLS Keys**: Build-time snakeoil certificates/keys are removed during ISO creation so no static private key is shared across installations; `nrma-rdpctl enable` generates a unique local ECDSA P-256 certificate (`0640 root:xrdp`) and enforces `TLSv1.2` / `TLSv1.3`.
- **No Plaintext Credentials**: User passwords configured for RDP are piped over `stdin` to `chpasswd` and never passed via command-line arguments or saved to disk in plaintext.
- **No Automatic Router Port Forwarding**: UPnP / NAT-PMP utilities are prohibited by automated source checks (`scripts/test-source.sh`), and `nrma-rdpctl` rejects public `0.0.0.0/0` firewall rules unless explicitly overridden on the CLI.
- **Live Session Caveat**: For local evaluation convenience, the live ISO logs into the local `nrma` account automatically on physical/VM console `:0` with `sudo` group membership. Do not leave an unattended live evaluation session unlocked in untrusted physical environments.

## Reporting a Vulnerability

Do not post exploitable vulnerability details or credentials in public issues. Report security issues privately through GitHub's Security Advisory tab on this repository, including the commit hash, affected component (`shell/`, `remote-desktop/`, `runtime/`, `system/`), and reproduction steps.

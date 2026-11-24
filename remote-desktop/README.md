# nrmaOS Remote Desktop (`remote-desktop/`)

Integrated, security-hardened `xrdp` + `xorgxrdp` server and management backend:

- `nrma-rdpctl` — Privileged management tool and JSON status provider consumed by **Settings > Remote Desktop**.
- `startwm.sh` — Installed to `/etc/xrdp/startwm.sh`; isolates per-display D-Bus/runtime directories, applies preferred session resolution, sets `XRDP_SESSION=1`, and launches `/usr/bin/nrmaos-session` so every remote client receives the authentic nrmaOS desktop.
- `setup-rdp.sh` — Build-time chroot hardening script that:
  - Disables `xrdp.service` and `xrdp-sesman.service` by default.
  - Prepends `auth requisite pam_succeed_if.so uid >= 1000 quiet` to `/etc/pam.d/xrdp-sesman` and sets `AllowRootLogin=false` in `/etc/xrdp/sesman.ini`.
  - Restricts RDP logins to members of the `nrmaos-rdp` group.
  - Configures `ssl_protocols=TLSv1.2, TLSv1.3` and removes chroot-generated snakeoil private keys so unique ECDSA keys are generated per machine when RDP is enabled.
- `org.nrmaos.rdpctl.policy` — PolicyKit action definitions for GUI privilege elevation.

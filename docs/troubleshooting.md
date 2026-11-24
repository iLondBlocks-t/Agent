# Troubleshooting

## Build Issues

### Building on Ubuntu Fails with Legacy `live-build` Options
Ubuntu's `universe` archive ships an outdated `3.0~a57` snapshot of `live-build`. `./scripts/build-iso.sh` automatically detects non-Debian hosts and runs inside an official `debian:stable` Docker container when Docker is installed. Ensure Docker is running (`docker info`) or run the build on a native Debian `stable` `amd64` host.

### Insufficient Disk Space During `lb build`
Building the chroot, Qt 6 compilation, and SquashFS compression require roughly 6–8 GiB of free disk space. Remove stale build state with `sudo lb clean --purge` before retrying.

## Boot & Graphical Session Issues

### Black Screen or Slow Animations in Virtual Machines
`nrmaos-session` automatically inspects the Mesa OpenGL renderer and `XRDP_SESSION` environment variable. When software rasterization (`llvmpipe`/`softpipe`) is detected, `picom` is skipped and `QSG_RENDER_LOOP=basic` + reduced motion timings are enabled automatically. You can inspect session logs at:
- `~/.local/state/nrmaos/nrmaos-shell.log`
- `~/.local/state/nrmaos/openbox.log`
- `sudo journalctl -u lightdm --no-pager`

### Checking Shell Health from Terminal
Run:
```sh
nrma-shellctl status
```
This queries the active `nrmaos-shell` UNIX socket (`/tmp/nrmaos-ipc-$(id -u)/shell-0.sock`) and prints live JSON telemetry.

## Remote Desktop (RDP) Issues

### RDP Client Cannot Reach nrmaOS
1. Remote Desktop is **disabled by default**. Open **nrma Settings → Remote Desktop** (or run `nrma-rdpctl status`) to confirm `Server Active: True`.
2. Ensure your client IP falls within the configured **Trusted Firewall Subnets** (default RFC1918 local networks `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`).
3. When using `xfreerdp` from Linux, pass `/sec:tls` because `xrdp` negotiates standard TLS 1.2/1.3 rather than Active Directory CredSSP/NLA by default.

### Login Rejected Over RDP
- Verify you are logging in as a **non-root** user (`UID >= 1000`) who has been authorized in **Settings → Remote Desktop** (`nrmaos-rdp` group) and has a local password configured (`nrma-rdpctl grant-user <user>`).
- `root` login over RDP is permanently blocked by PAM (`pam_succeed_if.so uid >= 1000`) and `sesman.ini`.

## Windows `.exe` Compatibility Issues

- Wine is optional and not preinstalled in the base ISO. Install it via **Settings → nrma Runtime → Install Optional Wine Engine** (`sudo nrma-runtime install-engine`) while connected to the internet.
- Run `nrma-runtime inspect <file.exe>` first to check whether the executable is a supported 32-bit/64-bit user-mode application rather than an unsupported kernel driver.

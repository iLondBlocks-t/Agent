# nrmaOS 0.1.0 ("Atlas") — Release Notes

## Highlights

**nrmaOS 0.1.0 ("Atlas")** is the first bootable, end-to-end verified `x86_64` (`amd64`) Live ISO release of nrmaOS, built on **Debian GNU/Linux `stable`** (`trixie`, Linux kernel `6.12.x`) with an original C++17 + Qt 6 / QML desktop environment and integrated secure Remote Desktop support.

### Original nrmaOS Desktop Environment
- **nrma Desktop, Top Bar & Dock (`nrmaos-shell`)**: Multi-surface X11 EWMH shell (`_NET_WM_WINDOW_TYPE_DESKTOP`, `_NET_WM_WINDOW_TYPE_DOCK`, `_NET_WM_STRUT_PARTIAL`) paired with Openbox and adaptive Picom compositing.
- **Dark & Light Themes + Wallpaper Manager**: Five generated 1920x1080 wallpapers (`Aurora Dark`, `Atlas Twilight`, `Sahara Dawn`, `Ocean Glass`, `Daylight Mist`), customizable accent colors, adjustable dock sizing, and automatic software-rendering fallback.
- **App Launcher, Task Switcher, Control Center & Notifications**: Keyboard and mouse searchable launcher (`Ctrl+Space` / `Super`), live X11 window tiling (`Left`, `Right`, `Maximize`), notification center with non-focus-stealing toasts (`nrma-notify`), and shell IPC CLI (`nrma-shellctl`).
- **Native System Utilities**: First-party Qt 6 **nrma Files** (`nrma-files`), **nrma Settings** (`nrma-settings`), branded **nrmaOS Login Greeter**, and **nrma Live Readiness Helper** (`nrma-installer`).

### Integrated Secure Remote Desktop (`xrdp` + `xorgxrdp`)
- Configurable directly in **nrma Settings → Remote Desktop** (`/usr/bin/nrma-rdpctl`).
- **Disabled by default**; incoming firewall (`ufw`) active with default `deny (incoming)`.
- Launches an isolated **nrmaOS** desktop session per remote connection (`/etc/xrdp/startwm.sh` → `/usr/bin/nrmaos-session`).
- Blocks `root` and system (`UID < 1000`) logins via PAM and `sesman.ini`, enforces `TLSv1.2`/`TLSv1.3` with unique per-machine ECDSA certificates, restricts firewall rules to trusted local RFC1918 networks by default, and never saves plaintext passwords.

### Optional Windows EXE Compatibility (`nrma Runtime`)
- Keeps Wine optional and uninstalled in the base ISO to maintain a ~1.0 GiB image and ~393 MiB idle RAM footprint.
- Includes offline PE32/PE32+ header diagnostics (`nrma-runtime inspect`), isolated Wine prefixes, `.exe`/`.msi` file associations, **Right-click → Open with nrma Runtime** in **nrma Files**, launcher shortcut creation, and 1-click optional Wine installation from Debian repositories.

## Verified QEMU + FreeRDP Benchmarks (`nrmaos-0.1.0-amd64.iso`)

- **ISO Size**: `1023.0 MiB` (`1,072,693,248` bytes, BIOS + UEFI hybrid)
- **`systemd-analyze` Boot Time**: `6.422 s` (`2.172 s` kernel + `4.250 s` userspace on 2-vCPU KVM VM)
- **Idle Memory Usage**: `393.2 MiB` used (`0.0%` idle CPU)
- **Launcher-to-X11 Window Mapping**: `239.6 ms`
- **Remote Desktop Session Startup**: `2.13 s` (`+147.1 MiB` RAM for concurrent `xorgxrdp` + `nrmaos-shell` session)

## Known Scope & Limitations

- **Live Evaluation Media**: `nrmaos-0.1.0-amd64.iso` boots as a non-destructive live image (BIOS + UEFI); a destructive disk partitioner/installer is intentionally omitted in `0.1.0`.
- **Wine Compatibility**: Windows application support is optional and varies by application; kernel-mode Windows drivers, kernel anti-cheat systems, and UWP packages are not supported.
- **Separate Remote Xorg Sessions**: Each remote RDP connection starts an independent `xorgxrdp` X11 display (`:10+`) rather than screen-scraping physical display `:0`.

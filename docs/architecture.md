# nrmaOS Technical Architecture

## 1. Foundation & Stack

nrmaOS is a lightweight `x86_64` (`amd64`) open-source desktop operating system built upon **Debian GNU/Linux `stable`** (`trixie`) without installing any prebuilt desktop environment metapackage (no GNOME, KDE Plasma, XFCE, MATE, Cinnamon, or LXQt).

| Layer | Component | Role in nrmaOS |
|---|---|---|
| Kernel & Init | `linux-image-amd64` (`6.12.x`), `systemd`, `live-boot`, `live-config-systemd` | Hardware drivers, KMS/DRM modesetting, fast parallel service startup |
| Display & Graphics | `xserver-xorg-core`, `libgl1-mesa-dri`, `xserver-xorg-video-{fbdev,vesa}` | Local Xorg graphics, Mesa hardware OpenGL/EGL acceleration, software `llvmpipe` fallback |
| Window Manager & Compositor | `openbox` + `picom` | Lightweight EWMH window framing/focus + XRender shadows/fades on accelerated hardware |
| Login Manager | `lightdm` + `nrmaOS-Login` theme | Branded login greeter + live evaluation autologin (`99-nrmaos.conf`) |
| Desktop Shell | `nrmaos-shell` (C++17, Qt 6 Quick/QML, `libX11`) | Original multi-surface desktop, Top Bar, Dock, App Launcher, Control Center, Notifications, Task Switcher |
| First-Party Apps | `nrma-files`, `nrma-settings`, `nrma-installer` | Native Qt 6 file manager, multi-page system settings, and live readiness utility |
| EXE Compatibility | `nrma-runtime` + optional Debian `wine` | PE32/PE32+ header analyzer, isolated Wine prefixes, `.exe`/`.msi` MIME integration, launcher shortcuts |
| Remote Desktop | `xrdp`, `xorgxrdp`, `nrma-rdpctl`, `ufw` | Per-connection remote nrmaOS Xorg sessions, TLS 1.2/1.3, PAM root block, RFC1918 firewall scoping |

## 2. Multi-Surface X11 Desktop Shell (`shell/`)

Unlike single-window fullscreen prototypes that obscure client applications when clicked, `nrmaos-shell` registers distinct EWMH window surfaces with X11 (`WindowManagerBridge.cpp`):

1. **Desktop Backdrop (`_NET_WM_WINDOW_TYPE_DESKTOP`, `_NET_WM_STATE_BELOW`)**: Remains permanently beneath client windows (`xterm`, `nrma-files`, `nrma-settings`, Wine apps), rendering the selected wallpaper and right-click context menu.
2. **Top Bar (`_NET_WM_WINDOW_TYPE_DOCK`, `_NET_WM_STRUT_PARTIAL` top = 36 px)**: Anchored at the top edge; Openbox respects the 36 px top strut when maximizing windows. Displays active window title, left/right/maximize tiling buttons, RDP active indicator, search, window count, theme switch, notifications, Control Center, and clock.
3. **Dock (`_NET_WM_WINDOW_TYPE_DOCK`, `_NET_WM_STRUT_PARTIAL` bottom = 76 px)**: Floating centered bottom dock reserving a 76 px bottom strut, combining pinned nrmaOS apps with live running X11 client windows (`_NET_CLIENT_LIST`).
4. **On-Demand Overlay & Non-Focus-Stealing Toast Surfaces**: Mapped only when an overlay (`LauncherView`, `ControlCenterView`, `NotificationDrawer`, `TaskSwitcherView`) or notification toast is active, leaving normal X11 windows completely unobstructed during regular work.

## 3. Adaptive Rendering & Session Isolation

`/usr/bin/nrmaos-session` serves as the unified X11 session entrypoint for both local LightDM logins (`:0`) and remote `xrdp` sessions (`:10+`):
- Inspects `XRDP_SESSION` and `glxinfo -B` at session startup. On hardware GPUs, `picom` provides subtle shadows and fades; on `xorgxrdp` or software `llvmpipe` VMs, `picom` is bypassed, `QSG_RENDER_LOOP=basic` is enabled, and QML animation durations shorten automatically.
- `ShellIpcServer` binds per-UID, per-display UNIX domain sockets (`/tmp/nrmaos-ipc-<uid>/shell-<display>.sock`, mode `0700`), allowing the same user to hold a local `:0` session and one or more remote `:10+` RDP sessions concurrently without D-Bus or socket collisions.

## 4. Measured Resource & Performance Profile

Measured automatically by `tests/qemu_boot_test.py` on GitHub Actions (`ubuntu-24.04` x86_64 runner with KVM hardware virtualization, 2 vCPUs, 2048 MiB RAM allocated to QEMU guest, Linux kernel `6.12.118+deb13-amd64`, CI Run `45428820631`):

| Metric | Measured Result | Measurement Method |
|---|---|---|
| Hybrid ISO Size | **1023.0 MiB** (`1,072,693,248` bytes) | `stat` on `nrmaos-0.1.0-amd64.iso` |
| Kernel + Userspace Boot (`systemd-analyze`) | **6.422 s** (`2.172 s` kernel + `4.250 s` userspace) | `systemd-analyze` inside booted VM |
| Cold VM Power-On to Interactive Graphical Desktop | **23.15 s** (includes 3 s boot menu timeout) | Host monotonic timer until `Xorg` + `openbox` + `nrmaos-shell` ready |
| Idle System Memory Used | **393.2 MiB** (`1580.4 MiB` available of `1973.6 MiB`) | `/proc/meminfo` (`MemTotal - MemAvailable`) |
| Process Resident Set Size (RSS) | `openbox`: **18.2 MiB**, `Xorg`: **97.4 MiB**, `nrmaos-shell`: **223.8 MiB** (includes Mesa `llvmpipe` buffer) | `ps -C Xorg,openbox,nrmaos-shell -o rss=` |
| Idle CPU Usage | **0.0%** | 2.0-second `/proc/stat` delta after desktop settle |
| App Launcher → X11 Window Mapped | **239.6 ms** | `nrma-shellctl launch terminal` to `xterm` mapped in `xwininfo -root -tree` |
| Remote Desktop Session Startup | **2.13 s** | `xfreerdp3 /sec:tls` connect to remote `nrmaos-shell` process active |
| Concurrent RDP Session RAM Overhead | **147.1 MiB** | Guest `MemUsed` delta with simultaneous `:0` local + `:10` `xorgxrdp` session |

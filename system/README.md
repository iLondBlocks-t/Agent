# System Session & Configuration (`system/`)

System-level integration gluing Debian Live, LightDM, Xorg, Openbox, Picom, and `nrmaos-shell`:

- `nrmaos-session` — Session entrypoint (`/usr/bin/nrmaos-session`) registered in `/usr/share/xsessions/nrmaos.desktop`, `/etc/alternatives/x-session-manager`, and `/etc/xrdp/startwm.sh`. Detects software rendering (`llvmpipe`) or `xrdp` sessions (`XRDP_SESSION=1`) to configure graceful compositor/animation fallbacks automatically.
- `openbox-rc.xml` — Lightweight window manager configuration keeping `_NET_WM_WINDOW_TYPE_DESKTOP` below client windows, `_NET_WM_WINDOW_TYPE_DOCK` above client windows, and binding `Ctrl+Space` / `Super` to `nrma-shellctl toggle-launcher`.
- `picom.conf` — Lightweight XRender compositor rules for local hardware-accelerated sessions.
- `lightdm-gtk-greeter.conf` — Branded nrmaOS login greeter configuration.
- `10-nrmaos.conf` — `live-config` identity (`hostname=nrmaos`, `username=nrma`).
- `nrmaos-qa-agent.{path,service,py}` — Inert VirtIO-serial responder activated by systemd **only** when `/dev/virtio-ports/org.nrmaos.qatest` is attached by `tests/qemu_boot_test.py`.

# nrmaOS Desktop Shell (`shell/`)

`nrmaos-shell` is the original C++17 + Qt 6 Quick/QML + X11 EWMH desktop environment shell for nrmaOS.

## Architecture

- **nrma Desktop (`Main.qml`)**: Root X11 `_NET_WM_WINDOW_TYPE_DESKTOP` canvas rendering the active wallpaper, procedural fallback gradient, and desktop right-click menu.
- **nrma Top Bar (`Main.qml`)**: Top 36 px `_NET_WM_WINDOW_TYPE_DOCK` panel reserving an EWMH top strut (`_NET_WM_STRUT_PARTIAL`) so maximized windows never overlap the bar. Displays the nrma menu, active X11 window title, quick window tiling actions (`◧` Left, `◨` Right, `⬜` Maximize), Remote Desktop live status badge, App Launcher trigger, Task Switcher badge, theme toggle, notification badge, Control Center trigger, and clock.
- **nrma Dock (`Main.qml`)**: Bottom floating pill panel (`_NET_WM_WINDOW_TYPE_DOCK`, 76 px bottom strut) with pinned applications and live running X11 client windows (`_NET_CLIENT_LIST`).
- **Overlays**:
  - `LauncherView.qml` — Keyboard and mouse searchable App Launcher discovering built-in nrmaOS utilities, `/usr/share/applications/*.desktop`, and Windows `.exe` shortcuts created by `nrma Runtime`.
  - `ControlCenterView.qml` — Quick toggles for Dark/Light theme, Do Not Disturb, Fluid/Reduced Motion, Remote Desktop status, network IP, live memory summary, and audio mixer (when audio hardware exists).
  - `NotificationDrawer.qml` + non-focus-stealing toast popups fed by `NotificationCenter` and `/usr/bin/nrma-notify`.
  - `TaskSwitcherView.qml` — Live X11 window switcher supporting focus, minimize/restore, left/right tiling, maximize, and close (`_NET_CLOSE_WINDOW`).
- **UNIX Domain IPC (`ShellIpcServer` + `bin/nrma-shellctl`)**: Per-user, per-display socket `/tmp/nrmaos-ipc-<uid>/shell-<display>.sock` (`0700` directory permissions) enabling live settings reloads, global Openbox hotkeys (`Ctrl+Space`, `Super`), notifications, and automated QEMU integration tests.

## Building Locally

```sh
cmake -S shell -B shell/build -DCMAKE_BUILD_TYPE=Release
cmake --build shell/build --parallel
ctest --test-dir shell/build --output-on-failure
QT_QPA_PLATFORM=offscreen ./shell/build/nrmaos-shell --self-test
```

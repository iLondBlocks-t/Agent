# nrmaOS First-Party Applications (`apps/`)

Native C++17 + Qt 6 Quick/QML desktop utilities built for nrmaOS without pulling in a heavy prebuilt desktop environment:

- **`nrma-files` (`apps/nrma-files/`)**: Native file manager with Places sidebar, real-time `QStorageInfo` disk usage meter, path bar, instant search filter, folder creation, copy/paste, delete, and built-in `.exe` / `.msi` context menu integration (**Open with nrma Runtime**, **Inspect EXE Compatibility**, **Create App Launcher Shortcut**).
- **`nrma-settings` (`apps/nrma-settings/`)**: Unified System Settings application providing:
  - **Appearance** (Dark/Light theme, accent palette, dock icon size, reduced motion)
  - **nrma Wallpaper Manager** (visual wallpaper grid + custom image path)
  - **Display & Window Management** (live `xrandr` output mode switching)
  - **Remote Desktop** (full `xrdp` + `xorgxrdp` control backed by `/usr/bin/nrma-rdpctl`)
  - **nrma Runtime** (optional Wine installation, PE binary inspector, isolated prefixes, launcher shortcuts)
  - **About nrmaOS** (system hardware, session type, kernel, Debian foundation, and open-source notices)

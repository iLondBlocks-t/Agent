# Windows Application Compatibility (`nrma Runtime`)

## Design Philosophy

nrmaOS includes **nrma Runtime** (`/usr/bin/nrma-runtime`, file manager actions, MIME associations, and **Settings → nrma Runtime**) while keeping the Wine execution engine **optional and uninstalled by default**. This keeps the base live ISO compact and avoids shipping hundreds of megabytes of 32-bit/64-bit Windows libraries to users who only run native applications.

## Honest Compatibility Scope

Wine translates Win32/Win64 API calls to POSIX and X11/OpenGL on the fly. **Compatibility varies significantly by application and is not universal:**

- **Often Compatible**: Standalone 32-bit (`PE32`) and 64-bit (`PE32+`) Win32 desktop utilities, classic installers, and standard GDI/OpenGL tools.
- **Requires Additional Runtime Components**: `.NET` Framework / CLR executables (detected automatically by `nrma-runtime inspect`) may require Wine Mono inside the prefix.
- **Unsupported**: Windows kernel-mode drivers (`Subsystem = Native`), kernel-level anti-cheat engines, UWP / Microsoft Store `.msix` packages, and hardware-DRM protected software.

## Features Implemented

1. **PE Binary Diagnostics (Works Offline Without Wine Installed)**:
   ```sh
   nrma-runtime inspect /path/to/Application.exe
   ```
   Parses the DOS/PE header to report CPU architecture (`x86`, `x86_64`, `ARM64`), `PE32` vs `PE32+` format, Windows GUI vs Console vs Kernel Driver subsystem, and `.NET CLR` directory presence.
2. **EXE / MSI File Associations & Context Menu**:
   - Registers `application/x-ms-dos-executable` and `application/x-msi` to `nrma-runtime.desktop`.
   - In **nrma Files**, right-clicking any `.exe` or `.msi` file offers **Open with nrma Runtime**, **Inspect EXE Compatibility**, and **Create App Launcher Shortcut**.
3. **Isolated Wine Prefixes**:
   ```sh
   nrma-runtime create-prefix my-app --arch win64
   nrma-runtime list-prefixes
   nrma-runtime remove-prefix my-app
   ```
   Prefixes live under `~/.local/share/nrma-runtime/prefixes/<slug>/` so Windows registry changes or DLL overrides in one prefix do not affect others.
4. **Opt-In Wine Engine Installation**:
   Click **Install Optional Wine Engine** in **Settings → nrma Runtime** or run:
   ```sh
   sudo nrma-runtime install-engine
   ```
   This enables `i386` multiarch (when available) and installs Debian's `wine`, `wine64`, and `wine32` packages from the configured official Debian repositories.
5. **Launcher Shortcuts**:
   ```sh
   nrma-runtime create-shortcut /path/to/App.exe --name "My Windows App" --prefix my-app
   ```
   Creates `~/.local/share/applications/nrma-wine-my-windows-app.desktop` and refreshes `nrmaos-shell` so the shortcut appears immediately in **nrma App Launcher**.

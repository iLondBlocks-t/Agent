# nrmaOS

**A lightweight, fluid, open-source `x86_64` desktop operating system.**

nrmaOS combines a minimal **Debian GNU/Linux `stable`** foundation with an original **C++17 + Qt 6 / QML** desktop shell (`nrmaos-shell`), native first-party system applications (`nrma-files`, `nrma-settings`), an optional Windows `.exe` compatibility workflow (`nrma Runtime`), and an integrated, security-hardened **Remote Desktop (`xrdp` + `xorgxrdp`)** stack.

It does not install or reskin a prebuilt desktop environment such as GNOME, KDE Plasma, XFCE, or LXQt.

---

## Key Capabilities

### 1. Original nrmaOS Desktop Environment (`shell/` & `apps/`)
- **nrma Desktop, Top Bar & Dock**: True multi-surface X11 EWMH desktop (`_NET_WM_WINDOW_TYPE_DESKTOP`, `_NET_WM_WINDOW_TYPE_DOCK`, `_NET_WM_STRUT_PARTIAL`) paired with Openbox and adaptive Picom compositing.
- **Dark & Light Themes + Wallpaper Manager**: Five generated 1920x1080 wallpapers, accent palette picker, configurable dock icon size, and automatic software-rendering fallback on VMs and remote RDP sessions.
- **nrma App Launcher & Task Switcher**: Keyboard (`Ctrl+Space`, `Super`, `Alt+Tab`) and mouse navigation, instant app search, and window snapping (`Left`, `Right`, `Maximize`).
- **nrma Control Center & Notifications**: Live system controls, non-focus-stealing notification toasts, notification history drawer, `/usr/bin/nrma-notify`, and `/usr/bin/nrma-shellctl`.
- **Native System Utilities**:
  - **nrma Files (`nrma-files`)**: Places sidebar, storage usage bar, instant filter, folder management, and `.exe`/`.msi` context actions.
  - **nrma Settings (`nrma-settings`)**: Appearance, Wallpaper Manager, Display (`xrandr`), Remote Desktop, nrma Runtime, and About nrmaOS.
  - **nrma Login Experience**: Branded LightDM greeter theme (`nrmaOS-Login`) with live evaluation autologin.

### 2. Integrated Secure Remote Desktop (`remote-desktop/`)
- Native **Settings → Remote Desktop** UI backed by `/usr/bin/nrma-rdpctl`.
- **Secure by Default**:
  - `xrdp` and `xorgxrdp` are **disabled by default**; port `3389` is closed at boot.
  - `ufw` firewall is **enabled by default** (`deny incoming`, `allow outgoing`), scoping RDP when enabled to trusted local RFC1918 subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`).
  - `root` and system (`UID < 1000`) logins are blocked in both `/etc/pam.d/xrdp-sesman` and `/etc/xrdp/sesman.ini`.
  - Enforces `TLSv1.2` / `TLSv1.3` with unique per-machine ECDSA certificates generated on enable (no static private keys baked into the ISO).
  - Never stores plaintext passwords or configures unsafe UPnP router port forwarding.
- Launches an isolated **nrmaOS** desktop session (`/etc/xrdp/startwm.sh` → `/usr/bin/nrmaos-session`) accessible from Windows Remote Desktop (`mstsc.exe`), Android Microsoft Remote Desktop / aFreeRDP, and Linux FreeRDP/Remmina clients.

### 3. Optional Windows `.exe` Compatibility (`runtime/`)
- **Wine remains optional and uninstalled in the base ISO** to keep the image small and fast.
- Offline PE32/PE32+ header inspector (`nrma-runtime inspect <file.exe>`), isolated Wine prefixes (`~/.local/share/nrma-runtime/prefixes/`), `.exe`/`.msi` MIME associations, **Right-click → Open with nrma Runtime** in **nrma Files**, App Launcher `.desktop` shortcuts, and 1-click optional Wine installation from Debian repositories.

---

## Real Measured Benchmarks (QEMU/KVM Automated Verification)

Measured by `tests/qemu_boot_test.py` on GitHub Actions (`ubuntu-24.04` `x86_64`, KVM enabled, 2 vCPUs, 2048 MiB guest RAM, Linux `6.12.118+deb13-amd64`):

| Metric | Measured Value |
|---|---|
| Hybrid Live ISO Size (`BIOS + UEFI`) | **1023.0 MiB** (`1,072,693,248` bytes) |
| `systemd-analyze` Boot Time | **6.422 s** (`2.172 s` kernel + `4.250 s` userspace) |
| Cold VM Boot to Interactive Graphical Desktop | **23.15 s** (includes 3 s boot menu timeout) |
| Idle System RAM Used (`Xorg` + `openbox` + `nrmaos-shell`) | **393.2 MiB** (`1580.4 MiB` available of `1973.6 MiB`) |
| Idle CPU Usage | **0.0%** |
| App Launcher → X11 Window Mapped (`xterm`) | **239.6 ms** |
| External FreeRDP Client → Remote `nrmaos-shell` Session | **2.13 s** (`+147.1 MiB` RAM overhead) |

---

## Repository Structure

```text
.
├── README.md
├── RELEASE_NOTES.md
├── LICENSE
├── CONTRIBUTING.md
├── SECURITY.md
├── docs/
│   ├── architecture.md
│   ├── building.md
│   ├── installation.md
│   ├── rdp.md
│   ├── wine-compatibility.md
│   └── troubleshooting.md
├── auto/               # Debian live-build entrypoint configuration
├── build/              # Canonical image version and volume metadata
├── config/             # Package lists and chroot/binary hooks
├── system/             # X11 session entrypoint, Openbox, Picom, LightDM, QA responder
├── shell/              # Original C++17 + Qt 6 / QML desktop shell & EWMH bridge
├── apps/               # Native Qt 6 nrma Files & nrma Settings applications
├── runtime/            # Optional Wine compatibility manager, PE inspector & MIME rules
├── remote-desktop/     # Hardened xrdp + xorgxrdp controller, PAM rules & Polkit policy
├── installer/          # Live media & hardware readiness inspector
├── scripts/            # Reproducible ISO build & static/unit verification scripts
├── tests/              # Unit tests & full-system QEMU + FreeRDP integration suite
├── assets/             # Original SVG logo & deterministic HD wallpaper generator
└── .github/workflows/
    └── build.yml       # Automated CI build, QEMU verification, artifact & release workflow
```

---

## Quick Start: Build & Test

```sh
# 1. Run static, contract, security, and unit tests
./scripts/test-source.sh

# 2. Build the bootable amd64 hybrid ISO (runs directly on Debian stable or via Docker on Ubuntu)
./scripts/build-iso.sh

# 3. Boot and verify the ISO end-to-end in QEMU (with optional FreeRDP test)
python3 tests/qemu_boot_test.py --iso nrmaos-0.1.0-amd64.iso --require-runtime --require-rdp
```

Prebuilt ISO images, `.sha256` checksums, and `nrmaos-verification-report.json` are automatically built and uploaded as artifacts by [`.github/workflows/build.yml`](.github/workflows/build.yml).

---

## Documentation

- [Technical Architecture & Benchmarks](docs/architecture.md)
- [Building nrmaOS](docs/building.md)
- [Booting, QEMU & USB Media Guide](docs/installation.md)
- [Remote Desktop (RDP) Administration & Security](docs/rdp.md)
- [Windows EXE Compatibility (`nrma Runtime`)](docs/wine-compatibility.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Security Policy](SECURITY.md)
- [Contributing Guidelines](CONTRIBUTING.md)
- [Release Notes (`0.1.0`)](RELEASE_NOTES.md)

## License & Third-Party Transparency

Original nrmaOS source code, shell, applications, scripts, artwork, and documentation are released under the [MIT License](LICENSE). Built ISO images incorporate the **Linux kernel**, **Debian GNU/Linux** packages, **X.Org Server**, **Openbox**, **Picom**, **Mesa**, **LightDM**, **Qt 6**, **xrdp / xorgxrdp**, and **UFW**, each distributed under its respective upstream open-source license (GPL, LGPL, Apache-2.0, MIT, BSD).

# Architecture

## First milestone

The first milestone is a reproducible Debian Live image for amd64, with Xorg providing the display server, Openbox providing lightweight window management, LightDM managing the local graphical session, and the original nrmaOS shell implemented with Qt 6/QML. This deliberately avoids installing a large prebuilt desktop environment. Debian Live's `live-build` tool assembles the image from tracked configuration and package lists.

The live image is an evaluation environment. It is not yet an installer or a persistent installed system. Account creation, upgrades, data persistence, and machine-specific firmware handling need dedicated design and tests before the image can be described as a release-ready OS.

## Component boundaries

- `auto/`, `config/`, and `build/` describe image construction and package selection.
- `shell/` contains the independently buildable Qt/QML desktop shell.
- `system/` is reserved for system integration that should remain separate from the shell.
- `apps/` is reserved for first-party desktop utilities.
- `runtime/` is reserved for optional Wine-based Windows application support.
- `remote-desktop/` is reserved for xrdp integration and its security controls.
- `tests/` and `scripts/` contain validation and repeatable build helpers.

Empty planned components are not evidence that their features exist. The roadmap and feature status are tracked in the README and the component documents.

## Planned phases

1. Build a minimal Debian-based live ISO and verify boot and shell startup.
2. Expand the original shell and implement window-management integration.
3. Add optional nrma Runtime/Wine support with truthful compatibility information.
4. Add xrdp and a native Remote Desktop settings panel with secure defaults.
5. Add and test system utilities, installer/persistence decisions, and accessibility.
6. Measure resource use and perform security and QEMU boot checks.
7. Publish a versioned release with ISO, SHA256 checksum, and release notes.

A feature is complete only when its implementation and tests demonstrate the behavior.

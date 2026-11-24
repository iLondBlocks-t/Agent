# nrmaOS

**A lightweight, open-source Linux-based desktop project.** nrmaOS is being built incrementally on Debian Live with an original Qt 6/QML shell. The first milestone targets a bootable x86_64 live ISO and an interactive local desktop session.

> **Status:** early development. The shell compiles and passes a QML offscreen startup check on an ARM64 Ubuntu host. The amd64 ISO build and QEMU boot have not yet been verified. Do not treat this repository as a finished operating system. RDP, Wine integration, a disk installer, persistent installation, and several planned system applications are not implemented in the first milestone.

## What this repository builds

The initial image is intended to boot as a live system using Debian stable, Xorg, Openbox, LightDM, and the nrmaOS shell. The shell is a separate Qt/QML application; this project does not re-skin or install a full prebuilt desktop environment. The first session is designed for local evaluation and is not a hardened installed system.

The project does not currently ship an ISO in the Git repository. GitHub Actions builds the ISO and publishes it as a workflow artifact only after the workflow completes successfully. Build results and measurements must come from real runs; no benchmark claims are made here.

## Build locally

On a Debian-based x86_64 host with `live-build`, `debootstrap`, `xorriso`, and the required system build tools installed:

```sh
./scripts/build-iso.sh
```

The script configures Debian Live and builds an ISO hybrid image. The output name is determined by live-build and is written in the project directory. For the complete package prerequisites, disk-space guidance, and troubleshooting, see [docs/building.md](docs/building.md).

You can also run the source checks:

```sh
./scripts/test-source.sh
```

These checks validate repository structure and selected configuration defaults. They do not prove that an ISO boots. The QEMU boot check is documented separately and remains a required acceptance test before calling a release complete.

## Security and scope

RDP is not installed or enabled in this first milestone. Wine is not included in the base image. Do not expose an nrmaOS live system to an untrusted network or use it to store sensitive data. See [SECURITY.md](SECURITY.md) and [docs/rdp.md](docs/rdp.md) for the current status and planned safeguards.

## Project documents

- [Architecture](docs/architecture.md)
- [Build instructions](docs/building.md)
- [Installation and live-session notes](docs/installation.md)
- [Remote Desktop status and security design](docs/rdp.md)
- [Wine compatibility status](docs/wine-compatibility.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)

## License

Original project source and documentation are released under the MIT License. The ISO combines Debian packages and other third-party components under their respective licenses; see the package copyright notices and each upstream project's license before redistribution. Technical documentation must identify the Linux kernel, Debian base, and bundled third-party components transparently.

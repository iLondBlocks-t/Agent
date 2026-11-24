# Building nrmaOS

## Supported target

The initial configuration targets an amd64/x86_64 Debian Live ISO hybrid image and follows the Debian `stable` suite alias. The exact package versions therefore follow the Debian stable repositories used at build time; builds made on different dates are not guaranteed to be bit-for-bit identical.

Security updates remain enabled during package installation and in the resulting live session. The configuration avoids the legacy `stable/updates` entry emitted by older live-build packages and adds Debian's `stable-security` suite explicitly for both chroot and binary image in `config/archives/`.

The build pins `--initsystem systemd` and installs `live-config-systemd`, avoiding live-build's SysV init backend. It also disables kernel auto-discovery and installs `linux-image-amd64` from the package list explicitly. These options are documented by the [Debian `lb_config` manual](https://manpages.debian.org/testing/live-build/lb_config.1.en.html). Debian's [SourcesList documentation](https://wiki.debian.org/SourcesList) shows the modern stable security suite naming pattern; `stable-security` is used here so it follows the stable alias.

## Prerequisites

Use a Debian-based x86_64 build host with working network access, root/sudo privileges, and the Debian Live build tools. At minimum, install `live-build`, `debootstrap`, `xorriso`, `squashfs-tools`, `isolinux`, and `syslinux-common` from the host's configured Debian repositories. Keep several gigabytes of free disk space for package downloads, the chroot, and the generated image. The exact requirement depends on package mirrors and build caches.

## Build

```sh
git clone https://github.com/iLondBlocks-t/Agent.git
cd Agent
./scripts/build-iso.sh
```

The project script calls the tracked `auto/config` setup and then `lb build`. Run it from a clean checkout. A failed or interrupted build may leave an incomplete work directory; use the script's documented clean option or remove generated build state before retrying. Do not run cleanup against a directory containing personal files.

The expected output is a non-empty live-build ISO-hybrid image in the repository root. The GitHub Actions workflow validates that an ISO file exists, calculates SHA256, and uploads the image plus checksum as a downloadable workflow artifact. The workflow artifact is not the same as a tagged GitHub Release.

## Checks and boot testing

Run `./scripts/test-source.sh` for lightweight checks of repository files and security defaults. This does not build or boot an image.

For a real boot check, use QEMU on a machine with virtualization support or software emulation. Start the ISO in a disposable VM with at least 2 GiB RAM and a virtual display. Confirm that the Debian Live boot completes, LightDM starts, the nrmaOS session appears, mouse/keyboard input works, and the Files and Terminal launchers respond. Record QEMU version, host architecture, memory, command line, and the observed result. A build artifact alone is not proof of successful boot.

Do not attach a host disk or pass through sensitive devices to an untrusted image. For safety, use an isolated VM and do not enable network access unless the test requires it.

## Reproducibility and provenance

The repository pins the target to Debian's `stable` suite alias rather than a point-release snapshot. This gives maintainability but means later builds can resolve newer package versions. Build logs, package manifests, source revisions, ISO checksums, and the Debian suite should be retained for release candidates. Reproducible configuration is a goal; bit-for-bit reproducibility has not yet been demonstrated.

The official Debian Live Manual documents the `lb config` and `lb build` workflow and the generation of ISO-hybrid images: [Debian Live Manual](https://live-team.pages.debian.net/live-manual/html/live-manual.en.html). See Debian's [release information](https://www.debian.org/releases/) for the current stable suite.

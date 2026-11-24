# Building nrmaOS

## Target Image

nrmaOS builds an `x86_64` (`amd64`) bootable hybrid ISO image (`nrmaos-0.1.0-amd64.iso`) based on **Debian GNU/Linux `stable`** using official Debian `live-build`.

- **Bootloaders**: Both `syslinux`/`isolinux` (Legacy BIOS) and `grub-efi` (`x86_64` and `ia32` UEFI) are embedded in a single ISO-hybrid image.
- **Init & Kernel**: `systemd` (`live-config-systemd`) + `linux-image-amd64` (`--linux-packages "linux-image"`).
- **Security Updates**: Official Debian `<codename>-security` and `<codename>-updates` repositories are enabled during build and inside the live system.
- **Reproducibility Note**: Configuration, package lists, hooks, and source trees are deterministically tracked in Git. Because `live-build` resolves current packages from Debian `stable` and `stable-security` mirrors at build time, builds executed on different dates may incorporate newer upstream security updates and are therefore reproducibly configured rather than bit-for-bit identical across mirror updates.

## Host Requirements

- **Architecture**: `x86_64` (`amd64`) Linux host
- **Disk Space**: At least 8 GiB free disk space
- **Memory**: 4 GiB+ RAM recommended for parallel Qt 6 C++ compilation and SquashFS compression
- **Operating System**:
  - **Native Debian `stable`**: Runs `lb config` and `lb build` directly when `live-build`, `debootstrap`, `squashfs-tools`, `xorriso`, `isolinux`, `syslinux`, `syslinux-common`, `syslinux-efi`, `grub-common`, `grub-pc-bin`, `grub-efi-amd64-bin`, `grub-efi-ia32-bin`, `mtools`, `dosfstools`, `cpio`, `fdisk`, `rsync`, and `python3` are installed.
  - **Ubuntu / Other Linux Distributions**: Ubuntu's `universe` package archive contains an incompatible legacy `live-build` (`3.0~a57`). `./scripts/build-iso.sh` automatically detects non-Debian hosts and runs the build inside an official `debian:stable` Docker container (`docker run --privileged ...`).

## Step-by-Step Local Build

```sh
git clone https://github.com/iLondBlocks-t/Agent.git
cd Agent

# 1. Run static, security, and unit checks
./scripts/test-source.sh

# 2. Build the hybrid ISO and SHA-256 checksum
./scripts/build-iso.sh
```

Upon completion, the repository root contains:
- `nrmaos-0.1.0-amd64.iso`
- `nrmaos-0.1.0-amd64.iso.sha256`

## Automated GitHub Actions Pipeline (`.github/workflows/build.yml`)

Every push and pull request runs `.github/workflows/build.yml` on `ubuntu-24.04` (`x86_64`), which:
1. Executes `./scripts/test-source.sh` (repository structure, security invariants, shell contracts, and Python unit tests).
2. Compiles `shell/` (`nrmaos-shell`) and `apps/` (`nrma-files`, `nrma-settings`) with CMake/GCC and runs `QT_QPA_PLATFORM=offscreen ... --self-test`.
3. Builds `nrmaos-0.1.0-amd64.iso` inside an official `debian:stable` environment via `./scripts/build-iso.sh`.
4. Verifies El Torito BIOS/UEFI boot catalog entries with `xorriso` and validates `nrmaos-0.1.0-amd64.iso.sha256`.
5. Boots the ISO in `qemu-system-x86_64` (`tests/qemu_boot_test.py`) to verify the live graphical desktop, window management, launcher, notifications, firewall defaults, `nrma Runtime` EXE workflow, `xrdp` root-login denial, and a real external FreeRDP client session, saving measured telemetry to `nrmaos-verification-report.json`.
6. Publishes the ISO, `.sha256` checksum, and JSON verification report as downloadable GitHub Actions artifacts (`nrmaos-amd64-live-iso`).

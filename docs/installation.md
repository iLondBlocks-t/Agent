# Booting & Running nrmaOS

## Hybrid Live ISO (BIOS + UEFI)

nrmaOS builds an `amd64` (`x86_64`) hybrid ISO image (`nrmaos-0.1.0-amd64.iso`) equipped with both **ISOLINUX/Syslinux** (Legacy BIOS) and **GRUB EFI** (`x86_64` and `ia32` UEFI).

This release runs as a non-destructive **Live Operating System**:
- Booting the ISO in a virtual machine or from a USB flash drive does **not** modify internal disks automatically.
- Changes made inside the live RAM overlay reset across reboots unless saved to an explicitly mounted external volume.
- Run `nrma-installer` in a terminal to inspect current boot firmware mode (`UEFI` vs `Legacy BIOS`), total RAM, and detected block devices read-only.

## Recommended Minimum Hardware / VM Resources

- **Architecture**: `x86_64` (`amd64`) 64-bit processor
- **Memory**: 1.5 GiB RAM minimum (2 GiB+ recommended, especially if enabling concurrent RDP sessions or installing optional Wine packages)
- **Graphics**: Any KMS/DRM GPU supported by Linux & Mesa, or VESA/EFI framebuffer in virtual machines

## Testing in QEMU

1. Verify the SHA-256 checksum first:
   ```sh
   sha256sum -c nrmaos-0.1.0-amd64.iso.sha256
   ```
2. Boot the ISO in QEMU (with KVM acceleration on Linux):
   ```sh
   qemu-system-x86_64 \
     -enable-kvm -cpu host \
     -m 2048 -smp 2 \
     -cdrom nrmaos-0.1.0-amd64.iso \
     -boot d \
     -vga virtio
   ```
   To forward host TCP port `13389` to guest RDP port `3389` for testing Remote Desktop from the host:
   ```sh
   qemu-system-x86_64 \
     -enable-kvm -cpu host \
     -m 2048 -smp 2 \
     -cdrom nrmaos-0.1.0-amd64.iso \
     -boot d \
     -vga std \
     -netdev user,id=net0,hostfwd=tcp:127.0.0.1:13389-:3389 \
     -device virtio-net-pci,netdev=net0
   ```

## Writing to a USB Flash Drive

Verify the target block device carefully (`lsblk`) before writing, as `dd` overwrites the selected removable drive:

```sh
sudo dd if=nrmaos-0.1.0-amd64.iso of=/dev/sdX bs=4M status=progress oflag=sync
```
On Windows or macOS, write the ISO in **DD / Raw ISO-Hybrid mode** using Rufus or BalenaEtcher.

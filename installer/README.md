# Live Environment & Readiness Helper (`installer/`)

`nrma-installer` inspects whether nrmaOS is booted from live removable media, reports UEFI vs Legacy BIOS boot mode, checks available RAM, and lists block devices read-only (`lsblk -J`).

This release intentionally ships as a non-destructive hybrid Live ISO (BIOS + UEFI) rather than performing unattended disk repartitioning. See [docs/installation.md](../docs/installation.md) for verified bootable USB instructions.

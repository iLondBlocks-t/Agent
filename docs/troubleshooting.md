# Troubleshooting

## Build fails before downloading packages

Check that the host has `live-build` and `debootstrap` installed, that it is amd64/x86_64, and that it has network access and sufficient free disk space. Preserve the complete build log; the last error line may not contain the root cause.

## Build fails while resolving packages

Debian package mirrors or the `stable` suite may be temporarily unavailable. Retry only after confirming the failure is not caused by a package name or configuration error. Keep the failure log and record the date and mirror.

## ISO exists but does not boot

An ISO file existing does not establish bootability. Verify its SHA256, test in QEMU with a virtual display, and check whether the boot menu appears. Try both BIOS and UEFI only if the image configuration includes the respective bootloader. Report the QEMU version and full error output.

## Graphical session does not appear

Check the live boot log and LightDM/Xorg logs from the VM. Confirm the package list contains the display server, display manager, window manager, Qt runtime modules, and nrmaOS shell. A text-only boot or an Openbox background without the shell is a failed desktop test, not a completed feature.

## No RDP or Wine option

These features are not implemented in the first milestone. Do not install packages or expose network ports manually and assume that this creates a supported nrmaOS feature.

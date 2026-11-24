# Installation and live-session notes

The first milestone is a live ISO for testing. It does **not** install nrmaOS to a disk and does not promise persistent files after reboot. Do not treat it as an installation image.

Boot it in a disposable QEMU virtual machine first. If testing on physical hardware, use removable media only after verifying the ISO checksum and ensure no internal disk is selected for any write operation. The current project has no disk installer, partitioner, encrypted install workflow, or recovery tool.

The live desktop may use local automatic login to make evaluation convenient. Do not expose this session to an untrusted network. RDP is not included or enabled in the first milestone. For persistent use, wait for a separately documented installer design and a tested release instead of improvising partition changes.

# Contributing to nrmaOS

Thank you for helping build nrmaOS. The project is early-stage, so changes should be small, reviewable, and tested against the exact behavior they claim to provide.

## Development principles

- Keep the Debian base minimal and avoid adding a complete prebuilt desktop environment.
- Separate the shell, system configuration, optional runtime, and remote-desktop components.
- Do not add decorative controls that have no working behavior.
- Keep RDP disabled by default and never introduce plaintext credentials or automatic public port forwarding.
- Do not claim a build, boot, security, or performance result unless it was actually measured.
- Preserve third-party notices and check redistribution terms for all packages and assets.

## Changes and checks

Before opening a pull request, run `./scripts/test-source.sh`. If you change the ISO build configuration, build it with `./scripts/build-iso.sh` on a supported Debian-based x86_64 host and attach the complete build log to the pull request. If the build succeeds, verify the ISO in QEMU and report the exact environment and result. A source-only test is not a substitute for a boot test.

Please describe the motivation, files changed, commands run, and any known limitations. Do not commit generated ISOs, credentials, signing keys, private tokens, or local build caches.

## Licensing

By contributing, you agree that your contributions to nrmaOS are distributed under the repository's MIT License, unless a different license is explicitly stated for a specific contribution. Third-party software keeps its own license.

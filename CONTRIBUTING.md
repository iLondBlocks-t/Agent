# Contributing to nrmaOS

Thank you for contributing to **nrmaOS**. Every change must preserve our core engineering standards: lightweight footprint, original nrmaOS branding, real working controls, secure defaults, and verified test results.

## Core Engineering Rules

1. **Original Desktop Shell**: Do not replace `nrmaos-shell` with a reskinned GNOME, KDE, XFCE, or LXQt desktop metapackage. Keep system integrations modular across `shell/`, `apps/`, `system/`, `runtime/`, and `remote-desktop/`.
2. **No Decorative / Fake UI Controls**: Every button, slider, toggle, and menu action in QML must connect to real OS behavior (or clearly report when hardware such as an audio mixer is absent).
3. **Remote Desktop Security Invariants**:
   - `xrdp` and `xorgxrdp` must ship **disabled by default**.
   - `root` and system accounts (`UID < 1000`) must remain blocked via PAM and `sesman.ini`.
   - Never pass passwords via command-line arguments or persist plaintext passwords on disk.
   - Never add UPnP / NAT-PMP automatic router port forwarding.
4. **Optional Wine Footprint**: Keep Wine out of `config/package-lists/nrmaos.list.chroot` so the base ISO stays small; maintain opt-in installation through `nrma-runtime`.
5. **Measured Claims Only**: Never invent performance benchmarks or claim compatibility that has not been measured in QEMU or on real hardware.

## Pre-Submission Checklist

1. Run repository static and unit tests:
   ```sh
   ./scripts/test-source.sh
   ```
2. Compile and run offscreen QML self-tests when modifying `shell/` or `apps/`:
   ```sh
   cmake -S shell -B /tmp/shell-build && cmake --build /tmp/shell-build --parallel
   QT_QPA_PLATFORM=offscreen /tmp/shell-build/nrmaos-shell --self-test

   cmake -S apps -B /tmp/apps-build && cmake --build /tmp/apps-build --parallel
   QT_QPA_PLATFORM=offscreen /tmp/apps-build/nrma-files --self-test
   QT_QPA_PLATFORM=offscreen /tmp/apps-build/nrma-settings --self-test
   ```
3. Build the hybrid ISO (`./scripts/build-iso.sh`) or open a Pull Request so GitHub Actions builds the ISO and runs `tests/qemu_boot_test.py` end-to-end.

## License

Contributions to original nrmaOS code and documentation are licensed under the [MIT License](LICENSE). Third-party packages included in built ISO images remain governed by their respective upstream open-source licenses.

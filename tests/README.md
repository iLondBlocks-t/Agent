# Verification & Test Suites (`tests/`)

nrmaOS combines fast static/unit verification with full-system QEMU + FreeRDP integration testing:

1. `./scripts/test-source.sh` — Validates repository layout, `live-build` flags, Wine optionality, UPnP prohibition, shell static contracts (`shell/tests/test_shell_contract.py`), and unit tests (`tests/test_system_units.py`).
2. CMake + Offscreen QML Smoke Checks — Compiles `nrmaos-shell`, `nrma-files`, and `nrma-settings` and runs `--self-test` under `QT_QPA_PLATFORM=offscreen`.
3. `tests/qemu_boot_test.py` — Boots the built hybrid ISO inside `qemu-system-x86_64`, verifies `graphical.target`, `Xorg`, `openbox`, and `nrmaos-shell` X11 window mapping, exercises `nrma-shellctl` app launching and `nrma-notify`, verifies `ufw` incoming deny default and `xrdp` disabled default, tests `nrma-runtime` PE64 inspection + prefix/shortcut creation, enables `nrma-rdpctl`, verifies `root` RDP login is rejected, connects a real `xfreerdp` client from the host to launch a remote `nrmaos-shell` session over `xorgxrdp`, and writes measured resource benchmarks to `nrmaos-verification-report.json`.

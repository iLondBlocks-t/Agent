#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT"

fail() { echo "FAIL: $*" >&2; exit 1; }
need_file() { [ -f "$1" ] || fail "missing file: $1"; }
need_dir() { [ -d "$1" ] || fail "missing directory: $1"; }

# Required repository layout
need_file README.md
need_file LICENSE
need_file SECURITY.md
need_file CONTRIBUTING.md
need_file auto/config
need_file build/live-build.env
need_file scripts/stage-chroot.sh
need_file scripts/build-iso.sh
need_file .github/workflows/build.yml
need_file config/package-lists/nrmaos.list.chroot
need_file config/hooks/live/050-nrmaos-setup.hook.chroot
need_file config/hooks/live/090-nrmaos-bootloader.hook.binary
need_file system/nrmaos-session
need_file system/10-nrmaos.conf
need_file system/openbox-rc.xml
need_file shell/CMakeLists.txt
need_file tests/qemu_boot_test.py

for d in docs build config system shell apps runtime remote-desktop installer scripts tests assets; do
    need_dir "$d"
done

PACKAGE_LIST=config/package-lists/nrmaos.list.chroot
grep -qx 'linux-image-amd64' "$PACKAGE_LIST" || fail "amd64 kernel package missing"
grep -qx 'live-config-systemd' "$PACKAGE_LIST" || fail "systemd live-config backend missing"
grep -qx 'libgl1-mesa-dri' "$PACKAGE_LIST" || fail "Mesa DRI acceleration/fallback missing"
grep -q -- '--linux-packages "linux-image"' auto/config || fail "Debian live-build kernel copying (--linux-packages linux-image) must be enabled"
grep -q -- '--initsystem systemd' auto/config || fail "systemd init system must be selected explicitly"
grep -q -- '--debian-installer false' auto/config || fail "Debian Installer must be disabled with a supported value"
grep -q -- '--security true' auto/config || fail "Debian security updates must stay enabled"
grep -qx 'qml6-module-qtqml-workerscript' "$PACKAGE_LIST" || fail "QtQml.WorkerScript runtime missing"
grep -qx 'qml6-module-qtquick-templates' "$PACKAGE_LIST" || fail "QtQuick.Templates runtime missing"
grep -q '/usr/bin/nrmaos-session' config/hooks/live/050-nrmaos-setup.hook.chroot || fail "live session wrapper path mismatch"
grep -q '/usr/bin/nrmaos-shell' system/nrmaos-session || fail "nrmaos-session must exec /usr/bin/nrmaos-shell"

# Never allow unsafe automatic UPnP / router port forwarding
if grep -RniE --exclude=test-source.sh 'upnpc|miniupnpc|natpmpc' config system remote-desktop scripts 2>/dev/null; then
    fail "automatic router port forwarding tools must never be included"
fi

# Verify Wine is never forced into the base package list (must stay optional)
if grep -qxE 'wine|wine64|wine32' "$PACKAGE_LIST"; then
    fail "Wine must remain optional and not preinstalled in the base ISO package list"
fi

python3 -m py_compile system/nrmaos-qa-agent.py tests/qemu_boot_test.py
python3 shell/tests/test_shell_contract.py

if [ -f tests/test_system_units.py ]; then
    python3 -m unittest discover -s tests -p 'test_*.py' -v
fi

echo "PASS: repository layout, live-build config, security invariants, and unit contracts"

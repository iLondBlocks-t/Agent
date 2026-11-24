#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT"

fail() { echo "FAIL: $*" >&2; exit 1; }
need_file() { [ -f "$1" ] || fail "missing file: $1"; }

need_file README.md
need_file LICENSE
need_file SECURITY.md
need_file CONTRIBUTING.md
need_file auto/config
need_file scripts/build-iso.sh
need_file .github/workflows/build-iso.yml
need_file config/package-lists/nrmaos.list.chroot
need_file config/archives/nrmaos-security.list.chroot
need_file config/archives/nrmaos-security.list.binary
need_file shell/CMakeLists.txt
need_file config/hooks/live/050-nrmaos-setup.hook.chroot

PACKAGE_LIST=config/package-lists/nrmaos.list.chroot
grep -qx 'linux-image-amd64' "$PACKAGE_LIST" || fail "amd64 kernel package missing"
grep -qx 'qml6-module-qtqml-workerscript' "$PACKAGE_LIST" || fail "QtQml.WorkerScript runtime missing"
grep -qx 'qml6-module-qtquick-templates' "$PACKAGE_LIST" || fail "QtQuick.Templates runtime missing"
grep -q '/usr/bin/nrmaos-shell' config/hooks/live/050-nrmaos-setup.hook.chroot || fail "live session shell executable path mismatch"
grep -qx 'deb http://security.debian.org/debian-security stable-security main' config/archives/nrmaos-security.list.chroot || fail "Debian stable-security source missing"
grep -qx 'deb http://security.debian.org/debian-security stable-security main' config/archives/nrmaos-security.list.binary || fail "runtime Debian stable-security source missing"

if grep -RniE 'xrdp|xorgxrdp' config/package-lists 2>/dev/null; then
    fail "RDP packages must not be present in the first-milestone base image"
fi
if grep -RniE 'port.?forward|3389' config 2>/dev/null; then
    fail "unexpected RDP port/forwarding configuration in initial image"
fi

if command -v shfmt >/dev/null 2>&1; then
    find auto scripts config/hooks -type f \( -name '*.sh' -o -name '*.hook.chroot' -o -path 'auto/config' \) -print0 | xargs -0 -r shfmt -d
fi

python3 shell/tests/test_shell_contract.py

echo "PASS: source structure and first-milestone security defaults"
echo "NOTE: this check does not build or boot an ISO."

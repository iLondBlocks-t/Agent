#!/bin/sh
set -eu

INC="${1:?chroot include path required}"
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

mkdir -p "$INC/usr/bin"
install -m 0755 "$SCRIPT_DIR/nrma-installer" "$INC/usr/bin/nrma-installer"

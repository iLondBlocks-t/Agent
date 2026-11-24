#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
ISO_NAME=live-image-amd64.hybrid.iso

cd "$ROOT_DIR"

HOST_ARCH=$(dpkg --print-architecture 2>/dev/null || uname -m)
if [ "$HOST_ARCH" != "amd64" ] && [ "$HOST_ARCH" != "x86_64" ]; then
    echo "Error: this configuration builds amd64 and requires an x86_64/amd64 host." >&2
    echo "Use an amd64 machine or the GitHub Actions workflow." >&2
    exit 2
fi

if ! command -v lb >/dev/null 2>&1; then
    echo "Error: live-build (lb) is required. Install it before building." >&2
    exit 1
fi

# Populate the chroot-local source include consumed by the build hook.
SHELL_SOURCE=config/includes.chroot/usr/src/nrmaos
mkdir -p "$SHELL_SOURCE"
cp shell/CMakeLists.txt "$SHELL_SOURCE/"
cp -R shell/src shell/qml "$SHELL_SOURCE/"

# auto/config applies the amd64, stable, main, and iso-hybrid settings.
lb config

if [ "$(id -u)" -eq 0 ]; then
    lb build
elif command -v sudo >/dev/null 2>&1; then
    sudo lb build
else
    echo "Error: live-build needs root privileges to build; run as root or install sudo." >&2
    exit 1
fi

ISO_PATH="$ROOT_DIR/$ISO_NAME"
if [ ! -s "$ISO_PATH" ]; then
    echo "Error: expected a non-empty ISO at $ISO_PATH" >&2
    exit 1
fi

printf 'Built ISO: %s (%s bytes)\n' "$ISO_PATH" "$(wc -c < "$ISO_PATH" | tr -d ' ')"

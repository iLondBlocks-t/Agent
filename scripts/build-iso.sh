#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT_DIR"

if [ -f build/live-build.env ]; then
    # shellcheck disable=SC1091
    . ./build/live-build.env
fi

LIVE_ISO_RAW="live-image-amd64.hybrid.iso"
FINAL_ISO="${NRMAOS_ISO_BASENAME:-nrmaos-0.1.0-amd64}.iso"

HOST_ARCH=$(dpkg --print-architecture 2>/dev/null || uname -m)
if [ "$HOST_ARCH" != "amd64" ] && [ "$HOST_ARCH" != "x86_64" ]; then
    echo "Error: this configuration builds amd64 and requires an x86_64/amd64 host." >&2
    echo "Use an amd64 machine or the GitHub Actions workflow." >&2
    exit 2
fi

emit_gh_error_from_log() {
    log_file="$1"
    if [ "${GITHUB_ACTIONS:-}" = "true" ] && [ -f "$log_file" ]; then
        tail_msg=$(tail -n 65 "$log_file" | sed 's/%/%25/g; s/\r/%0D/g' | awk '{printf "%s%%0A", $0}')
        printf '::error title=live-build failure::%s\n' "$tail_msg"
    fi
}

# Detect whether we are already on native Debian with genuine Debian live-build.
IS_NATIVE_DEBIAN=0
if [ -r /etc/os-release ]; then
    # shellcheck disable=SC1091
    . /etc/os-release
    if [ "${ID:-}" = "debian" ]; then
        IS_NATIVE_DEBIAN=1
    fi
fi

# On non-Debian Linux hosts (such as Ubuntu GitHub Actions runners whose universe
# live-build package is an ancient 3.0~a57 snapshot), automatically run inside an
# official Debian stable container when Docker is available.
if [ "${NRMAOS_IN_BUILD_CONTAINER:-0}" != "1" ] && [ "$IS_NATIVE_DEBIAN" != "1" ]; then
    if command -v docker >/dev/null 2>&1; then
        echo "Non-Debian host detected (${ID:-unknown}); running live-build inside official debian:stable container..."
        HOST_UID=$(id -u)
        HOST_GID=$(id -g)
        docker run --rm --privileged \
            -e DEBIAN_FRONTEND=noninteractive \
            -e NRMAOS_IN_BUILD_CONTAINER=1 \
            -e GITHUB_ACTIONS="${GITHUB_ACTIONS:-}" \
            -e HOST_UID="$HOST_UID" \
            -e HOST_GID="$HOST_GID" \
            -v "$ROOT_DIR:/workspace" \
            -w /workspace \
            debian:stable \
            /bin/sh -ec '
                apt-get update
                apt-get install -y --no-install-recommends \
                    live-build \
                    debootstrap \
                    debian-archive-keyring \
                    ca-certificates \
                    squashfs-tools \
                    xorriso \
                    isolinux \
                    syslinux \
                    syslinux-common \
                    syslinux-efi \
                    grub-common \
                    grub-pc-bin \
                    grub-efi-amd64-bin \
                    grub-efi-ia32-bin \
                    mtools \
                    dosfstools \
                    cpio \
                    fdisk \
                    rsync \
                    python3
                ./scripts/build-iso.sh
                rm -rf chroot cache binary .build
                chown "$HOST_UID:$HOST_GID" ./*.iso ./*.sha256 live-build.log 2>/dev/null || true
            '
        exit 0
    fi
fi

if ! command -v lb >/dev/null 2>&1; then
    echo "Error: live-build (lb) is required. Install it on Debian or install Docker." >&2
    exit 1
fi

run_root() {
    if [ "$(id -u)" -eq 0 ]; then
        "$@"
    elif command -v sudo >/dev/null 2>&1; then
        sudo "$@"
    else
        echo "Error: live-build needs root privileges; run as root or install sudo." >&2
        exit 1
    fi
}

# Clean any leftover chroot/binary state before staging fresh files
if [ -d chroot ] || [ -d binary ] || [ -d .build ]; then
    run_root lb clean --purge || true
fi

./scripts/stage-chroot.sh

chmod +x auto/config config/hooks/live/*.chroot config/hooks/live/*.binary 2>/dev/null || true

lb config

set +e
run_root lb build 2>&1 | tee live-build.log
BUILD_RC=$?
set -e

if [ "$BUILD_RC" -ne 0 ]; then
    emit_gh_error_from_log live-build.log
    exit "$BUILD_RC"
fi

if [ ! -s "$ROOT_DIR/$LIVE_ISO_RAW" ]; then
    echo "Error: expected non-empty ISO at $ROOT_DIR/$LIVE_ISO_RAW" >&2
    emit_gh_error_from_log live-build.log
    exit 1
fi

cp -f "$ROOT_DIR/$LIVE_ISO_RAW" "$ROOT_DIR/$FINAL_ISO"
sha256sum "$FINAL_ISO" > "$FINAL_ISO.sha256"
sha256sum "$LIVE_ISO_RAW" > "$LIVE_ISO_RAW.sha256"

ISO_BYTES=$(wc -c < "$FINAL_ISO" | tr -d ' ')
printf 'Built ISO: %s (%s bytes)\n' "$ROOT_DIR/$FINAL_ISO" "$ISO_BYTES"
cat "$FINAL_ISO.sha256"

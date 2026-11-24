#!/bin/sh
# Stages nrmaOS source trees and system configuration into config/includes.chroot/
# prior to running Debian live-build.
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT_DIR"

INC="config/includes.chroot"

# Clean previously staged directories while preserving .gitkeep
rm -rf "$INC/etc" "$INC/usr/bin" "$INC/usr/lib" "$INC/usr/share"
find "$INC/usr/src/nrmaos" -mindepth 1 ! -name '.gitkeep' -exec rm -rf {} + 2>/dev/null || true

mkdir -p \
    "$INC/usr/src/nrmaos/shell" \
    "$INC/usr/bin" \
    "$INC/usr/lib/nrmaos" \
    "$INC/etc/live/config.conf.d" \
    "$INC/etc/xdg/nrmaos" \
    "$INC/etc/systemd/system"

# 1. Stage Qt/QML shell C++ source for chroot compilation
cp shell/CMakeLists.txt "$INC/usr/src/nrmaos/shell/"
cp -R shell/src shell/qml "$INC/usr/src/nrmaos/shell/"

# 2. Stage native first-party Qt/QML apps if present
if [ -f apps/CMakeLists.txt ]; then
    mkdir -p "$INC/usr/src/nrmaos/apps"
    cp -R apps/* "$INC/usr/src/nrmaos/apps/"
fi

# 3. Stage system session, Openbox, compositor, live-config, and QA responder
install -m 0755 system/nrmaos-session "$INC/usr/bin/nrmaos-session"
install -m 0644 system/10-nrmaos.conf "$INC/etc/live/config.conf.d/10-nrmaos.conf"
install -m 0644 system/openbox-rc.xml "$INC/etc/xdg/nrmaos/openbox-rc.xml"
if [ -f system/picom.conf ]; then
    install -m 0644 system/picom.conf "$INC/etc/xdg/nrmaos/picom.conf"
fi
if [ -f system/lightdm-gtk-greeter.conf ]; then
    install -d -m 0755 "$INC/etc/lightdm"
    install -m 0644 system/lightdm-gtk-greeter.conf "$INC/etc/lightdm/lightdm-gtk-greeter.conf"
fi
install -m 0755 system/nrmaos-qa-agent.py "$INC/usr/lib/nrmaos/nrmaos-qa-agent.py"
install -m 0644 system/nrmaos-qa-agent.path "$INC/etc/systemd/system/nrmaos-qa-agent.path"
install -m 0644 system/nrmaos-qa-agent.service "$INC/etc/systemd/system/nrmaos-qa-agent.service"

# 4. Stage CLI helpers from shell/bin, runtime/, remote-desktop/, installer/, assets/
if [ -d shell/bin ]; then
    for f in shell/bin/*; do
        [ -f "$f" ] && install -m 0755 "$f" "$INC/usr/bin/$(basename "$f")"
    done
fi

if [ -x runtime/install-into-chroot.sh ]; then
    runtime/install-into-chroot.sh "$INC"
fi

if [ -x remote-desktop/install-into-chroot.sh ]; then
    remote-desktop/install-into-chroot.sh "$INC"
fi

if [ -x installer/install-into-chroot.sh ]; then
    installer/install-into-chroot.sh "$INC"
fi

if [ -x assets/install-into-chroot.sh ]; then
    assets/install-into-chroot.sh "$INC"
fi

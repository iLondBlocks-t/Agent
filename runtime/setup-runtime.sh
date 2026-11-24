#!/bin/sh
# Runs inside chroot during ISO build to register MIME and desktop associations for .exe/.msi.
set -eu

if command -v update-mime-database >/dev/null 2>&1 && [ -d /usr/share/mime ]; then
    update-mime-database /usr/share/mime || true
fi

if command -v update-desktop-database >/dev/null 2>&1 && [ -d /usr/share/applications ]; then
    update-desktop-database /usr/share/applications || true
fi

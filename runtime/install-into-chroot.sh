#!/bin/sh
# Stages nrma Runtime files into config/includes.chroot/
set -eu

INC="${1:?chroot include path required}"
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

mkdir -p \
    "$INC/usr/bin" \
    "$INC/usr/lib/nrmaos" \
    "$INC/usr/share/applications" \
    "$INC/usr/share/mime/packages" \
    "$INC/usr/share/file-manager/actions" \
    "$INC/etc/xdg"

install -m 0755 "$SCRIPT_DIR/nrma-runtime" "$INC/usr/bin/nrma-runtime"
install -m 0755 "$SCRIPT_DIR/setup-runtime.sh" "$INC/usr/lib/nrmaos/setup-runtime.sh"
install -m 0644 "$SCRIPT_DIR/nrma-runtime.desktop" "$INC/usr/share/applications/nrma-runtime.desktop"
install -m 0644 "$SCRIPT_DIR/nrma-runtime-mime.xml" "$INC/usr/share/mime/packages/nrma-runtime.xml"
install -m 0644 "$SCRIPT_DIR/nrma-runtime-action.desktop" "$INC/usr/share/file-manager/actions/nrma-runtime-open.desktop"

cat > "$INC/etc/xdg/mimeapps.list" <<'EOF'
[Default Applications]
application/x-ms-dos-executable=nrma-runtime.desktop
application/x-msdownload=nrma-runtime.desktop
application/vnd.microsoft.portable-executable=nrma-runtime.desktop
application/x-msi=nrma-runtime.desktop
inode/directory=nrma-files.desktop
EOF

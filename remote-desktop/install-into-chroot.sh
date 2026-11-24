#!/bin/sh
# Stages nrmaOS Remote Desktop management tools and PolicyKit rules into chroot.
set -eu

INC="${1:?chroot include path required}"
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

mkdir -p \
    "$INC/usr/bin" \
    "$INC/usr/lib/nrmaos" \
    "$INC/usr/share/polkit-1/actions" \
    "$INC/etc/polkit-1/rules.d"

install -m 0755 "$SCRIPT_DIR/nrma-rdpctl" "$INC/usr/bin/nrma-rdpctl"
install -m 0755 "$SCRIPT_DIR/startwm.sh" "$INC/usr/lib/nrmaos/xrdp-startwm.sh"
install -m 0755 "$SCRIPT_DIR/setup-rdp.sh" "$INC/usr/lib/nrmaos/setup-rdp.sh"
install -m 0644 "$SCRIPT_DIR/org.nrmaos.rdpctl.policy" "$INC/usr/share/polkit-1/actions/org.nrmaos.rdpctl.policy"

# Allow active local sudo-group administrators on live evaluation session to run nrma-rdpctl cleanly via pkexec
cat > "$INC/etc/polkit-1/rules.d/50-nrmaos-admin.rules" <<'EOF'
polkit.addRule(function(action, subject) {
    if ((action.id === "org.nrmaos.rdpctl" || action.id === "org.nrmaos.runtime") &&
        subject.local && subject.active && subject.isInGroup("sudo")) {
        return polkit.Result.YES;
    }
});
EOF

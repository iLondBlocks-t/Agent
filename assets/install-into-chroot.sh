#!/bin/sh
# Installs nrmaOS brand icons, generated wallpapers, and login theme into chroot staging directory.
set -eu

INC="${1:?chroot include path required}"
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

WALL_DIR="$INC/usr/share/nrmaos/wallpapers"
ICON_DIR="$INC/usr/share/nrmaos/icons"
HICOLOR_DIR="$INC/usr/share/icons/hicolor/scalable/apps"
LOGIN_THEME_DIR="$INC/usr/share/themes/nrmaOS-Login/gtk-3.0"

mkdir -p "$WALL_DIR" "$ICON_DIR" "$HICOLOR_DIR" "$LOGIN_THEME_DIR"

install -m 0644 "$SCRIPT_DIR/icons/nrmaos-logo.svg" "$ICON_DIR/nrmaos-logo.svg"
install -m 0644 "$SCRIPT_DIR/icons/nrmaos-logo.svg" "$HICOLOR_DIR/nrmaos.svg"

python3 "$SCRIPT_DIR/generate_assets.py" "$WALL_DIR"

cat > "$LOGIN_THEME_DIR/gtk.css" <<'EOF'
/* nrmaOS Login Greeter Minimal Dark Glass Theme */
window, .lightdm-gtk-greeter {
    background-color: #0e1525;
    color: #f2f6fc;
    font-family: "DejaVu Sans", "Noto Sans", sans-serif;
}

#login_window, #content_frame {
    background-color: rgba(20, 28, 44, 0.88);
    border: 1px solid rgba(124, 156, 255, 0.28);
    border-radius: 18px;
    padding: 18px;
    color: #f2f6fc;
}

#panel_window {
    background-color: rgba(14, 20, 32, 0.82);
    color: #e5ecf6;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

entry {
    background-color: rgba(12, 17, 28, 0.92);
    color: #ffffff;
    border: 1px solid rgba(124, 156, 255, 0.35);
    border-radius: 10px;
    padding: 8px 12px;
}

button {
    background-image: none;
    background-color: #4a72f5;
    color: #ffffff;
    border-radius: 10px;
    border: none;
    padding: 8px 16px;
    font-weight: bold;
}

button:hover {
    background-color: #5e84ff;
}
EOF

#!/bin/sh
# /etc/xrdp/startwm.sh
# Starts an isolated nrmaOS desktop session for each authenticated xrdp connection.

if [ -r /etc/profile ]; then
    . /etc/profile
fi

if [ -r "$HOME/.profile" ]; then
    . "$HOME/.profile"
fi

# Isolate remote session D-Bus and runtime state from any local :0 session of the same user.
unset DBUS_SESSION_BUS_ADDRESS
unset XDG_SESSION_COOKIE

DISP_NUM=$(printf '%s' "${DISPLAY:-:10}" | sed 's/^://; s/\..*$//')
export XRDP_SESSION=1
export XDG_RUNTIME_DIR="/tmp/nrmaos-xrdp-$(id -u)-${DISP_NUM:-10}"
mkdir -p "$XDG_RUNTIME_DIR"
chmod 0700 "$XDG_RUNTIME_DIR"

# Apply optional preferred initial resolution when configured in /etc/nrmaos/rdp.json
if [ -r /etc/nrmaos/rdp.json ] && command -v python3 >/dev/null 2>&1 && command -v xrandr >/dev/null 2>&1; then
    PREF_RES=$(python3 -c 'import json; d=json.load(open("/etc/nrmaos/rdp.json")); print(d.get("default_resolution","dynamic"))' 2>/dev/null || echo "dynamic")
    if [ -n "$PREF_RES" ] && [ "$PREF_RES" != "dynamic" ]; then
        xrandr -s "$PREF_RES" >/dev/null 2>&1 || true
    fi
fi

exec /usr/bin/nrmaos-session

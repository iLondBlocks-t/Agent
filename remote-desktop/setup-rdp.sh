#!/bin/sh
# Runs inside chroot during ISO build to harden xrdp/xorgxrdp and ensure RDP starts DISABLED.
set -eu

# 1. Create dedicated RDP access group
if ! getent group nrmaos-rdp >/dev/null 2>&1; then
    groupadd --system nrmaos-rdp
fi

# Ensure xrdp daemon user can read /etc/xrdp/key.pem (0640 root:xrdp) when generated at enable time
if id xrdp >/dev/null 2>&1; then
    usermod -aG ssl-cert xrdp 2>/dev/null || true
fi

# 2. Enforce PAM root/system-UID block as the first auth line in /etc/pam.d/xrdp-sesman
if [ -f /etc/pam.d/xrdp-sesman ]; then
    if ! grep -q 'pam_succeed_if.so uid >= 1000' /etc/pam.d/xrdp-sesman; then
        tmp_pam=$(mktemp)
        printf '# Block root and system accounts (UID < 1000) from RDP authentication\nauth requisite pam_succeed_if.so uid >= 1000 quiet\n' > "$tmp_pam"
        cat /etc/pam.d/xrdp-sesman >> "$tmp_pam"
        install -m 0644 "$tmp_pam" /etc/pam.d/xrdp-sesman
        rm -f "$tmp_pam"
    fi
fi

# 3. Harden /etc/xrdp/sesman.ini: forbid root login, enforce nrmaos-rdp group check, preserve sessions across reconnects
if [ -f /etc/xrdp/sesman.ini ]; then
    sed -i 's/^AllowRootLogin=.*/AllowRootLogin=false/g' /etc/xrdp/sesman.ini
    sed -i 's/^AlwaysGroupCheck=.*/AlwaysGroupCheck=true/g' /etc/xrdp/sesman.ini
    sed -i 's/^TerminalServerUsers=.*/TerminalServerUsers=nrmaos-rdp/g' /etc/xrdp/sesman.ini
    sed -i 's/^KillDisconnected=.*/KillDisconnected=false/g' /etc/xrdp/sesman.ini
    sed -i 's/^Policy=.*/Policy=Default/g' /etc/xrdp/sesman.ini
fi

# 4. Harden /etc/xrdp/xrdp.ini: enforce TLSv1.2/TLSv1.3 and high encryption
if [ -f /etc/xrdp/xrdp.ini ]; then
    sed -i 's/^#*ssl_protocols=.*/ssl_protocols=TLSv1.2, TLSv1.3/g' /etc/xrdp/xrdp.ini
    sed -i 's/^crypt_level=.*/crypt_level=high/g' /etc/xrdp/xrdp.ini
    sed -i 's/^security_layer=.*/security_layer=negotiate/g' /etc/xrdp/xrdp.ini
fi

# 5. Install nrmaOS session launcher into /etc/xrdp/startwm.sh
if [ -f /usr/lib/nrmaos/xrdp-startwm.sh ]; then
    install -m 0755 /usr/lib/nrmaos/xrdp-startwm.sh /etc/xrdp/startwm.sh
fi

# 6. Write default disabled state config
install -d -m 0755 /etc/nrmaos
cat > /etc/nrmaos/rdp.json <<'EOF'
{
  "enabled": false,
  "port": 3389,
  "firewall_mode": "lan",
  "allowed_subnets": [
    "10.0.0.0/8",
    "172.16.0.0/12",
    "192.168.0.0/16"
  ],
  "default_resolution": "dynamic"
}
EOF

# 7. Remove any chroot-generated snakeoil private keys so no shared key ships inside the ISO!
rm -f /etc/xrdp/key.pem /etc/xrdp/cert.pem /etc/ssl/private/ssl-cert-snakeoil.key /etc/ssl/certs/ssl-cert-snakeoil.pem

# 8. Strictly disable xrdp and xrdp-sesman by default!
systemctl disable xrdp.service xrdp-sesman.service >/dev/null 2>&1 || true
rm -f /etc/systemd/system/multi-user.target.wants/xrdp.service \
      /etc/systemd/system/multi-user.target.wants/xrdp-sesman.service

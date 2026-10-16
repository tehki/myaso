#!/usr/bin/env bash
# Runs as root from systemd daily. Uses short-lived P-256 (not RSA) because
# browsers require <14 days for WebTransport serverCertificateHashes.
set -euo pipefail
umask 077
DOMAIN=game.open-trust-layer.org
TLS_DIR=/etc/myaso-alpha/tls
PUBLIC=/srv/myaso/alpha/current/public
mkdir -p "$TLS_DIR"
cert="$TLS_DIR/cert.pem"
key="$TLS_DIR/key.pem"
rotated=0
if [[ ! -s "$cert" || ! -s "$key" ]] || ! openssl x509 -in "$cert" -noout -checkend 259200 >/dev/null 2>&1; then
    tmpcert=$(mktemp "$TLS_DIR/cert.XXXXXXXX")
    tmpkey=$(mktemp "$TLS_DIR/key.XXXXXXXX")
    trap 'rm -f "$tmpcert" "$tmpkey"' EXIT
    openssl req -new -x509 -nodes -days 10 -sha256 \
        -newkey ec -pkeyopt ec_paramgen_curve:P-256 \
        -subj "/CN=$DOMAIN" -addext "subjectAltName=DNS:$DOMAIN" \
        -keyout "$tmpkey" -out "$tmpcert" >/dev/null 2>&1
    openssl x509 -in "$tmpcert" -noout -text | grep -q 'prime256v1'
    install -o myaso-alpha -g myaso-alpha -m 0640 "$tmpkey" "$key"
    install -o myaso-alpha -g myaso-alpha -m 0644 "$tmpcert" "$cert"
    rotated=1
fi
[[ -d "$PUBLIC" ]] || { echo "myaso public directory missing" >&2; exit 1; }
hash=$(openssl x509 -in "$cert" -outform DER | sha256sum | cut -d ' ' -f 1)
[[ "$hash" =~ ^[0-9a-f]{64}$ ]] || exit 1
config_temp=$(mktemp "$PUBLIC/.game-config.XXXXXXXX")
trap 'rm -f "$config_temp"' EXIT
printf '{"serverUrl":"https://%s:4433/game","certificateSha256":"%s","maxPlayers":8}\n' "$DOMAIN" "$hash" > "$config_temp"
chmod 0644 "$config_temp"
mv -f "$config_temp" "$PUBLIC/game-config.json"
if [[ "$rotated" == 1 ]] && systemctl is-active --quiet myaso-alpha.service; then
    systemctl restart myaso-alpha.service
fi
echo "myaso alpha config ready: sha256 $hash, rotated=$rotated"

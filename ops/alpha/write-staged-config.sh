#!/usr/bin/env bash
# Preseed the inactive release's PUBLIC WebTransport configuration when a
# current certificate can safely be reused. No key reads or cert rotation.
set -euo pipefail
umask 077

[[ $# == 2 ]] || { echo "Usage: write-staged-config.sh PUBLIC_DIR EXISTING_CERT" >&2; exit 2; }
public_dir=$1
cert=$2
[[ -d "$public_dir" && -f "$public_dir/web/alpha.html" ]] || {
  echo "Incomplete staged public directory" >&2
  exit 2
}
# First-time staging (or an expiring certificate) must defer to the supported
# --activate path, which rotates/creates the certificate before serving config.
if [[ ! -s "$cert" ]] || ! openssl x509 -in "$cert" -noout -checkend 259200 >/dev/null 2>&1; then
  echo "Staged game config deferred: no certificate valid beyond 3 days"
  exit 0
fi
hash=$(openssl x509 -in "$cert" -outform DER | sha256sum | cut -d ' ' -f 1)
[[ "$hash" =~ ^[0-9a-f]{64}$ ]] || { echo "Invalid certificate digest" >&2; exit 2; }
config_temp=$(mktemp "$public_dir/.game-config.XXXXXXXX")
cleanup() { rm -f -- "$config_temp"; }
trap cleanup EXIT
printf '{"serverUrl":"https://game.open-trust-layer.org:4433/game","certificateSha256":"%s","maxPlayers":8}\n' "$hash" > "$config_temp"
chmod 0644 "$config_temp"
mv -f "$config_temp" "$public_dir/game-config.json"
echo "Staged pinned game config ready (no active-site changes)"

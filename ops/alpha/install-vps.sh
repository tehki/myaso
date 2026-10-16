#!/usr/bin/env bash
# VPS-only, additive R0 alpha rollout. Never replace existing Admin-Call site
# blocks or services. Stage first; only activate after DNS points to this VPS.
set -euo pipefail
umask 022
[[ $(id -u) == 0 ]] || { echo "Run as root" >&2; exit 2; }
[[ $# -eq 3 && ( $1 == --stage || $1 == --activate ) ]] || {
  echo "Usage: install-vps.sh --stage|--activate ARCHIVE SHA256_CHECKSUM_FILE" >&2
  exit 2
}
mode=$1; package=$(realpath "$2"); checksum=$(realpath "$3")
[[ -f "$package" && -f "$checksum" ]] || exit 2
(cd "$(dirname "$package")" && sha256sum -c "$checksum")
if tar -tzf "$package" | grep -Eq '(^/|(^|/)\.\.(/|$))'; then
  echo "Refusing unsafe archive paths" >&2; exit 2
fi
revision=$(tar -xzOf "$package" ./REVISION)
[[ "$revision" =~ ^[0-9a-f]{40}$ ]] || { echo "Invalid packaged revision" >&2; exit 2; }
base=/srv/myaso/alpha
release="$base/releases/$revision"
install -d -m 0755 "$base/releases"
if [[ ! -d "$release" ]]; then
  mkdir -p "$release"
  tar -xzf "$package" -C "$release" --no-same-owner
fi
[[ -x "$release/bin/myaso-server" && -f "$release/public/web/alpha.html"   && -f "$release/ops/alpha/Caddyfile.game" ]] || {
    echo "Alpha release payload incomplete" >&2; exit 2;
  }
if ! id myaso-alpha >/dev/null 2>&1; then
  useradd --system --user-group --home-dir "$base" --shell /usr/sbin/nologin myaso-alpha
fi
install -d -m 0750 -o myaso-alpha -g myaso-alpha /etc/myaso-alpha/tls
install -d -m 0755 /usr/local/libexec/myaso-alpha /etc/caddy
install -m 0755 "$release/ops/alpha/rotate-cert.sh" /usr/local/libexec/myaso-alpha/rotate-cert.sh
ln -sfn "$release" "$base/current.next"
mv -Tf "$base/current.next" "$base/current"
/usr/local/libexec/myaso-alpha/rotate-cert.sh
echo "STAGED myaso alpha revision $revision"
if [[ "$mode" == --stage ]]; then
  echo "Stage-only: no public sockets, firewall, Caddy routes or new services enabled."
  exit 0
fi

# Fail closed: no public site or UDP opening before the operator creates DNS.
resolved=$(getent ahostsv4 game.open-trust-layer.org | awk 'NR==1 {print $1}')
if [[ "$resolved" != 168.113.210.63 ]]; then
  echo "DNS not ready: set game.open-trust-layer.org A 168.113.210.63" >&2
  exit 3
fi
if [[ -e /etc/caddy/myaso-alpha.caddy ]]; then
  cmp -s "$release/ops/alpha/Caddyfile.game" /etc/caddy/myaso-alpha.caddy || {
    echo "Existing Myaso Caddy site differs; refusing overwrite" >&2; exit 3;
  }
else
  install -m 0644 "$release/ops/alpha/Caddyfile.game" /etc/caddy/myaso-alpha.caddy
fi
main_caddy=/etc/caddy/Caddyfile
import_line='import /etc/caddy/myaso-alpha.caddy'
if ! grep -Fqx "$import_line" "$main_caddy"; then
  cp -a "$main_caddy" "$main_caddy.pre-myaso-$revision"
  printf '\n# R0 myaso alpha, separate from existing site blocks\n%s\n' "$import_line" >> "$main_caddy"
fi
if ! caddy validate --config "$main_caddy"; then
  echo "Caddy validation failed; restore $main_caddy.pre-myaso-$revision before retry" >&2
  exit 4
fi
install -m 0644 "$release/ops/alpha/myaso-alpha.service" /etc/systemd/system/myaso-alpha.service
install -m 0644 "$release/ops/alpha/myaso-alpha-rotate.service" /etc/systemd/system/myaso-alpha-rotate.service
install -m 0644 "$release/ops/alpha/myaso-alpha-rotate.timer" /etc/systemd/system/myaso-alpha-rotate.timer
systemctl daemon-reload
systemctl enable --now myaso-alpha.service
systemctl enable --now myaso-alpha-rotate.timer
systemctl is-active --quiet myaso-alpha.service || exit 5
if ! ss -lun | grep -Eq '[:.]4433[[:space:]]'; then
  echo "WebTransport UDP/4433 is not listening" >&2; exit 5
fi
ufw allow 4433/udp comment 'myaso alpha QUIC'
systemctl reload caddy
echo "ACTIVATED https://game.open-trust-layer.org (Caddy TCP/443 + Rust QUIC UDP/4433)"
echo "Validate publicly from two independent networks before declaring rollout complete."

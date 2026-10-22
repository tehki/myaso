#!/usr/bin/env bash
# Pre-Alpha 0.1, intentionally NON-ACTIVATING, immutable staging artifact.
# A successful build is NOT approval to publish: see docs/PREALPHA_01_RELEASE.md.
set -euo pipefail
umask 022
[[ $# -eq 1 ]] || { echo "Usage: scripts/prealpha-package.sh EXISTING_OUTPUT_DIR" >&2; exit 2; }
for command in git cargo tar gzip sha256sum mktemp realpath; do
  command -v "$command" >/dev/null || { echo "Missing required command: $command" >&2; exit 2; }
done
repo=$(git -C "$(dirname "$0")/.." rev-parse --show-toplevel)
[[ -d "$1" ]] || { echo "Output directory does not exist" >&2; exit 2; }
output=$(realpath "$1")
revision=$(git -C "$repo" rev-parse --verify HEAD)
[[ $revision =~ ^[0-9a-f]{40}$ ]] || { echo "Invalid exact source revision" >&2; exit 2; }
[[ -z $(git -C "$repo" status --porcelain --untracked-files=normal) ]] || {
  echo "Refusing release packaging from dirty or untracked source checkout" >&2
  exit 3
}
[[ -f "$repo/web/alpha.html" && -f "$repo/ops/alpha/install-vps.sh" ]] || {
  echo "Existing arena/Alpha package sources missing" >&2; exit 3
}
archive_name="myaso-prealpha-0.1-$revision.tar.gz"
[[ ! -e "$output/$archive_name" && ! -e "$output/$archive_name.sha256" ]] || {
  echo "Refusing to overwrite immutable candidate" >&2; exit 3
}
scratch=$(mktemp -d)
cleanup() { rm -rf -- "$scratch"; }
trap cleanup EXIT
# Pinned source: archive committed HEAD, not a floating branch or remote artifact.
git -C "$repo" archive --format=tar "$revision" web src ops/alpha | tar -xf - -C "$scratch"
# QA and authored-city preview HTML are NOT part of the playable arena. Keep
# original repository source/CI unchanged, but don't publish those development
# entrypoints on the Pre-Alpha website (no Greyhaven/Red Lion implied).
rm -f -- "$scratch/web/flight.html" "$scratch/web/pvp-flight.html" \
  "$scratch/web/pvp-flight.mjs" "$scratch/web/red-lion-art-preview.html"
# The expanded Pre-Alpha must be a COMPLETE already-qualified small game:
# preserve original R4 recorded Foley/music, Silver human sprites, the live
# multiplayer client, HUD and same-origin lobby in the immutable distribution.
# Fail BEFORE building a binary if anything required was omitted from HEAD.
for required in \
  web/alpha.html web/alpha.mjs web/alpha-config.mjs \
  web/index.html web/online-game.mjs web/knight-sprites.mjs \
  web/assets/knights/silver_idle.webp web/assets/knights/silver_walk.webp \
  web/assets/knights/silver_sprint.webp web/assets/knights/silver_roll.webp \
  web/assets/knights/silver_jump.webp web/audio/credits.html web/audio/SOURCES.md \
  web/audio/music/moonlight-sonata-adagio.mp3 \
  web/audio/music/vivaldi-autumn-adagio.mp3 \
  web/audio/music/vivaldi-winter.mp3 web/audio/music/track-04-untitled.mp3 \
  web/local-chat.css src/browser/local-chat.mjs \
  src/browser/chat-c1-activation.mjs src/network/chat-codec.mjs \
  src/network/local-chat-ui-bridge.mjs \
  src/browser/game-audio.mjs src/browser/combat-readability.mjs; do
  [[ -s "$scratch/$required" ]] || {
    echo "Pre-Alpha ready-content missing: $required" >&2
    exit 4
  }
done
# Use the exact ORIGINAL R4 set; don't quietly bundle only a subset.
foley_count=$(find "$scratch/web/audio/foley" -maxdepth 1 -type f -name '*.ogg' | wc -l)
[[ $foley_count -eq 24 ]] || {
  echo "Pre-Alpha must include all 24 original recorded OGG Foley files (got $foley_count)" >&2
  exit 4
}
cargo build --locked --release --manifest-path "$repo/server/Cargo.toml" --bin myaso-server
binary="$repo/server/target/release/myaso-server"
[[ -s "$binary" && -x "$binary" ]] || { echo "Missing executable server release binary" >&2; exit 4; }
mkdir -p "$scratch/out/bin" "$scratch/out/public" "$scratch/out/ops"
install -m 0755 "$binary" "$scratch/out/bin/myaso-server"
mv "$scratch/web" "$scratch/src" "$scratch/out/public/"
mv "$scratch/ops/alpha" "$scratch/out/ops/"
printf '%s\n' "$revision" > "$scratch/out/REVISION"
printf 'PRE-ALPHA 0.1\nNOT APPROVED FOR PUBLIC CUTOVER\nSOURCE_COMMIT=%s\n' "$revision" > "$scratch/out/RELEASE-STATUS"
(
  cd "$scratch/out"
  find . -type f ! -name CONTENT-SHA256 -print0 | LC_ALL=C sort -z | xargs -0 sha256sum > CONTENT-SHA256
  # Deterministic member order and metadata; compression embeds no input filenames.
  tar --sort=name --mtime=@0 --owner=0 --group=0 --numeric-owner -cf - . | gzip -n > "$output/$archive_name"
)
( cd "$output" && sha256sum "$archive_name" > "$archive_name.sha256" )
# Original installer permits --stage only after independently verified external QA.
# This script DOES NOT run install-vps.sh, systemctl, caddy, ufw, DNS or uploads.
printf 'PACKAGED %s\n' "$archive_name"
cat "$output/$archive_name.sha256"

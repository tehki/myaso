#!/usr/bin/env bash
# First Playable Alpha — Items 2B isolated server-domain smoke only.
# Usage: bash scripts/verify_items2b_first_playable.sh
# Environment: CARGO_BIN=/path/to/cargo CARGO_TOOLCHAIN=1.89.0 CARGO_TARGET_DIR=...
# This deliberately DOES NOT prove live WebTransport, cross-machine browser play,
# canonical Core 8B ownership integration, or a shippable multiplayer alpha.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
CARGO_BIN="${CARGO_BIN:-cargo}"
CARGO_TOOLCHAIN="${CARGO_TOOLCHAIN:-}"
cargo_cmd=("$CARGO_BIN")
if [[ -n "$CARGO_TOOLCHAIN" ]]; then
  cargo_cmd+=("+$CARGO_TOOLCHAIN")
fi
manifest="server/Cargo.toml"

# These exact named tests must continue to exist. A plain Cargo test filter
# silently passes with zero matches; this guard prevents false acceptance.
expected=(
  "loot_transaction::tests::naked_player_equip_unequip_drop_other_player_pickup_and_equip_is_durable"
  "loot_transaction::tests::two_looters_cannot_claim_same_corpse_item_and_recovery_keeps_winner"
  "loot_transaction::tests::verified_inventory_view_is_private_and_tracks_physical_equipment"
  "loot_transaction::tests::verified_visible_loot_is_authoritative_bounded_and_redacted"
  "loot_transaction::tests::typed_pickup_rejects_stale_session_world_and_mismatched_zone"
  "loot_transaction::tests::typed_ground_pickup_preserves_magic_and_rejects_replay_after_recovery"
  "loot_transaction::tests::unverified_or_inconsistent_sessions_cannot_commit"
)
printf 'Items 2B P1 smoke: checking %d required regressions exist...\n' "${#expected[@]}"
listed="$("${cargo_cmd[@]}" test --manifest-path "$manifest" --lib -- --list)"
for name in "${expected[@]}"; do
  if ! grep -Fxq -- "$name: test" <<<"$listed"; then
    printf 'FAIL: expected regression is missing: %s\n' "$name" >&2
    exit 1
  fi
done

printf 'Items 2B P1 smoke: running complete Rust lib acceptance...\n'
"${cargo_cmd[@]}" test --manifest-path "$manifest" --lib --quiet
printf 'Items 2B P1 smoke: enforcing Rust format and strict Clippy...\n'
"${cargo_cmd[@]}" fmt --manifest-path "$manifest" --check
"${cargo_cmd[@]}" clippy --manifest-path "$manifest" --all-targets -- -D warnings

printf '\nPASS: Items 2B isolated safety gates. NOT an integrated multiplayer/browser acceptance.\n'

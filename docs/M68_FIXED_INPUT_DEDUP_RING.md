# M68 - Fixed Input Dedup Ring

## Objective

Remove hashing and replay-window scans from authoritative input deduplication while preserving the existing bounded-history behavior.

## Change

Each input session now owns a fixed circular `Vec<bool>` whose slot count is the smallest power of two that covers the inclusive `history_ticks + 1` replay window.

A tick maps through a power-of-two mask. This keeps slot identity stable across the `u32::MAX -> 0` wrap. When the authoritative newest tick advances, only slots entering the new replay window are cleared. If the jump spans the full ring, all slots are cleared once.

This replaces the per-session `HashSet<u32>` and removes the per-packet `retain()` scan.

## Behavioral contract

Unchanged behavior:

- newest observed tick remains authoritative;
- samples older than the configured history window are rejected;
- already-seen ticks are rejected;
- accepted samples are returned oldest-to-newest;
- 32-bit tick wraparound remains supported;
- protocol bytes, redundancy and history length are unchanged.

## Validation

The M68 regression proves:

- one-step and multi-step window advances reuse fixed slots without reallocation;
- duplicate ticks that remain inside the window stay rejected;
- slots for expired ticks are safely reused;
- `u32` wraparound preserves dedup semantics;
- jumps larger than the replay window clear stale slot state and admit the new bounded window.

The inherited full Rust, clippy, browser, input-loss and capacity suites remain required.

## Base / rollback

Base is M67 exact head `9ef11fb0b33bc79e884c8e03465a9dbc69cd623f`.

Rollback is to close/discard the M68 branch/PR. M67 remains unchanged.

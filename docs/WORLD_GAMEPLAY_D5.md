# World & Gameplay D5 — Deterministic Rust/JS boundary differential

**Status:** Dormant test-only parity hardening, stacked on D4 #380. No live collision, movement, authority, resource, combat or networking activation.

## Purpose

D3 proved static walkability at 37 authored points; D4 proved 867 movement steps. D5 increases independent coverage near collision geometry discontinuities **without** creating a costly runtime spatial scan. The Rust and JS occupancy implementations now each classify the *same seeded sequence of 20,000 positions* and compare per-region FNV-1a digests, so a single mismatched outcome makes a gate fail.

The five deterministic categories each have 4,000 cases:
- Greyhaven city wall/gate boundaries
- All 15 exterior building rectangles
- River centerlines, shore clearance and bridge passages
- Eight solid Red Lion Inn furniture footprints
- Uniform Moonvale world-space points and map bounds

The generator uses a fixed LCG seed `0x5a17d00d`, five fixed uint32 draws per case, and quarter-unit coordinates with fighter radii 8, 18, 24 and 32. Coordinates are specifically biased toward edges instead of random open wilderness. The Rust port uses `wrapping_mul`/`wrapping_add`; JS uses `Math.imul` and unsigned 32-bit coercion. Neither routine trusts external input or mutates gameplay state.

## Artifacts

- `scripts/generate-world-boundary-digests.mjs`: recomputes five independent summaries from the D2 authored preview query. `--check` is strict and Windows CRLF compatible.
- `tests/fixtures/world-boundary-digests-v1.csv`: five rows of sample counts, blocked counts and ordered FNV32 digests. No 20k-row bulky fixture required.
- `server/src/world_boundary_parity.rs`: `#[cfg(test)]` Rust differential test using the existing D3 generated Rust geometry and the same PRNG/coordinate families.
- `tests/world-boundary-parity.test.mjs`: generation/stability/coverage and dormant-only checks.
- `.github/workflows/ci.yml`: explicit additional D5 check, alongside existing strict CI gates.

## Reproducible checks

```
node scripts/generate-world-boundary-digests.mjs --check
node --test tests/world-boundary-parity.test.mjs
cargo test --locked --manifest-path server/Cargo.toml d5_twenty_thousand_edge_biased_queries_match_browser_digests
cargo fmt --manifest-path server/Cargo.toml -- --check
cargo clippy --locked --manifest-path server/Cargo.toml --all-targets -- -D warnings
cargo test --locked --manifest-path server/Cargo.toml
```

The region hash is intentionally order-sensitive. Any classification mismatch, missing category, stale map coordinates or unexpected seed variation must fail CI. The original D4 movement fixtures remain unchanged.

## Engineering boundaries

1. This is **test-only**. The Rust server `World::step`, movement reception, combat, snapshots, zone transfer, property rights, items and online renderer are not modified.
2. **Do not claim exhaustive float parity**. Sampling uses representable quarter-unit positions; it does not test every IEEE floating-point representable coordinate, continuous-time motion, network desynchronization, tunneling through thin dynamic geometry, or moving platforms. Future tests must cover adversarial near-tangent inputs and sequencing, with explicit simulation semantics.
3. The fixture generator uses the browser-side preview as its independent oracle, while Rust computes the same positions against its own generated static constants. This proves reproducible implementation agreement for sampled points, not a server-authoritative world.
4. Production activation requires Core & Multiplayer review, authenticated server-owned zone/position/input state, replay/reconnect/rollback, collision against player-built structures/dynamic items, and real two-client tests.
5. CI for parent PR #336 remains red in an unrelated M151 guard-break scenario. D4's exact-head Actions #39491341076 failed inherited M144 recovery-arbitration acceptance. Do not bypass either combat gate or merge descendant PRs while unresolved.

## Next

Coordinate CI ownership with Combat/Development Center and obtain an approved server movement integration plan. Continue World content separately (encounters, resources, player property) in dormant or preview-only form, preserving Economy, Magic & Items and Core authoritative ownership.

# Core Department 8 — Networking / World Runtime Combined P0 Acceptance

**Status:** DRAFT integration candidate; NOT `main`, NOT production, NOT First Playable. Central Main Development & Deployment Orchestrator controls merges, staging, release and rollback.

## Exact source provenance

- **8A Networking parent:** `78cf90018910c0dd2b573160e7cf04469985ed70`, Core [#536](https://github.com/tehki/myaso/pull/536), stacked over #525 → #507 → #491 → #391.
- **8C World Runtime parent:** `4f27a4a133148cd518a93e971fa9149b67d89c1d`, Core [#549](https://github.com/tehki/myaso/pull/549), stacked over #532 → #527 → #520 → #519 → #516 → World #509.
- **Source merge:** `41daa0fa6de37fdf2937d1dc58fe7ef98e1f398f` (two parents above; common base `1dd0b26b4da4f3f57b9ae15e43400f409be7a2a6`).

The sole textual merge conflict was in `.github/workflows/ci.yml`. Resolution preserves ALL 8A R2 session cleanup/native Combat gates and BOTH World 8C pinned static geometry/parity steps. The source files `server/src/main.rs`, `server/src/lib.rs`, `server/src/simulation.rs` and `web/online-game.mjs` merged automatically, but their combined semantics require exact-source tests and 8A/8C specialist review. No protected assertion was relaxed or removed.

## New combined exact-head CI

Additive workflow `.github/workflows/core8-p0-combined-acceptance.yml` runs against **one checkout of the same merge head**, checking:

1. 8A real server QUIC four-client admission and reliable input semantics.
2. 8C real QUIC Greyhaven staged spawns, pinned static collision, four rack approaches, disconnect tombstones and replacement visibility.
3. Four genuine local Chrome/Firefox W3C WebTransport clients, movement, crash and rejoin on that merged source.
4. Offline-only two-host harness configuration/security and evidence-correlation preflight; pinned 23-solid World parity.

Original protected `quality` and all specialist workflow gates remain unchanged and mandatory.

## Fail-closed scope

- All real browser and QUIC integration runs above use disposable **loopback** server processes on one CI host. A 4-browser loopback pass is NOT independent-client-machine M5 acceptance. Core #536's two-host workflow is an **operator-run** future staging preflight, not evidence of a third approved staging server or completed two-host run.
- 8C's 23 static AABBs omit river, bridges, dynamic blockers and comprehensive live LOS. The opt-in static collision mode must remain loopback-only; this PR does not relax TLS, network listeners or firewalls.
- This candidate does NOT implement canonical 8B sword ownership or the `u64`→`u128` identity/coordinate/zone migration contract; no live authenticated `TryPickup`, server-authoritative rack→MainHand transaction, ACK/outbox or equipment replication exists from this merge alone.
- No sword/fists gameplay integration, complete death/drop/reconnect ownership conservation or four-person independent-machine city→armory→combat proof is claimed.
- No server production configuration, live migration, production networking or `main` merges were performed.

## Main Orchestrator integration gate

Require **green exact-head combined CI and full protected quality**, review of auto-merged authoritative source by 8A and 8C, explicit reconciliation of the duplicate Core #486 spawn source already carried by #520, and a new current-`main` ancestry review before any central merge. Parallel 8B+Items+Physics+World decisions at [#432](https://github.com/tehki/myaso/issues/432), [#405](https://github.com/tehki/myaso/issues/405) and [#488](https://github.com/tehki/myaso/issues/488) remain blocking before actual physical sword gameplay.

**One World. One Authority. Four Real Players. Zero Duplicated Swords.**

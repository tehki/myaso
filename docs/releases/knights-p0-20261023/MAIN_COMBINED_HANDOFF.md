# Graphics 3A × Main #906 — Ready-Five release switch integration

**Date:** 2026-10-23

**Status:** source-level integration prepared for Main review, not authorized for deployment.

## Source ancestry and exact identity

- Main-selected original multiplayer + Silver + Combat coexistence draft: [#906](https://github.com/tehki/myaso/pull/906), exact base `c0286e91566871faff8926306c82ae1a88b77bbd`.
- Verified Graphics 3A source candidate: [#881](https://github.com/tehki/myaso/pull/881), SHA `2bf5d48e2c87b70dbb30e5e91ca96dc7e41b0938`.
- Original reversible release packet: [#904](https://github.com/tehki/myaso/pull/904), SHA `bff57bc6d004f8c1bc10430c818d67395e52deda`.
- All four relevant source files at the Main #906 base and Graphics 3A #881 have **matching Git blob IDs**: `web/knight-sprites.mjs` `d3537498ba0db26f52400cf049d69b02821a2d10`, `web/online-game.mjs` `0f0166e3e60a2c8504c408fbe176aaf543ee23cd`, `web/alpha-config.mjs` `d294f218e5596d0c574765cb1476992d2854bcbe`, and original `web/assets/knights/review/silver_idle_relit.webp` `1124bed19c16c15ebb8f09406fa13ef9645ebad2`. The other required four original/relit assets are SHA-pinned in `ready-five-manifest.json` and checked by tests.
- The integrated branch **does not touch** `web/online-game.mjs`, `web/knight-sprites.mjs`, any of the five source asset bytes, `src/combat`, `server`, `src/network`, UI10 gesture logic or live config. It introduces only the strict trusted-config release switch and its documents/tests, plus the branch-specific native CI trigger/tests.

## Strict opt-in / rollback

- `silverKnightRelitEnabled` is validated as an **optional strict boolean** inside the existing operator-controlled, TLS/QUIC-pinned `game-config.json` parse flow.
- Missing or `false` = original five immutable atlas files and the original launch URL. `true`, when specifically enabled by Main after all release gates, adds `knightArt=relit` to the first-party `knights=1` launch.
- All original 22-bone Blender source images and immutable Roll remain unchanged. Kick, Knockdown and Dash traction remain nonrelease art studies, never advertised to actual Combat actions.
- Disable/rollback = set false or remove the operator flag in trusted config and enter from a **fresh launcher session**. In-flight sessions are unaffected until they reconnect. Main must retain its separately certified full release rollback.

## Honest verification and blockers

- Initial focused checks on combined source: **15/15 PASS**, including all 8 authored facings, legacy-only mirror, first-party original vs relit atlas switching, original Roll and exact WebP SHA source.
- Local full combined source JavaScript `node --test --test-concurrency=4 tests/*.test.mjs`: **640/642 PASS**, **2 inherited failures** `tests/prealpha-lmb-gesture-proposal.test.mjs` — “proposal is not imported in existing production browser or Rust QUIC ingress” and “original v1 INPUT stays byte-for-byte identical, with provably ambiguous orphan heavy.” These tests and their referenced Rust/client sources **were not changed** by this child branch; preserve the failures and route to UI10/Core/Main rather than downgrading assertions.
- Main #906 original combined protected quality [#39959127402](https://github.com/tehki/myaso/actions/runs/39959127402) **FAILED** at mandatory Combat **M144** multi-recovery FFA focus handoff. Its [native four-player workflow #39959127465](https://github.com/tehki/myaso/actions/runs/39959127465) passed, but cannot override M144.
- Graphics #904 on its *other* ancestry had protected [quality #39957574316](https://github.com/tehki/myaso/actions/runs/39957574316) and [native #39957574333](https://github.com/tehki/myaso/actions/runs/39957574333) both green. They are **provenance**, not a pass for the new combined SHA.
- The exact combined child PR must independently pass protected quality and both required authentic Rust/native-browser jobs. Physical 2–4-human real-world multiplayer acceptance, actual updated Combat input protocol on public endpoint, staging integrity, production rollback and Main signoff remain separate requirements.

## Main decision

**MAIN HOLD** until the protected combined source is green, M144 and gesture-proposal source conflicts are resolved without weakened tests, actual human multiplayer plays successfully, and Main explicitly authorizes rollout. This is an additive opt-in preparation, **not** a deployment, merge, server restart, public config edit or permission to ship unfinished Kick/Knockdown/Dash.

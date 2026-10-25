# Graphics 3A — Ready-Five on Main Combat #1036 (review only)

Date: 2026-10-25. **DRAFT / HOLD. No merge, staging, production switch or deployment.**

## Provenance and target

- Parent Main/Core/Combat integration: [PR #1036](https://github.com/tehki/myaso/pull/1036), pinned **starting commit** `21bb4232c54dc51ee28d182fc2bebaccb2ad010d` on `codex/unified-core-combat-20261024`. This child does **not** automatically inherit future #1036 commits or CI results.
- Approved Graphics source donor: [PR #922](https://github.com/tehki/myaso/pull/922), immutable commit `097964c267453e8ff754153d78a175fb50f72201`. The original standalone package is [#904](https://github.com/tehki/myaso/pull/904), `bff57bc6d004f8c1bc10430c818d67395e52deda`.
- Reapply the **original donor contents**: strictly default-off trusted `silverKnightRelitEnabled` validation and first-party lobby query; original five-asset SHA256 manifest, release/rollback instructions and immutable release-gate source tests. No `web/online-game.mjs`, `web/knight-sprites.mjs`, WebP, Rust, World, Combat, HUD, network, physics or authoritative input changes.
- Preserve existing #1036 protected `quality` workflow and native Chrome/Firefox Silver workflows; add early release-source assertions and branch-head native triggers/tests **without removing any existing test or job**.

## Ready-Five scope and truth

**Idle, Walk, Sprint, Jump:** authentic eight-direction, 160px relit Silver Blender source art. **Roll:** original immutable eight-direction 350ms atlas. Source and byte-level identity checked by `tests/graphics3a-knights-release-gate.test.mjs` against `ready-five-manifest.json`.

Default trusted operator config omission/false means **original five Silver atlases**. Only after Main and owner GO, strict boolean `true` in pinned, operator-served `/game-config.json` appends `knightArt=relit` to the existing `knights=1` and pinned certificate/endpoint. Invalid values reject. Disable flag/remove field plus fresh launcher session for art rollback; Main retains full build rollback ownership. Direct visual URL query is not authentication.

P1 Dash [#1034](https://github.com/tehki/myaso/pull/1034), Spartan Kick V3, Knockdown V2 [#788](https://github.com/tehki/myaso/pull/788) and equipment/weapon art are **excluded**, no implicit promotion.

## Nonrelease qualification checklist

1. Confirm this child branch exact HEAD and Main's **latest** selected parent #1036 source commit. Reconcile parent advancement instead of treating an old green run as proof.
2. Pass early Ready-Five source/hash/direction/strict-config tests; prove all original full protected `quality` checks. **Do not weaken or skip M-series Combat tests.**
3. Pass both genuine first-party native Chrome/Firefox four-player Silver workflows at the final HEAD; prove jump-to-idle/grounded shadow, eight facings, real local/remote server actor IDs, truthful unsupported action fallbacks, 960×540 real full Canvas images.
4. Add measured 2/4-client p50/p95 frame intervals, art contrast/lighting/direction at original game scale, missing-image fallback, and real restart/respawn; human-operated machines are a separate required final gate.
5. Combat4/UI10/Core8 own owner-approved LMB-only heavy, trusted authority, M-series browser Combat regressions. Graphics does not repair those by changing gameplay inputs, timing, HP, or hitboxes.
6. Art Director 3 review and Main 0/owner explicit GO are mandatory. No public asset/operator activation or release before those gates.

**Known blockers at preparation:** #922 full quality failed M35/M33; #1035 exact-head full quality failed M155 despite green graphics native; the parent Main #1036 quality was not yet established on this child exact SHA. No cross-SHA CI inheritance.

This is the smallest additive official-lobby release-switch integration over #1036, not a new renderer, feature, separate gameplay implementation or authorized deployment.

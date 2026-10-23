# 🌕⚔️🚀 Graphics 3C × Graphics 3A — original Silver Knight + optional Arena Lite floor

**STATUS: QUARANTINED CROSS-DEPARTMENT DRAFT. NOT A MAIN MERGE / NOT RELEASE READY.**

## Exact source composition

This isolated child begins from authentic source [Graphics 3A jump-shadow correction #881](https://github.com/tehki/myaso/pull/881), pinned parent `2bf5d48e2c87b70dbb30e5e91ca96dc7e41b0938` (stacked on relit Silver #873, actor cache #839 and original authenticated UI10 #787). This **is not directly based on protected main**. Neither source stack is production.

It takes unchanged deterministic source-owned [Graphics 3C optional Arena Lite #888](https://github.com/tehki/myaso/pull/888), once-painted into an opaque original 960×540 Canvas, with restrained packed-earth wear, scattered gravel and perimeter cobbles (not new collision/Physics).

A minimal real original-game `web/online-game.mjs` change adds `createArenaLiteLayer` and a pure fail-closed selector:
- Normal `/web/?knights=1` uses the exact unchanged source `createArenaLayer()` 48px dark grid.
- Explicit `/web/?knights=1&arenaLite=1` selects source-authored floor; optional `knightArt=relit` shows original Blender review relight. No relight/art default.
- Any failed/null/malformed optional layer immediately falls back to original grid. Existing `ctx.drawImage(arenaLayer,0,0)` is untouched. No extra RAF, server/world snapshot, protocol, client position, Combat hitbox, sound, camera or input gestures.
- Actual original Silver source rendering (5 verified locomotion clips), actor `netId` cache isolation and jumping cosmetic ground shadow from 3A remain unchanged.

## Strict acceptance and what it does not mean

`tests/prealpha-arena-lite-floor.test.mjs` + `tests/prealpha-arena-lite-optin.test.mjs` + `tests/prealpha-silver-knight.test.mjs` run in mandatory protected quality. These prove deterministic Canvas source/fail-closed selection and original immutable Silver hashes, not full combat.

The dedicated [four-browser native script](https://github.com/tehki/myaso/blob/graphics3c/prealpha-arena-lite-silver-four-browser-20261023/tools/art/verify_prealpha_arena_lite_silver_four_native.mjs) builds the **current real Rust server**, opens four genuine independent W3C Chrome/Firefox processes with real server-assigned IDs #1–4, two original grid and two opt-in Lite **in the same match**, and turns on `knights=1&knightArt=relit`. It asserts all four actual original `silver_*_relit.webp` `drawImage` sources, a real four-person game HUD roster, one actual floor layer per renderer, original source luminance differentiation, no missing Canvas, valid actual native PNGs with SHA256, frame interval p50/p95 and server-connected status. It does **not** insert fake player positions, source image substitutions or network packets.

This is still **four automated native browsers, not four independent humans on separate machines**. It does not prove all five movement clips/Combat defense phases in every state, authoritative new 0x11/0x12 gesture, exact GPU-present FPS, human art approval or Full Pre-Alpha release readiness. Any native browser failure is a blocking evidence gap on this review PR; no test downgrades.

**No Greyhaven/Red Lion/world architecture, swords or animation upgrades** are part of this narrow Combat arena experiment. Owner accepted an **optional visual trial**, not mandatory terrain promotion. [Pre-Alpha master #695](https://github.com/tehki/myaso/issues/695) remains combat-first and excludes any new Graphics release dependency.

## Release and ownership

Graphics 3A owns source Silver/animation integrity, Graphics 3C owns original terrain and performance comparison, Combat4/Core8A/Core8C owns authoritative game/tick/wire, UI10 owns real HUD/offscreen/Controls. Main/owner #360/#695 alone authorizes sequence, merge, staging, rollback and public GO.

**Never merge or deploy this cross-stack proof directly into main.** Preserve exact-head full protected CI including original M121/M158/M194 gates without skipping/loosening. Remain DRAFT until genuine native Chrome/Firefox and owner/game-scale review.

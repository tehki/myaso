# Graphics 3A — First Playable P0 character role rendering handoff

**Status: implementation candidate, integration BLOCKED.** Target: the owner-approved Alpha roster in [Graphics Art Director issue #344](https://github.com/tehki/myaso/issues/344) / [Graphics roster PR #490](https://github.com/tehki/myaso/pull/490), and four-player city/armory PvP [#480](https://github.com/tehki/myaso/issues/480). Stacked on the **unmerged** Knight truth/fallback [PR #408](https://github.com/tehki/myaso/pull/408). No independent main merge or deployment.

## Direct correction: remote is not an NPC

Previous `web/knight-sprites.mjs` used `remote = true` as the art-class selector. A **second real human** seen from another machine was therefore rendered as **T1 Sentinel**. That violates the owner's explicit temporary Alpha rule:

- `actorKind = "player"` → **Silver Knight** for local and *all* remote authenticated people.
- `actorKind = "npc"` → **T1 Sentinel**, only from a future Core/AI-validated server NPC roster.
- Missing, unsupported, untrusted `actorKind` → **no Knight WebP drawn**, so the existing truthful Combat fallback renders.

The new optional `actorKind` argument to `createKnightSpriteRenderer.draw()` and `knightClip()` implements those contracts. **`remote` now distinguishes only state cache/telegraph viewpoint**. No renderer path tries to infer `npc` from `netId`, position, hostname, client query, display name or a user-supplied `fighter.kind`.

The existing online client still receives **authenticated human fighter snapshots** in `networkClient.state`, not a trusted NPC roster. Its opt-in `&knights=1` caller supplies `actorKind: "player"` for its local and remote fighters. This deliberately **does not enable T1 NPCs** in live games. When a separate Core/AI NPC stream exists, it must be validated and passed as explicit `actorKind:"npc"` by that owning integration; it cannot be guessed from `remote`.

## Combat/source behavior unchanged

- Preserves `&knights=1` explicit opt-in, and `&knights=1&knightScale=100` visual-size rollback.
- Preserves approved standing **96×96px**, forward roll **134×134px**, authored 8 directions and **350ms** roll cycle.
- Player **attack, block, kick, stun, knockdown and death** have no approved Silver atlas; the sprite renderer returns false so existing Combat motion/tells/circle+weapon shape render. It **never** substitutes T1 attack/block art for remote human players.
- NPC block and attack may choose T1 atlases *only when* caller has a separately trusted authoritative NPC role; no such Core stream is enabled or invented.
- Missing/undecoded atlas or unknown role returns the existing Combat fallback; no invisible fighter.
- No changes to server authority, network bytes, damage, hitboxes, roll physics, timings, corpse/respawn rules, world collision, persistent identities, inventories, item ownership, actual sword item meshes, or the default unopted renderer.

## Verified evidence

Exact-head source regression:
```sh
node --test tests/knight-*.test.mjs
```
Includes tests that **two remote human IDs** and local human draw Silver, a separate server-NPC fixture draws T1, unknown/spoofed actor kinds fail closed, all unsupported human Combat states retain fallback, and broken assets never hide a human.

Native **Chrome 154 + Firefox 153.4**, standalone source-atlas QA:
```sh
KNIGHT_QA_BROWSER=chrome KNIGHT_QA_EXECUTABLE=<local-Chrome> \
  node tools/art/verify_knight_alpha_roles_browser.mjs <output-dir>
KNIGHT_QA_BROWSER=firefox KNIGHT_QA_EXECUTABLE=<local-Firefox> \
  node tools/art/verify_knight_alpha_roles_browser.mjs <output-dir>
```
This tests 6 review scenarios × 8 directions **48 per browser**, three humans + one artificial NPC-role fixture + two fallbacks, all **9 genuine first-party Knight WebPs** loaded. Attach actual Chrome/Firefox screenshots for idle/dodge/attack, along with per-engine JSON. All fixtures are **hardcoded visual QA**, not authenticated network traffic. Preview page: `web/knight-alpha-role-review.html` served locally from repository root using a static HTTP server. The page explicitly labels this limitation.

## Critical remaining P0 integration gates

1. **Real multiplayer:** Core 8A/8B confirm current session-owned player roster and two *independent authenticated* clients render each other as Silver. Require actual client `web/online-game.mjs` screenshots in Chrome + Firefox, input/movement/roll/action/respawn, no Sentinel for a remote human.
2. **Server-owned NPCs:** a genuine Core/AI `npc` entity type must be explicitly versioned and authoritative before any T1 live dispatch. Optional AI/NPC pilot remains OFF; no NPC presence is required to launch First Playable.
3. **Physical sword visual integrity:** Silver Knight costume is **purely a temporary visual**, not an owned sword or armor grant. The owner's mandatory click-the-actual-rack-sword scenario requires distinct server-owned world swords [#488](https://github.com/tehki/myaso/issues/488), real MainHand item receipt [#460](https://github.com/tehki/myaso/issues/460), and truthful armed/unarmed hand/attack visuals. Some current Knight sprite artwork may include weapon-like shapes while empty-handed; **must review and correct before accepting fists-v-swords gameplay**. No false physical pickup acknowledgments.
4. **Orchestrator policy reconciliation:** shared read-only [#490](https://github.com/tehki/myaso/pull/490) is not in the Knight #408 ancestry. On integration, use its canonical player→Silver, npc→T1 mapping rather than shipping a conflicting duplicate policy implementation. Do not merge the two draft stacks independently or activate a feature based on a stale main.
5. **CI and governance:** exact-head protected full quality must pass. Only Development Center [#360](https://github.com/tehki/myaso/issues/360) and First Playable [#480](https://github.com/tehki/myaso/issues/480) can coordinate staging/merges/rollback; local and isolated browser tests do not imply playable acceptance.

**Readiness:** IMPLEMENTED (render-role correction), TESTED (isolated), **BLOCKED for INTEGRATION-READY**, NOT INTEGRATED, NOT PLAYABLE as a full four-player city/armory game. Adult anatomical/CMU roll drafts remain in development, visually unapproved and not enabled as Alpha skins.

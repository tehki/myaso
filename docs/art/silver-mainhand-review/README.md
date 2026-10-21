# Graphics 3A — P0 Silver Knight MainHand visual adapter, First Playable Alpha

**Classification: EXPERIMENTAL / VISUAL HOLD. Not integration-ready, not merged, not playable, not a real item-receipt test.** Stacked on fully protected-green [Graphics 3A player/NPC roles #497](https://github.com/tehki/myaso/pull/497) at `25f8cdd7b207ec1ecb51f38b96dafa74298e341a`. This source-only review does not edit `web/online-game.mjs`, Core, Combat, UI, Items, Physics, authoritative roles or production.

## Why this exists

The owner requires four real humans to click four physical sword pixels at the Blacksmith rack, each item transitioning under single-writer authority to a player's **MainHand** and appearing visibly on every authenticated observer. The existing Silver Knight temporary Alpha model is only a **costume**. A fake decorative beige sword bar in unsupported action fallback was removed for optional Knight mode by [#497](https://github.com/tehki/myaso/pull/497); this child explores *original held-sword art* without granting items.

## What is genuinely built

- An original, pure presentation module `src/browser/silver-committed-mainhand-visual.mjs` with `planSilverCommittedSword` and `drawSilverCommittedSword`. It has **no network, store mutation, on-click, damage, equipment grant or action**.
- The module requires an explicit `actorKind:"player"`, matching actor key and **externally supplied** provisional `core-items-committed-snapshot` presentation record containing a typed `MainHand` sword item in `equipped` state, its committed sequence and server tick/revisions. Missing, unknown, optimistic, pending, client-predicted, offhand, mismatched-owner, wrong-actor and NPC inputs yield no attachment. This *does not authenticate the record*. **Core 8B/Items 2B MUST supply the trusted decoder and canonical u128 item ownership; never create `provenance` by trusting client JSON.**
- Original first-party [Graphics 3B rack sword](https://github.com/tehki/myaso/pull/500) image: SHA-256 `795874620d07652e55f5e8a76952d2075f17196fc892eff88d46b165638a3b31`, genuine **42×115** transparent RGBA WebP from 3B Blender source. A **review-only copy** is kept under `docs/art/silver-mainhand-review`; game production will reuse the shared 3B art path *after* 3B approval/merge, not ship another runtime copy.
- Actual body-hand anchors derived offline from the **owner-supplied original Silver Knight 22-bone GLB**, bone `mixamorig:RightHand`, and A3 roll GLB under authorized Windows workstation. Blender 4.5 source script projects right-hand joints through the original A3 **ortho 1.66** eight-facing bake camera. All eight facings × all frames for five Silver clips are in `web/assets/knights/silver_hand_anchors_p0.json`. **Source GLB and Blender proprietary files are not checked in**. Legacy pre-A3 320px frames may not align precisely with A3 source camera, so human visual QA is mandatory.
- Experimental visual attachment **enabled in offline QA only** for original Silver idle/walk/sprint (all eight directions). In an initial Chrome visual inspection, the sword **floated below the tumbling body during roll**, making it incorrect; therefore jump and roll sword overlay are **deliberately disabled** until properly braced/gripped art and occlusion exist. The item's server status must remain equipped independently of its temporarily absent art. Unsupported Silver Combat attacks/block/stun/death continue existing truthful fallback; there is **no sword-specific Combat animation** yet.
- Original source-preview `web/silver-mainhand-review.html` renders the very same **original Silver WebP atlas tiles** unarmed (top) vs an explicitly labeled **synthetic committed-fixture** with the original 3B sword (bottom) across all eight facings. Pause/frame-scrub or play source clips. The test item ID is `ART-QA-ONLY-NO-CANONICAL-ID`. No real player, Core item writer, receipt, location or live WebTransport is fabricated.

## Direct visual inspection

Serve repository root as static files (e.g., `python -m http.server 8765`) and open in real Chrome/Firefox:

`http://127.0.0.1:8765/web/silver-mainhand-review.html`

The page deliberately shows **no sword for either row** in jump/roll. That is the **documented incomplete art state**, not an indication that Core unequipped the item. The supplied source WebP pixels and detached original 3B asset remain untouched.

Native browser evidence (all screenshots genuine browser screenshots, not generated composites):

- [Chrome idle unarmed vs synthetic-committed](silver_mainhand_chrome_silver_idle_committed.png)
- [Chrome walk frame 4, all facings](silver_mainhand_chrome_silver_walk_committed.png)
- [Chrome roll visual hold](silver_mainhand_chrome_silver_roll_committed.png)
- [Chrome pending click — must remain unarmed](silver_mainhand_chrome_silver_idle_pending.png)
- [Firefox idle](silver_mainhand_firefox_silver_idle_committed.png)
- [Firefox walk](silver_mainhand_firefox_silver_walk_committed.png)
- [Firefox roll hold](silver_mainhand_firefox_silver_roll_committed.png)
- [Firefox pending](silver_mainhand_firefox_silver_idle_pending.png)
- Machine-verified [Chrome report](silver_mainhand_chrome.json) and [Firefox report](silver_mainhand_firefox.json).

### Honest test boundaries

- 4/4 focused module tests: original 3B image hash, no implicit item/actor role, 160 planned source frame/direction attachments for idle/walk/sprint, no in-module side effects, jump/roll rejection.
- Native **Chrome 154.0.8037.99: 68/68 scenarios × eight facings = 544 checked facing slots, four genuine screenshots, zero JS/network errors**.
- Native **Firefox 153.4.0: 68/68 scenarios × eight facings = 544 checked facing slots, four genuine screenshots, zero JS/network errors**.
- The label **“committed” is a hard-coded TEST FIXTURE**; it is not a server receipt. Browser checks validate source-art drawing and fail-closed appearance decisions, **NOT authentic authorization, four clients, any pickup/replication, runtime actuation, live collision or combat**.
- The actual original asset silhouette is dark and the hand/sword alignment varies by viewing direction and frame. **Human visual approval for the attachment is NOT achieved.** No victory/alpha-ready label based solely on decoded WebPs or tests.

## Cross-department integration contract (must be agreed by Main Orchestrator)

1. Core 8B + Items 2B issue one authoritative u128 item ownership record (one writer and non-optimistic replicated receipt) for the exact picked sword; bind that record to the correct authenticated actor/character across reconnect/slot reuse and death/drop. The adapter's invented presentation input object must be **replaced/mapped only at the trusted Core boundary** after schema agreement; it is **not** a new protocol.
2. World 9 / Graphics 3B provide the same authored Blacksmith rack and four actual item IDs via [World #493/#509](https://github.com/tehki/myaso/pull/509), [3B original art #500/#508/#512](https://github.com/tehki/myaso/pull/512), Physics LOS and UI/Combat unique pointer-capture gate [#503](https://github.com/tehki/myaso/pull/503). Do not make art or local click authority for picking up anything.
3. 3A visual renderer integration must use the *exact same* Silver clip, direction, frame and camera presentation rectangle as the actual player on each observer (including 8-way roll); avoid drawing a sword during an unsupported fallback action until true sword/punch animation is verified. Draw sword behind/in front consistently with 3D pose, building occlusion and World depth.
4. Exact-head protected full CI, real `web/online-game.mjs` on four independent authenticated browsers in shared Greyhaven, actual pointer click→single server-owned pickup→sword removed from rack→same canonical ID equipped on **all clients**, both armed vs unarmed attack/death/respawn, rollback and actual human visual approval are mandatory. [Alpha #480](https://github.com/tehki/myaso/issues/480), [sword acceptance #488](https://github.com/tehki/myaso/issues/488), [Development Center #360](https://github.com/tehki/myaso/issues/360). This PR is never a substitute for those gates.

**Status:** IMPLEMENTED source preview and isolated TESTED, **EXPERIMENTAL/VISUAL HOLD** for art and integration. No merge, deployment, verified canonical inventory, NPC pilot or actual gameplay change.

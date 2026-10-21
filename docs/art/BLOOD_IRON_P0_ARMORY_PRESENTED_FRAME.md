# 🌕⚡️🚀 Graphics 3B P0 — completed-frame Blacksmith rack painter

**Moon Games myaso.io · 2026-10-21 · draft from #524 · mandatory physical-sword First Playable #480/#488.**

## New production-intended visual seam

`src/browser/armory-rack-presented-frame.mjs` exports `paintArmoryRackPresentedFrame({ctx,plan,rackImage,swordImage,alphaSampler,frameId})`. Graphics owns the original Blender 5.2 rack/sword WebPs and the actual Canvas drawing; **World owns rack socket/world depth order, Core+Items own committed world item state, and UI+Combat own the gesture and server request**. There is only one rack sprite, followed by 0–4 independent sword sprites, in the order of the caller’s world-derived visual plan.

**Critically, only a completed painter return** contains `plan`, `sampleAlpha`, `frameId` and `lastPresentedFrameId`, which is the exact shape already required by the original hardened UI #503 source classifier. The renderer does **not** invent a frame ID, change image ordering or replace the caller’s World renderer. If an image is missing/incorrect, plan invalid, duplicate, or `drawImage` fails mid-call, it throws **without returning any final-painted hit context**. Caller must clear stale presented state before calling. It restores Canvas state in a finally clause on draw failures; this does not magically roll back pixels already painted in that failing Canvas pass. World/Graphics compositor must clear or redraw that incomplete frame before accepting input.

The source images are independently checked for decoded size and exact same-origin URL: rack 240×166, sword 42×115, originally modeled/packaged in PR #500. The painter requires the existing single-source WebP alpha sampler, never fabricates hit regions and never enlarges source alpha. The original source WebP hashes, original Blender scene and shader materials remain byte-identical.

The pure planter `createWorld493RackArtPlan` still derives four original World #493 authored sword socket positions `(3740,4038), (3780,4038), (3820,4038), (3860,4038)` and art-only rack center `(3800,4038)` from original authoring data; do not confuse those with server-issued item IDs, actor range, LOS or authoritative equipped state. **An empty externally provided item list draws one rack and zero swords**. This is useful for the real observed post-pickup scene but does not certify a real server commit.

## Actual source-browser verification

`web/armory-p0-world493-ui-review.mjs` now uses the painter instead of locally duplicating `ctx.drawImage` of rack and swords. The same pinned original World #493 authored map/Canvas terrain and original UI #503 hardened alpha reservation source are loaded from separate exact SHA checkouts. The original 3B assets and 42×115 image mask are unchanged. Native Chrome 154.0.8037.99 and Firefox 153.4.0 retained:

- **All four swords** selected separately at CSS 390px/DPR2 and desktop scale, eight added unique real pointer interactions per browser.
- One original source-transparent click ignored (test-only fallback); three reserved cancellations on pointer drag, item revision and disappearance; source coordinate/alpha spoofing and stale frame rejected.
- **0 browser errors, 0 real Combat invocations, 0 server pickup messages.**
- **25/25 cumulative local P0 Graphics Node tests passed**, 5 new painter-specific tests for 1+4/1+0 drawing, locked/invalid image URLs, bad plans and duplicates, Canvas failure without false committed-presented-frame evidence. All original tests remain strict.

The source review shows `presentedCanvasCallCompleted:true` only for successful calls and `actualGameFrameCompleted:false`. It is still **not** the actual authenticated game and uses fixture IDs labeled `ART-ONLY-NO-SERVER`.

## Integration and release HOLD

Call order for future centrally approved **real** game integration is: (1) server-replicated committed zone+on-rack item snapshot → (2) World authoring/terrain and full artist-approved actor depth layer → (3) 3B `createWorld493RackArtPlan` → (4) 3B `paintArmoryRackPresentedFrame` with decoded original WebPs and latest frame ID → (5) UI #503 visual-only alpha candidate before Combat LMB, then Core verified TryPickup → (6) new authoritative server snapshot removes exactly the committed sword, Graphics 3A only draws it in owner Silver Knight MainHand after verified equip. This order is a proposal, **not an active online-game integration**.

World consolidated #521 documents art rack origin (3800,4038) as **display only**; server geometry/epoch, Core8B/Items2B single canonical u128 writer, UI pointer owner selection, reliable opcodes, physics proximity/LOS, true slot removal and four independent host browsers remain unresolved. Graphics3A still has jump/roll held-sword art HOLD. Do not duplicate UI #489 and #503 gates or synthesize server IDs.

Original #508 and #512 protected exact-head full quality passed. Parent #514 protected #39585943148 **FAILED M143 jump-recovery**; parent #524 protected #39595826432 requires its complete result. This new head must pass its own protected CI. Do not waive Combat or relax CI; no merges, production changes or gameplay protocol mutation.

**Classification: IMPLEMENTED + isolated source-browser TESTED; integration-ready BLOCKED; NOT INTEGRATED; NOT PLAYABLE.**

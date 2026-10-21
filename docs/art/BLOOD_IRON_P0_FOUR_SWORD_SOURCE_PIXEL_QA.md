# Graphics 3B P0 — all four real Blender sword pixel targets, Chrome + Firefox

**21 October 2026 · Moon Games First Playable #480 / four-sword contract #488.**

This narrow child follows Graphics draft #514, source #512/#508/#500 and original World #493/UI #503. It does not implement server pickup, live arena visual integration, real Combat, item identity, or another pointer gate.

## Found by expanding the native acceptance

Before this milestone, genuine Chrome/Firefox UI pointer gestures exercised the first rack sword repeatedly. Extending the review to independently click all four revealed a **Firefox scaled-canvas edge hit false negative**: near the sword tip at source pixel (20,13) alpha is only **159**, while adjacent pixel (19,13) has **alpha 0**. In one real Firefox 390px/DPR2 click on slot 2, source-hit probing for nominal (20,13) found the sword but the native pointer ultimately fell through UI #503 to the **simulated** Combat fallback. This is a precision/input-quantization risk, not evidence of a wrong server item or a reason to weaken alpha precision.

**Do NOT enlarge invisible sword hit boxes or lower UI's 64/255 alpha threshold.** This PR adds an **art-only QA landmark**, source-derived from the original decoded lossless sword WebP: find a source pixel nearest center which has a 5×5 neighborhood with **all alpha values ≥224**. For the unchanged original 42×115 image it resolves to **(20,55), radius 2**. This landmark is metadata explicitly marked `qaLandmarkOnly:true`, `expandsHitBox:false`; the actual graphics hit-test and hardened UI gesture rules remain untouched. Genuine clicks on narrow edge alpha still depend on the owning UI canvas mapping and can miss; that must be separately evaluated with UI/UX. The landmark proves robust internal pixels can select each sword.

## Actual source-owned four-sword acceptance

Updated **the same original-source Chrome 154 and Firefox 153.4 browser runner** to directly import immutable World #493 four sockets (3740/3780/3820/3860,4038), the original Graphics 3B Blender rack/transparent sword WebPs and unchanged hardened UI #503. The new source mask proof rasterizes all four actual projected 42×115 WebP alpha masks at game zoom 0.84; it reports **zero shared opaque candidate pixels in all six sword pairs**. This is a *source-mask* fact, NOT proof of occlusion in the live game renderer.

In **both** actual browser engines, eight additional genuine pointerdown/up gestures each (four at 390px CSS viewport/DPR2, four at normal desktop viewport) select **four different illustrative visual IDs in correct World rack order**. Earlier source-transparent click, drag cancellation, visual item revision/disappearance cancellation, stale-frame/forged alpha rejection remain tested. Full test result per browser: **10 visual-only intents** (2 earlier on sword #1 and 8 new across all four), **1 simulated-only Combat fallback**, **3 canceled interactions**, **zero JS/network errors, zero genuine Combat calls or real item pickups**. The four item IDs intentionally remain `ART-ONLY-NO-SERVER-0..3`, not Core canonical u128 records.

### Why this is the smallest safe implementation

Changes are confined to the read-only source-alpha helper's optional QA landmark, graphics-only review page, real-browser verifier, JSON evidence, this document and extra Node regression tests. There are **NO** modifications to `web/online-game.mjs`, World/authored map, official Blender/WebP art, UI #503, Combat source/tests, Rust server, physics/geometry, network protocol, or item ledger.

### CI and integration HOLD

Previous Graphics exact-head #508 [quality #39581728682](https://github.com/tehki/myaso/actions/runs/39581728682) and #512 [quality #39583736641](https://github.com/tehki/myaso/actions/runs/39583736641) PASSED. Parent #514 [quality #39585943148](https://github.com/tehki/myaso/actions/runs/39585943148) **FAILED protected M143 jump-recovery FFA focus**, with no source-level Combat edits; root cause is **not proven**, so we do not label it harmless or bypass the check. The new exact-head CI must pass separately.

World/Core8C/Physics need trusted live same-tick geometry; Items/Core8B the single-writer canonical u128 sword IDs and committed on-rack/equipped state; Core8A network ACK and replicas; UI10/Combat4 must approve a single live alpha pointerdown/up gesture gate; Graphics3A the verified Silver Knight MainHand art (jump/roll hand anchors remain 3A's visual HOLD). The four-client City→Armory→Fists/Swords First Playable proof is **still missing**.

**Status: source-art IMPLEMENTED, Chrome/Firefox TESTED; not INTEGRATION-READY, INTEGRATED or PLAYABLE. No merge or deployment.**

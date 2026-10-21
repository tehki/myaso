# 🌕⚡️🚀 Graphics 3B P0 — one decoded source-alpha sampler for original Blacksmith sword

21 October 2026 · Moon Games First Playable #480 / mandatory physical sword click #488.

**Scope: Graphics presentation-only.** Builds on original World #493, Graphics #500/#508/#512 and hardened UI #503. No server pickup, Combat control routing, canonical item writer, collision authority, actual online-game.mjs or deployment.

## The integration concern

Prior three-department browser QA reimplemented the WebP RGBA decoder inline in its review page, while both Graphics #500 `hitTestVisibleSwordAlpha` and UI #503 `createAlphaSwordGestureGate` accepted an injected `sampleAlpha` callback. A frontend could accidentally use two different buffers or a placeholder alpha value, breaking the guarantee that a pointer targets **the pixels actually visible in the original sword image**. The actual old UI #503 fix re-samples alpha independently; Graphics should supply a small single-source decoder rather than leave implementers to recreate it.

## New single-source presentation helper

`src/browser/armory-sword-alpha-sampler.mjs` exports `createArmorySwordAlphaSampler(image,{canvasFactory?})` and a frozen source spec. Once the first-party **42×115 transparent original Blender sword WebP** has decoded:

1. Verify decoded image size/ready state, expected same-origin URL path, no query/hash substitution, and availability of 2D RGBA readback. Cross-origin tainted Canvas failures must throw; never silently interpret a sword as opaque.
2. Decode the image *once* to private copied Uint8Array alpha bytes. Source alpha buffer is not shared as mutable data. Return frozen metadata plus `sampleAlpha(asset,x,y)`.
3. Only exact original sword path and integer coordinates within source bounds return pixel alpha. Unknown asset, rack/counter, negative/fractional coordinates or out-of-range values return zero.
4. Reject empty or fully opaque alpha source. Preserve original WebP's partially transparent edge pixels so the UI's 64/255 threshold can be applied to the actual image.

The source spec contains the original SHA-256 value from the Graphics manifest as **expected provenance metadata**, not a claim of fetching/verifying remote asset bytes cryptographically in the browser. Core 8B/Items 2B item identity, trusted network integrity and server transaction authority remain independent. This sampler **never** approves attacks, suppresses Combat or commits item pickup.

The prior `web/armory-p0-world493-ui-review.mjs` has been updated to call **this same module** for both Graphics alpha hit-testing and the untouched hardened UI #503 independent verification; the duplicated handwritten `getImageData` pixel indexing was removed.

## Browser QA and acceptance boundaries

Exact original World #493 SHA `07060f981b8a1dac89184b621b6893dd970a08ae` and UI #503 SHA `8d500d8ddeb4058f15dbc704bf78d685d1ca31ef` are separately pinned by the native harness, and the 3B original WebP/planner hashes are byte-verified. The existing Chrome 154 / Firefox 153 source-based gesture matrix is rerun with the new sampler:

- Pixel (20,13) is partly opaque in the original WebP (alpha 159): visual sword candidate, without server pickup.
- Pixel (0,0) has source alpha 0: no sword interaction, simulated ordinary Combat fallback only.
- Drag off, revision change or sprite removal after pointerdown cancels without a fallback attack.
- A 390px CSS canvas at device scale 2 still maps to the source 640×640 backing coordinates and selects the same original sword.
- Forged callback alpha, mismatched source pixel, off-canvas pointer and stale presented frame are rejected by *original* UI #503.
- Captures and structured report remain source-only. No claims of actual live arena scene, four authenticated players, correct equipped Silver Knight MainHand, server LOS, atomic item pickup or Combat stability.

**Main live blockers:** World/Core trusted complete geometry+worker epoch, Core8B/Items2B canonical 128-bit ID and durable single-writer receipt/observer replication, Core8A trusted reliable message router, UI #503 + Combat 4 single gesture owner (no parallel rectangular #489), true Silver Knight sword-vs-fists presentation, real four-client Chrome/Firefox city→armory→PvP acceptance. Existing PR #500 parent M194 CI failure remains recorded; #508 full protected CI passed; #512 and new head require their own strict CI. No test/runner weakening, merges or deploys.

**Classification:** IMPLEMENTED + isolated cross-branch TESTED, NOT INTEGRATION-READY, NOT INTEGRATED, NOT PLAYABLE.

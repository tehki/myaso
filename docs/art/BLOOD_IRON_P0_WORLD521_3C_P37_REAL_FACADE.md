# 🌕⚡️🚀 Graphics 3B P0 — authentic Red Lion facade under World #521 + Graphics 3C P37

**First Playable Alpha / source-only draft.** Independent original source integrations, no runtime activation, server authority, new world geometry or merge.

## Exact reviewed inputs

World #521 `3178b9aad8757ceb3594ff04b9e3099dced6b729` owns `normalizeWorldBuildingReplacementIds`, authoring, portal and threshold. Graphics 3C P37 #419 `efdbf0b0c985fffbc4cf89285f41fcdc8ad983ac` owns the actual Greyhaven environment painter/cached 512-unit terrain and outdoor lighting. Graphics 3B A2.31 #466 `0cbf33adf70beda55b8fcb8bef4ba2efb36084e5` owns the source Blender-modeled day/dusk facade and historically frozen A2.26 roof.

3B original day WebP SHA256 `f45ca685364666e7911128b75180eb1dea5636b48ab2ae5538cc37523ec2dfd0`; dusk `4b7d58f1dc3469ec612c3ac861089ed6665c2118fa27eb7b2fbb1914f55776c3`; frozen roof `f65554286ea1bb8b80562c72539d82172fd3ea8cc97e6b9d0d3203057a1aedc1`. Source Git heads and critical file hashes checked independently. No source asset bytes modified.

## Genuine Chrome and Firefox test

The visual reviewer `web/armory-p0-world521-3c-p37-facade.html/.mjs` imports **actual** 3C P37 `createAuthoredWorldRenderer` and **actual** World #521 `normalizeWorldBuildingReplacementIds`. Only `replacedBuildingIds:['red-lion']` with the original World callback is permitted. The two original 3B 228×297 facade source WebPs are drawn over the replacement-free terrain at the A2.31 historical visual anchor (4365,4075), native image offset (-114,-269). The frozen 238×197 roof remains at original offset (-119,-283), no redesign or invented new glow layer.

Original World gameplay entrance `(4365,4060)`, original World interaction portal and visual depth at y4075 remain untouched. The original 3C cached paint includes its own lantern, so this does NOT create an extra independent 3B sconce/pool engine. This does **not** certify correct nighttime light accumulation, 60FPS or actual player facade-depth occlusion.

**Genuine native Chrome 154.0.8037.99 and Firefox 153.4.0** each successfully loaded all original source modules/assets and painted day/dusk. Default 3C placeholder vs World-authorized suppression changes **35,936 Chrome / 36,079 Firefox RGBA pixels**. Adding actual 3B daylight/dusk facade changes **62,727 pixels for each mode** relative to suppressed terrain, while the day and dusk composites are also actually pixel-distinct from each other. The Blacksmith viewport remains **0 changed pixels** when toggling *only* Red Lion replacement in both browsers. `smith` rejection and missing World validator rejection both PASS. No page/module errors.

Full original source/measurements and native screenshot PNGs: `assets/environment/greyhaven/armory-p0/facade-p37-review/red_lion_3c_p37_native.json` and `red_lion_3c_p37_3b_chrome.png`, `red_lion_3c_p37_3b_firefox.png`. Reproduce on original pinned source checkouts with `tools/art/verify_p0_original_facade_3c_p37.mjs`. Test file `tests/armory-p0-original-facade-3c-p37.test.mjs` adds three focused original-source assertions. All **42/42 cumulative P0 Graphics focused tests PASS locally**.

## Remaining integration HOLD

This is a **read-only source-art reviewer**. The actual `web/online-game.mjs` was not changed, original World placeholder rendering remains default outside this page, no live Red Lion actor sorting is established, no actual Greyhaven wall/portal authority or multiplayer state is tested. 3B facade still requires Graphics Orchestrator visual approval, World/3C cache integration under one approved World validator, 3A human actor depth and authentic animation. World Blacksmith/physical four swords and Core/Items/UI/Combat single-writer/gesture contracts remain separate P0 tasks. X230i module resource issue is not resolved by passing Windows Chrome/Firefox.

Parent Graphics #559 exact-head protected quality #39612632398 **SUCCESS**; new child head requires its own full quality. No mandatory Combat/Rust tests altered or waived, no merge/deployment.

**Status: IMPLEMENTED source review / isolated Windows Chrome+Firefox TESTED / INTEGRATION-READY BLOCKED / NOT INTEGRATED / NOT PLAYABLE.**

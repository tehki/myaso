# Moon Games / Graphics 3A — First Playable R4 Forward Roll Review

**Status: EXPERIMENTAL / VISUAL HOLD. Not integration-ready.** First Playable P0 rendering defect investigation, dated 2026-10-21.

This is an inspectable, **source-real** comparison of the previous belly-centered adult forward roll and a candidate with anatomical adult bodies and retargeted real human motion. It does NOT activate new art in the gameplay renderer, move the authoritative player, alter hitboxes, establish actual Greyhaven ground collision, or satisfy human approval.

## Inspectable preview

Serve the checked-out repository from its root with `python -m http.server 8765` and navigate in Chrome or Firefox to:

**http://localhost:8765/web/adult-roll-r4-review.html**

The page renders both male and female with original A2 and experimental R4 rolls, plus the original Silver Knight PR408 reference. It supports Play/Pause, previous/next frame, exact scrubbing and highlighting all eight directions. Five decoded 1280×1280 WebP 8×8 atlases appear. The R4 source-roll nominal playback duration is 350ms; the sample intervals (40/40/50/40/40/50/40/50ms) reflect a review-optimized **GIF sample**, not an approved Combat phase-boundary model.

The full animation source loops:

- [New R4 350ms loop, both genders, eight directions](adult-roll-r4-both-bodies-all-8.gif).
- [Old A2 vs new R4 350ms loop, both genders, eight directions](adult-roll-a2-versus-r4-all-8.gif).
- [Static new pose contact sheet](adult-roll-r4-both-bodies-all-8.png).
- [Static old/new pose contact sheet](adult-roll-a2-versus-r4-all-8.png).

The actual native browser captures are committed here:

- [Chrome: start](r4_chrome_frame0.png) · [middle](r4_chrome_frame3.png) · [recovery](r4_chrome_frame7.png)
- [Firefox: start](r4_firefox_frame0.png) · [middle](r4_firefox_frame3.png) · [recovery](r4_firefox_frame7.png)
- [Chrome JSON verification](r4_chrome.json) · [Firefox JSON verification](r4_firefox.json).

Verified independently: Chrome **154.0.8037.99**, Firefox **153.4.0**, **64/64 direction × frame checks per engine**, zero page/network errors; all five actual source atlases decode. There are no synthetic browser screenshots. This is **not a gameplay browser test**.

## Why the old roll fails and R4 is still HOLD

Original A2 visually spins around the pelvis, with only an illusion of forward motion; it does not have a convincing shoulder brace, tuck or plant. The owner rejected this. A manually sculpted R3 candidate still looked like an airborne somersault; it too was rejected during internal visual inspection.

R4 uses [CMU Motion Capture Database](http://mocap.cs.cmu.edu/) source **128_10.bvh**, selecting source frames **37 / 73 / 97 / 121 / 157 / 193 / 253 / 313** at original ~120Hz. The full animation is a human running into a diving shoulder-tumble and rising; these eight poses have been compressed into the game's **350ms visual budget**, which is an aggressive retiming. The avatar's authored root travels approximately **1m** in the preview. Its lowest skinned-vertex envelope was normalized to approximately 0.035m above an *isolated plane*, not a measured foot/shoulder physics contact solver. That does **not** prove an online player can roll without sliding or that shoulder, wrist and foot impacts are correctly planted.

**Internal visual verdict: R4 is better than A2 but still not visually accepted.** Inverted/tumbling poses can look airborne, the compressed recovery and arm bracing are unnatural, and female/masculine gait and foot contact still require professional visual review. The next correction should author grounded shoulder/forearm contact and retime the transition inside 350ms, not simply rotate the whole body.

## Original anatomical source and licenses

R3 replaces the primitive-sphere adult body with the first-party-adjusted **MakeHuman Community / MPFB2** CC0 human base object `src/mpfb/data/3dobjs/base.obj`, its adult male/female CC0 morph targets (African/Asian/Caucasian mix at equal source weights), and a game-compatible retarget to the existing **22-bone adult rig**. Actual original editable source pairs for both adults are in `assets/characters/adult-anatomy-r3`; their output mesh has **19,158 vertices / 13,378 body faces**. This is an isolated preview study and not a claim of perfect anatomy or finished medieval styling.

The MakeHuman `base.obj` header explicitly states its **CC0 September 2020** release. The source graphical files are included for reproducibility under `assets/characters/upstream-makehuman-r4`, plus the original `128_10.bvh` in `assets/characters/upstream-cmu-r4`. These are source input assets, **not bundled MakeHuman program code**. The CMU data source archive is `Shriinivas/cmubvh/Sequence-113-128/128/Data/128_10.zip`, originally from Carnegie Mellon's motion-capture database, which makes the data available for all uses. Keep this provenance on subsequent derivatives. See `assets/characters/upstream-makehuman-r4/source-provenance.json`.

Reproduction (Blender 4.5.14; Python Pillow for atlas packing):

```sh
blender -b --python tools/art/author_anatomical_shoulderroll_r3.py -- --body adult-masculine
blender -b --python tools/art/author_anatomical_shoulderroll_r3.py -- --body adult-feminine
blender -b --python tools/art/retarget_cmu_roll_r4.py -- --body adult-masculine
blender -b --python tools/art/retarget_cmu_roll_r4.py -- --body adult-feminine
python tools/art/pack_cmu_roll_r4.py
node --test tests/adult-mocap-roll-r4.test.mjs
```

No intermediate `.r3-frames/` / `.r4-frames/` PNGs are committed. They are regenerated by the source tools. The committed WebP atlases include per-file SHA256 manifests and the Blender `.blend` / `.glb` binaries remain editable for art direction.

## P0 First Playable integration gates

1. **Graphics 3A:** R4 should receive a corrected, weight-shifted and braced forward-roll art pass before owner review. Prefer ground-contact silhouettes and physical translation over cosmetic material additions. Source sprites are only a stepping stone to live evaluation.
2. **Combat / Core contract:** 170ms dodge active + 180ms recovery = 350ms visual art contract. Root travel in Blender is **visual reference only**. Actual movement, hitboxes, timestamps, client prediction and server authoritative positions remain Combat/Core-owned. The source MUST NOT drive independent player position.
3. **World / Graphics 3B:** create a nonproduction isolated integration viewport running *actual* `web/online-game.mjs` with Greyhaven ground, building facade/occlusion and a real player actor. The R1 Red Lion art composite is not acceptable as in-game proof. Test real moving player and remote observer in Chrome+Firefox / independent-machine acceptance.
4. **Protected CI:** parent source review [#472](https://github.com/tehki/myaso/pull/472) exact-head [run #39527692784](https://github.com/tehki/myaso/actions/runs/39527692784) failed mandatory M194 guard-break. Root cause not attributed to this art. Its parent A2 [#457](https://github.com/tehki/myaso/pull/457) was red at M205/M201 server-tick punish. Central orchestration and Combat own coordination on those acceptance gates; do not disable tests.
5. **Release:** preserve the current default renderer and original opt-in Knight art. No PR merge or deployment without exact-head CI green, shared integration contract, real in-game Chrome+Firefox evidence and explicit human visual approval.

**Classification:** IMPLEMENTED source study; TESTED in isolated native browsers; **NOT INTEGRATION-READY**, NOT INTEGRATED, NOT PLAYABLE with these new adult graphics.

# Blood & Iron — Graphics 3A adult locomotion A1

**Status:** original source-authored walking and running studies, **not** release-approved game animation. Stacked on [A0 source character art PR #433](https://github.com/tehki/myaso/pull/433) and the dormant appearance contract [#423](https://github.com/tehki/myaso/pull/423). Tracks [adult bodies #421](https://github.com/tehki/myaso/issues/421).

## What is actually implemented

Two originally generated first-party adult characters with separate masculine/feminine presentations and no permanent garments or weapons. This follow-up starts from the **existing A0 GLBs** and retains their source mesh and 22-bone named rig, as well as their original `idle` action.

`tools/art/author_adult_locomotion_a1.py` adds genuinely keyed Blender actions named **walk** and **run** to both rigs. A separate `.blend` and `.glb` is exported for each body under `assets/characters/adult-body-a1/`. The exporter includes all three distinct actions—`idle`, `walk`, and `run`—not a clip alias. The four movement sampling phases are Blender frames 1, 5, 9, and 13, with frame 17 repeating the starting pose to close the cycle.

Each authored action is rendered as **8 directions × 4 original 160×160 RGBA tiles** (64 new source frames per character for two actions) and packed with `tools/art/pack_adult_locomotion_a1.py` into four additional 640×1280 WebP atlases. Source PNG intermediates live in `.a1-frames/` and are not shipped; all adult A0 source `.blend`/`.glb` and idle WebPs remain unchanged.

The nonauthoritative `web/adult-body-a1-preview.html` provides body type, animation action (idle/walk/run), and eight facing directions, displaying both bodies at an unmodified **96×96 idle/movement destination**. It imports the existing appearance contract and does not grant physical inventory or fake an equipped item. The production game renderer and opt-in Knight path are not touched.

## Build from committed original sources

Use Blender 4.5.14 LTS, Python 3 and Pillow. From repository root:

```sh
blender -b --python tools/art/author_adult_locomotion_a1.py -- --body adult-masculine
blender -b --python tools/art/author_adult_locomotion_a1.py -- --body adult-feminine
python tools/art/pack_adult_locomotion_a1.py --body adult-masculine
python tools/art/pack_adult_locomotion_a1.py --body adult-feminine
node --test tests/adult-body-locomotion-a1.test.mjs tests/adult-body-a0.test.mjs tests/character-appearance.test.mjs
```

The original A0 source-art deliverable is [A0 build and provenance](docs/art/BLOOD_IRON_ADULT_BODY_A0.md). This follow-up preserves the canonical `160px` source frame, 8-row facing convention, approved `120%` presentation/96px standing size and unchanged Combat/server state.

## Visual truth and release gates

The leg/arm motion is a simple first-party animation study of knee bending, opposite arm swing and vertical weight transfer. **It does not prove realistic gait, grounded shoes/feet, collision floor contact, precise pelvic mechanics, natural walk/run transitions or absence of foot skating.** Existing actor ground pivots, Greyhaven cobblestones, Red Lion door and roof fades have not been verified for this movement atlas.

The **350ms roll** (170ms Combat dodge active +180ms recovery) is **not part of this A1 work**; do not show an idle/walk/run action while authoritative Combat reports roll, attack, kick, parry, knockdown, stun or death. Such unsupported states must continue to fall back truthfully. The existing Silver Knight/T1 Sentinel renderer remains independently opt-in.

The A0/A1 previews are local and nonauthoritative. Real player selection, world rendering, networked equipment changes, server-owned full loot, third-person spectators and persistence require Core, Magic & Items, UI and central integration review. **No naked-body production activation or gameplay modifications.**

## Actual browser evidence / tests

Run `node tools/art/verify_adult_locomotion_a1_browser.mjs <outdir>` with a locally installed Puppeteer Core module via `PUPPETEER_MODULE_URL`, and `ADULT_QA_BROWSER`/`ADULT_QA_EXECUTABLE` for native Chrome or Firefox.

The browser verifier asserts all **6 real adult WebP atlases** load (A0 idle ×2, A1 walk/run ×4), each **2 bodies × 3 actions × 8 directions = 48 UI cases** renders its correct base-body layer, preserves 96px display and has no page/network errors. It captures a native browser screenshot and JSON evidence. This verifies the **standalone preview only**; it must not be reported as multiplayer/combat browser acceptance.

A1 Node tests check original source .blend/GLB magic headers, 22 joints, three exported animation action names, all atlas RIFF/WebP bytes + SHA256, and isolated nonproduction scope. Work requires new exact-head protected CI and art-director approval before any integration.

**Hold:** no merge/deploy, no source-overwriting, no claim of production realism. Next approved work is authored adult roll and anatomically refined equipment-ready rig/attachment layers.

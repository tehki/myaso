# Blood & Iron — Graphics 3A adult roll A2

**Status:** original rigged adult-body forward-roll source and 8-direction transparent WebP art candidate; **review-only / dormant**, not a production gameplay change. Builds on [adult idle A0 #433](https://github.com/tehki/myaso/pull/433) and [walk/run A1 #448](https://github.com/tehki/myaso/pull/448) under [appearance contract #423](https://github.com/tehki/myaso/pull/423) and [assignment #421](https://github.com/tehki/myaso/issues/421).

## Original animation source

`tools/art/author_adult_roll_a2.py` imports **only** each originally generated A1 GLB. It reuses the established 22-bone rig and original male/female bare skin. It creates a fourth independent Blender action `roll`; `idle`, `walk`, `run` remain available. A new, editable per-body `.blend`, `.glb` and machine-readable rig/action report are committed under `assets/characters/adult-body-a2/`.

The roll is a keyed forward tumble around the adult root pelvis and skeleton, with crouch, head tuck, knee flexion, forearm support, inversion and recovery. **Source frames 1–22 at 60fps span 350ms**; the same legacy presentation specification is 170ms active Combat dodge followed by 180ms recovery, with **no change to the authoritative state machine, hitboxes, server i-frames, action durations or movement**.

The original Blender 4.5.14 source samples are frames `1, 3, 5, 7, 9, 11, 15, 22`. Eight camera directions use the same A0/A1 order: south, southwest, west, northwest, north, northeast, east, southeast. Each frame has an original **160×160 RGBA** pixel render; `tools/art/pack_adult_roll_a2.py` combines each body’s 64 renders into one **1280×1280 8×8 WebP atlas**, with SHA-256, alpha and size verification. Intermediate PNGs in `.a2-frames` are excluded from Git and regenerate from first-party Blender sources.

`src/browser/adult-body-roll-a2.mjs` is a **nonactivated, pure source-preview timing helper** that validates direction/elapsed time, preserves monotonic frame advancement across the 170ms active-to-recovery boundary and selects the original A3 approved **134×134 visual roll rectangle** at 120%. It cannot trigger a gameplay roll or alter authority.

## Reproduction

From repository root with Blender 4.5.14 LTS and Python Pillow:

```sh
blender -b --python tools/art/author_adult_roll_a2.py -- --body adult-masculine
blender -b --python tools/art/author_adult_roll_a2.py -- --body adult-feminine
python tools/art/pack_adult_roll_a2.py --body adult-masculine
python tools/art/pack_adult_roll_a2.py --body adult-feminine
node --test tests/character-appearance.test.mjs tests/adult-body-a0.test.mjs tests/adult-body-locomotion-a1.test.mjs tests/adult-body-roll-a2.test.mjs
```

Local preview page `web/adult-body-a2-preview.html` imports the dormant appearance contract and displays body selection, eight directions and available `idle/walk/run/roll` clip art. All bodies remain initially **bare/unarmed and unequipped**, with no invented physical items, wardrobe or inventory ownership. The source roll uses the approved 134px rectangle rather than stretching standing artwork.

Run the native browser evidence program `node tools/art/verify_adult_roll_a2_browser.mjs <output-dir>` with installed Puppeteer Core via `PUPPETEER_MODULE_URL`. Set `ADULT_QA_BROWSER=firefox` and `ADULT_QA_EXECUTABLE` to Firefox for that engine, or select Chrome. The test checks 2 bodies × 4 clips × 8 directions = **64 standalone-preview states**, source/destination atlas correctness, action readability and successful loading of all 8 shipped adult atlases, then writes an authentic screenshot and JSON.

## Strict limitations and art review blockers

- The forward tumble is a **procedurally rigged movement study, not ground-contact-approved realism**. Shoulder/arm support, anatomical deformation, actual floor collision, camera grounding and foot skating remain to be assessed against authored Greyhaven and the Red Lion Inn.
- The asset alone **does not establish an in-game roll animation**. Live game player identity, authoritative Combat `dodge`→`dodgeRecovery` lifecycle, remote snapshot/appearance replication, new adult body renderer integration and full server-owned equipment are still separate owner-gated work.
- Under no circumstances should an unsupported attack, parry, kick, jump, stun or death state be substituted with `idle` or `roll`. Missing atlases require a truthful existing Combat renderer fallback. No activation of default anatomy or in-game nudity is authorized.
- This PR does not modify Silver Knight/T1 Sentinel prototypes or source GLBs, their 350ms roll, existing Combat tests, gameplay movement or hitboxes.
- Existing parent PRs and the strict protected cross-browser Combat CI must pass and be reviewed before A2 can be considered for integration. No CI test may be disabled or bypassed.
- Texture memory and actual crowd GPU cost, live online two-browser acceptance, world depth/roof occlusion, privacy-cover rendering and full-loot/equipment removal remain outstanding.

**Acceptance sought:** real first-party Blender roll source exists for both adult skeletons; honest 350ms 8-way source art and 134px presentation maps correctly in independent Chrome/Firefox preview; all source/atlas hashes, four actions, scale and action-phase tests pass. This is **not** an assertion that a production character can roll in Greyhaven today.

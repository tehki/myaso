# Blood & Iron — Graphics 3A adult base-body A0

**Status:** original-source **form study**, rigged 3D models + eight-direction animated idle atlas. **Not final medieval realism, not activated in the live game.**

## Goal and design boundary

Tracking [adult character assignment #421](https://github.com/tehki/myaso/issues/421) and extending the dormant visual contract [#423](https://github.com/tehki/myaso/pull/423), without duplicating its source or changing its schema. Two adult presentations exist, `adult-masculine` and `adult-feminine`. They start with no apparel, armor, or weapons attached to the base model. The optional client-local modesty layer belongs to the existing appearance contract and is *not* an inventory item.

All mesh geometry and materials are **original first-party procedural Blender authoring** from the committed Python source. No owner-supplied Knight GLBs, foreign models, game textures or copyrighted external skins were imported. Body height follows an approximately **1.8 m** adult proportion convention, but **actual Greyhaven ground contact and door/roof occlusion remain unmeasured**.

## Generated original sources

| Source | Adult masculine | Adult feminine |
| --- | ---: | ---: |
| Blender 4.5.14 file | `assets/characters/adult-body/adult-masculine.blend` | `assets/characters/adult-body/adult-feminine.blend` |
| Rigged exported GLB | `assets/characters/adult-body/adult-masculine.glb` | `assets/characters/adult-body/adult-feminine.glb` |
| Deformable skin mesh vertices | 9,118 | 9,176 |
| Skeleton bones | 22 | 22 |
| WebP RGBA idle atlas | 40,718 bytes | 43,134 bytes |
| Idle poses | 4 | 4 |
| Directions | 8 | 8 |

Each generated `.blend` file is editable. The 22-bone skeleton follows a shared biped naming set: Hips, Spine, Spine1, Spine2, Neck, Head plus left/right Shoulder, Arm, ForeArm, Hand, UpLeg, Leg, Foot and ToeBase. Source reports list all names and original generation parameters.

The skin mesh is procedurally assembled from anatomical ellipsoids, fused through Blender voxel remeshing and assigned three nearest-bone influences, then given a short neutral breathing/head idle pose. This **does not yet provide production-quality joint deformation, facial realism, fingers/toes, morphs, anatomical approval or complete movement animation**. A0 is a genuine source-art milestone, not a claim of completed realistic character creation.

## Reproduce source art / build atlas

Use the installed Blender 4.5.14 LTS binary and Python Pillow; launch from the repository root.

```bash
blender -b --python tools/art/build_adult_body_a0.py -- --body adult-masculine --outdir assets/characters/adult-body --frames-dir .a0-frames/adult-masculine
blender -b --python tools/art/build_adult_body_a0.py -- --body adult-feminine --outdir assets/characters/adult-body --frames-dir .a0-frames/adult-feminine
python tools/art/pack_adult_body_a0.py --body adult-masculine --frames-dir .a0-frames/adult-masculine --outdir web/assets/adults
python tools/art/pack_adult_body_a0.py --body adult-feminine --frames-dir .a0-frames/adult-feminine --outdir web/assets/adults
node --test tests/character-appearance.test.mjs tests/adult-body-a0.test.mjs
```

The eight rows are south, southwest, west, northwest, north, northeast, east, southeast; each row holds **four 160×160** breathing idle frames, at 60-fps authored keyframe indices 1/5/9/13. Browser WebP atlases are **640×1280**. Source PNG frame intermediates are deliberately **not committed**; they regenerate deterministically from the Blender script and are not authoritative game art. Output WebP encodes at quality 82.

## Verified browser acceptance

The local page `web/adult-body-a0-preview.html` imports the existing #423 contract, shows a bare unarmed base body at **96×96 sprite destination**, allows selecting body presentation and eight directions, and renders both original source atlases. This preview has no inventory or network authority.

Real headless Windows browser checks via `tools/art/verify_adult_body_a0_browser.mjs`:

| Browser | Atlases | Cases | Page/network errors |
| --- | ---: | ---: | ---: |
| Chrome 154.0.8037.99 | 2/2 | 16/16 | 0 |
| Firefox 153.4.0 | 2/2 | 16/16 | 0 |

Local QA screenshots and JSON reports are generated under `.a0-browser-chrome/` and `.a0-browser-firefox/`; those temporary directories are intentionally not committed.

## Safety and future integration

- No edits to `web/online-game.mjs`, Combat, Rust game state, protocol or `web/assets/knights/`. Default multiplayer art stays unchanged.
- The appearance contract's Body/MainHand/OffHand mapping (`LeatherArmor`, `RustySword`, `Spellbook`) is imported, not redefined. **Items remain server-owned**. This PR contains **no equipment attachments, pickups, drop mechanics, live character selection, replication or full-loot effects**.
- The real-world 0.025 m/unit scale, zoom 0.84, grounding and Greyhaven shadow/roof layers need an accepted shared game-space projection fixture before production.
- Required follow-up: approve anatomy and original source license/provenance, rig deformation QA; implement 8-direction walk, run, full 350 ms roll, jump and Combat actions with truthful fallback; real in-game Chrome/Firefox and multiplayer visual acceptance; equipment overlays only after Core/Magic identity/loot contracts.
- Release status remains **HOLD**. Merge/deployment rights stay with the Development Center. No nude character production activation.

**Blood & Iron: a bare human is the foundation, never a permanent Knight costume.**

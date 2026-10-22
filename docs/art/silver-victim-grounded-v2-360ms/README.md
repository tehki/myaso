# Graphics 3A — original Silver victim knockdown grounded V2 (source-space correction)

**Draft, no merge / release GO.** Owner's *same original* Silver Knight 22-bone GLB SHA `d679fccd00df868d600b4c5e2fcf8a4a46cc062dbd432be5b6a7f533eb30141f`; source pose revision on child of [PR #780](https://github.com/tehki/myaso/pull/780), whose **actual three-browser game screenshots** revealed that V1's low pose appeared partly suspended/under-readable in the minimal arena. No replacement mesh, actor-root translation, Rust server, Combat, damage/hitbox, camera or normal art activated.

## Measured original rig improvement

Independently re-imported original owner `silver-knight.glb` in Blender 5.2.2, sampled the **evaluated skinned original armor mesh** (105,842 vertices, `geometry_0`) at *every one* of eight original 360ms pose keys. Excluded the unrelated static `Icosphere` helper from the floor metric; measuring it would have falsely suggested ground contact. Compared the lowest original armored mesh vertex to the **original idle contact height**, in original rig units — never guessed screen pixels. Modified **Spine**, **Spine1** and knee-fold source poses but **not** the actor/world root, bone lengths, original mesh, animation authority or time budget. Original attack V3 unchanged.

| Authentic Blender original rig metric | Earlier source V1 | Revised original source V2 |
| --- | ---: | ---: |
| Head descending during low fall | 0.378216 | **0.496770** |
| Head-to-lowest actual skinned-armor point at low pose | ~0.338 | **0.233759** |
| Largest original mesh low-point deviation from idle floor (all eight source keys) | ~0.011 | **0.011022** |
| Root/world movement | 0 | **0** |
| Action duration | 360 ms | **360 ms** |

The local source V2 tests require max lowest-point deviation **<=0.025 source units** from the original idle skinned armor minimum, head-to-armor floor .16–.25 at contact, independent 22-bone action reopening, identical original GLB input SHA, exactly 64 real Cycles renders and no owner mesh redistributed. These are **actual mesh-space contact measurements**, not real Greyhaven floor/terrain/boot IK or 0.84 camera verification. Source ankle pose/weight may still be imperfect; the shadow in the game is rendered separately, and V2 visual image must be examined.

## Original full deliverables

- [Eight-direction original Blender grounded-V2 victim action GIF](original_silver_victim_grounded_v2_8way_360ms.gif)
- [64 genuine original armature Cycles cells — lossless 1280×1280 WebP](original_silver_knockdown_grounded_v2_360ms_8way.webp)
- [Editable original 22-bone grounded-V2 action-only .blend](Graphics3A_Original_Silver_Victim_Knockdown_360ms_GroundedV2_source.blend)
- [Independent Blender reopen — source head drop and original armature integrity](independent_grounded_v2_reopen.json)
- [Original evaluated skinned-armor mesh source-floor measurements for all eight frames](original_silver_knockdown_source_manifest.json)

Rebuild on authorized original GLB:

```bash
blender -b -t 2 --python tools/art/author_original_silver_knockdown_grounded_v2.py -- --source /path/to/silver-knight.glb --output ./source-frames --engine CYCLES --samples 1
python tools/art/pack_original_silver_knockdown_grounded_v2.py --input ./source-frames --output docs/art/silver-victim-grounded-v2-360ms
blender -b docs/art/silver-victim-grounded-v2-360ms/Graphics3A_Original_Silver_Victim_Knockdown_360ms_GroundedV2_source.blend --python tools/art/audit_original_silver_knockdown_grounded_v2.py -- docs/art/silver-victim-grounded-v2-360ms/Graphics3A_Original_Silver_Victim_Knockdown_360ms_GroundedV2_source.blend docs/art/silver-victim-grounded-v2-360ms/independent_grounded_v2_reopen.json
```

## Genuine multiplayer trial (separate from source space)

In this **isolated, opt-in-only QA draft branch**, `web/assets/knights/silver_knockdown.webp` is byte-identical to the new grounded V2 Cycles original atlas instead of parent V1, with all four existing opt-in query gates still required: `?knights=1&knightKickSource=1&knightKickV3=1&knightKnockdownSource=1`. The default/Pre-Alpha renderer remains off. The genuine M153 scenario (Chrome attacker, Firefox server-knocked-down victim, Chrome2 witness) plus independent original V3 kicker/3-browser source acceptance and actual passive game Canvas low-pose PNG capture must be rerun on the *exact new head*:

```bash
MYASO_PVP_SCENARIO=uikickknockdownffa \
MYASO_GRAPHICS3A_V3_KNOCKDOWN_FLIGHT=1 \
MYASO_GRAPHICS3A_ORIGINAL_VICTIM_FLIGHT=1 \
MYASO_GRAPHICS3A_VICTIM_NATIVE_PNG=1 \
MYASO_GRAPHICS3A_GROUNDED_V2_FLIGHT=1 \
node scripts/pvp_browser_flight_runner.mjs
```

The additional environment gate demands all previous real-browser qualifications and checks the original V2 WebP SHA `5b3af4e2124a6b1315d0c14396eaaf3815fcf6af21d0662592d9e448e39f7bc9` before emitting `GRAPHICS3A_GROUNDED_V2_REAL_KNOCKDOWN_PNG`. Dedicated CI captures unmodified actual 960×540 native game Canvas screenshots from all three browsers to **one-day GitHub artifact**, strict file-found policy. Independent full protected `quality` must also pass. Real screenshot inspection may reveal lingering float/readability problems; that is an **ART HOLD**.

**Not proven:** Greyhaven actual terrain contact, 0.84 world camera, exact world sole/IK and center of mass, physics ragdoll, hit mesh-point and HP damage (M153 is deliberately non-damaging), attack hit VFX/SFX, actual humans, final original source signoff. No production gameplay replacement, no merges/deploys without Main, Graphics, Combat/owner acceptance.

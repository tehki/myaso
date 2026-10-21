# 🌕⚡️🚀 Graphics 3B P0 — actual four Silver silhouettes around the physical Blacksmith swords

21 October 2026 · First Playable #480, real four-sword Blacksmith #488, Graphics animation-completeness gate #542.

**Evidence is original-source real browser static art, NOT four connected players. No runtime or authoritative gameplay changes.** This is a small draft child of Graphics #540 → #529, not a competing game or inventory roadmap.

## Why this check was needed

World #521 has four authored Blacksmith sword anchors at (3740,4038), (3780,4038), (3820,4038), (3860,4038) and four pickup approach stands at identical x with y=4088. Centers are only 40 world units apart. The owner-approved original 3A Silver Knight **standing** presentation scales a 160px original frame to a 96×96 CSS/Canvas sprite (120%), which might appear to overlap both the sword rack and other players. Separate tests of an empty rack or one UI pointer cannot prove four simultaneous avatars leave the four sword targets visible.

## Genuine source inputs and reproducibility

The isolated real Chrome/Firefox browser loads original **World #521** exact head `3178b9aad8757ceb3594ff04b9e3099dced6b729` (authored map + terrain renderer + four socket fixture), original **Graphics 3A Silver Knight #326** exact head `c74fcf90e227f3bc4788728f000cfe6aa083c7ef` (unchanged 640×1280 `silver_idle.webp` with original `KNIGHT_PRESENTATION_SCALE`, `knightPresentationRect`, `spriteAtlasRect`), and the already existing **Graphics 3B #540** original Blender rack, sword WebP, four World-scoped art commands and successful Canvas painter.

All original source Git HEADs and actual source SHA256s are required in the browser harness. The original Silver idle WebP SHA is `828cf05dd873d0c8f35e887f5e46c35af87f084ac321977e358c985e7a2106b4`. Original #326 `knight-sprites.mjs`, `combat-readability.mjs`, `src/combat/model.mjs` are loaded unchanged. The fixture intentionally uses the **original Silver human** asset for all FOUR presented characters; do not choose T1 Sentinel art based merely on a player being remote. No fake 3D geometry or generated replacement artwork.

The art-only four illustration positions come directly from World-authored `rackSockets[].approach`. Camera is (3800,4038), game zoom is exact 0.84, original `projectArenaPoint` handles every actor. The page paints actual World tiles, original Blender rack and four individually separate sword WebPs, then paints the four 3A **idle frame 0 south-facing Silver Knight** sprites in World encounter order. No player/network/Items object is created.

## Actual pixels, not bounding-box assumptions

A separate 640×640 RGBA render of each actor and each sword is sampled with the same alpha≥64 pixel threshold. Pixel intersection counts from **actual native Chrome 154 and Firefox 153.4** agree:

| True source-pixel measure | Chrome | Firefox |

| --- | ---: | ---: |

| Four displayed Silver Knights | 4 | 4 |

| Four individually displayed Blender swords | 4 | 4 |

| Adjacent opaque actor pair 1↔2 | 18 px | 18 px |

| Adjacent opaque actor pair 2↔3 | 16 px | 16 px |

| Adjacent opaque actor pair 3↔4 | 17 px | 17 px |

| All three nonadjacent pairs | 0 px | 0 px |

| Total actor/actor pairwise opaque intersection | 51 px | 51 px |

| Each sword's opaque candidate pixels blocked by **any** standing Silver | **0** | **0** |

| Browser JS/network errors | 0 | 0 |

The four swords' actual source candidate pixel counts in slot order are **1019, 1007, 1004, 1031**. All stay unobscured by these four **static idle-frame** player illustrations. This makes a realistic visual pickup layout *possible* at the authoring sockets but does NOT prove there is no occlusion during rolls, kicks, jumps, pickup bends, crowding with 5+ players, an altered art frame, depth sorting or the live client.

### Native artifacts

`assets/environment/greyhaven/armory-p0/four-silver-review/armory_four_original_silvers_chrome.png` and `armory_four_original_silvers_firefox.png` are genuine browser screenshots; `armory_four_original_silvers_source_report.json` includes every source checksum, six source-pixel actor-pair intersections, four sword-vs-actor masks, exact World coordinates, explicit non-production status. `tools/art/verify_armory_four_silver_actors.mjs` reproduces on the authorized workstation using independent pinned original 3A and World source checkouts. `tests/armory-p0-four-silver-source.test.mjs` enforces the result without altering any protected Combat tests.

## Cross-department release dependencies

Core 8C #532 has independently tested four actual QUIC-player positions and mutual snapshots, but the source art screenshot here does **not** consume those network snapshots. UI 10 and Combat 4 must still own one true alpha gesture gate and set player-vs-sword pointer precedence for actual actor overlap. World/Physics own player-body collision and authored map; Core8B/Items2B own canonical single-writer item IDs, durable on-rack presence/equip/drop, physics range/LOS and pickup operation receipts; Core8A owns authenticated network delivery. Graphics 3A #542 owns all **actual** Silver animations (kick/dash/pickup/roll etc), rigged sword MainHand only after server commit. This 3B test covers **idle** only and cannot approve those animations.

No changes to World, UI, Combat, `web/online-game.mjs`, server, protocol, original 3A atlas or original 3B Blender assets. The old 3A optional sprite's `remote` parameter can choose the **T1 NPC clip** even for remote human players; the real human/NPC art classification must be fixed or independently verified by the Graphics 3A + UI/Core integration owners. This test explicitly keeps four human Silver sprites.

Parent Graphics #540 exact-head protected quality #39601358399 PASS all 165 steps; this new head must pass full protected CI itself. No independent merge/deploy and no false claim of First Playable.

**Status: original-source implemented / static Chrome and Firefox TESTED; integration-ready BLOCKED; not INTEGRATED or PLAYABLE.**

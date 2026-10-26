# Graphics 3B — Approved Quaternius cottage: source-only portability packet

**Date:** 26 October 2026. **Authority:** Graphics 3B art only; Main Orchestrator 0, World 9, Core 8C and Physics 6 own eventual runtime/world integration.

## Exact approved original source
The owner approved the real Blender day/dusk cottage imagery on [DRAFT #1054](https://github.com/tehki/myaso/pull/1054), exact frozen head `9fcf1da2ade6afb455d8514cacb8c179bd6a9b52`. Source-approved imagery: [actual Blender + source + genuine Chrome/Firefox #40314632747 SUCCESS](https://github.com/tehki/myaso/actions/runs/40314632747). This approved image includes correctly centered door, weathered plaster gable, warm dusk window **and door glass**, chimney smoke, and unchanged original Quaternius tiled roof. The small gray roof-trim line was visible at the time of approval and not claimed absent. Neither this source-only packet nor its CI renders a new image or claims owner approval of a new design.

Creator's Quaternius Medieval Village MegaKit **free Standard** edition, licensed CC0, is sourced by the existing exact `.gitmodules` and repository Gitlink (mode `160000`) to `J-Ponzo/gltf-medieval-village-megakit` commit `21104b4045261c28fc312360841ed1a7b0ac8782`. The independent creator-archive parity gate on the original review stack verified 176/176 source glTF files and selected model resource bytes in [#40196837310 SUCCESS](https://github.com/tehki/myaso/actions/runs/40196837310). The creator ZIP is **not redistributed** by this PR.

## Why a selective extraction is required
Read-only Git comparison: approved #1054's ancestor branch is **168 commits ahead** of protected `main` `6fa59b649112c272bcbc018b4a32bf963f9a5bba`, and it changes **112 total paths**, including historical Rust, network, World and Combat files. Current canonical Combat candidate #1036 is at `a312e857aafc4fcdc241403f98281932ebd9f56d` with **28/28** exact-SHA CI successes ([quality #40367422769](https://github.com/tehki/myaso/actions/runs/40367422769)), but remains separately under release HOLD. It must not be merged with the entire old art branch.

Auditing nine Quaternius-specific draft PRs (#1042/#1043/#1045/#1046/#1047/#1049/#1050/#1051/#1054) identifies exactly **22 distinct** art file paths, none already present on canonical #1036 or protected main. The source-only packet extracts **18** of them exactly by Git blob SHA and preserves the pinned original Gitlink, without changing their contents or importing original game's World/Combat source. It intentionally excludes **four World9/Red Lion-dependent comparison files**:
- `.github/workflows/graphics3b-p1-quaternius-standard-preview.yml`
- `tools/art/verify_quaternius_original_world_native_2d5.mjs`
- `web/graphics3b-quaternius-2d5-local-review.html`
- `web/graphics3b-quaternius-2d5-local-review.mjs`

The last module imports `src/browser/red-lion-live-art.mjs`, which is not in protected main or current canonical Combat P0. That harness belongs in a **separate authorized P1 original-World review**, not in a new unconditional P0 dependency. The source-only branch never claims the cottage is mapped, spawned, collided, entered or served to players.

## Verification contract
- Preserve original glTF Gitlink exact SHA and full unchanged authoring source blob SHA checks.
- Verify the original free Standard mesh/glTF dependencies with `tools/art/verify_quaternius_standard_source.mjs`, and parse the actual Blender authoring/baking Python.
- Run protected repository quality separately as applicable. The single old art-stack [quality #40314632789](https://github.com/tehki/myaso/actions/runs/40314632789) was **CANCELLED** on its existing 30-minute job limit during M205; it was neither a test assertion PASS nor a Combat FAIL. Do not waive M205.
- The new review branch is **source-only**, so a green source-only workflow is not a substitute for real new-head Blender rendering or native Chrome+Firefox.
- Before any authorized P1 game activation, Main 0/Graphics 3 must re-run actual original Blender, creator parity, sprite and native browsers in the proper P1 World9 source branch. World 9, Core 8C and Physics 6 must separately approve authored footprint, collisions, door/portal logic, four real-player network authority and rollback. P0 Combat has **zero dependency** on house art.

**Status:** frozen owner-approved source / new isolated draft packet / no original art mutation, production merge or deploy.

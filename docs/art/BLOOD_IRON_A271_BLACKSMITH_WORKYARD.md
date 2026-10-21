# Blood & Iron A2.7.1 — Blacksmith entrance and forge workyard correction

**Status:** art-only review correction for the user-observed Blacksmith doorway obstruction. No production/browser-world activation.

## Before and after

The original A2.2 blockout put the open stone forge at (13.3, 6.95, 0.62) and orange embers at (13.3, 6.48, 0.92), intruding into the doorway approach at approximately X=12.6. The anvil and stand were correctly placed at (10.7, 6.4, 0.92) and (10.7, 6.4, 0.51).

The corrected **editable source generator** places the stone forge at **(9.3, 6.05, 0.62)**, on the left side of the anvil, with its firebox mouth at **(9.3, 5.60, 0.90)** and orange embers exposed at **(9.3, 5.54, 0.92)**. The firebox face is dark iron, so the ember glow is visible rather than buried within the stone. The anvil, stand, building, door and doorstep are unchanged.

The forge's rightmost X edge is **9.95 m**; the anvil's leftmost X edge is **10.275 m**. Thus their horizontal edge clearance is **0.325 m**. Both props are outside the 1.90 m-wide visual entrance corridor **X 11.65–13.55**, from Y 5.65–7.60. The renderer asserts this from actual evaluated Blender bounding boxes and checks neither prop overlaps the door or doorstep. This is **art bounding-box QA**, not an authoritative game collision/pathfinding test.

## Rebuild / rollback

The historical A2.2 .blend in GitHub is intentionally untouched. `tools/art/build_blood_iron_a2.py` now authors corrected workyard coordinates for future full rebuilds, and `tools/art/render_greyhaven_a26_billboards.py` applies the same measured fix to the historical A2.2 source **in memory**. The latter also supports a focused `--only blacksmith` rebuild, preserving reviewed Red Lion and Merchant report entries and bitmap masters:

    blender --background --factory-startup --python tools/art/render_greyhaven_a26_billboards.py -- --scene /path/blood_iron_greyhaven_a22.blend --out-dir /path/existing-a26-review --only blacksmith --samples 4

    python tools/art/encode_greyhaven_a26_webp.py --in-dir /path/existing-a26-review

These commands regenerate Blacksmith's three RGBA PNG source masters and two cropped lossless WebPs; they do not update game-world or physics files. The A2.7 standalone `greyhaven-a27-art-preview.html` automatically uses the refreshed committed WebPs after `git pull` and browser reload.

## Acceptance boundaries

Review the actual Blacksmith browser screenshot with the entrance clear and forge visibly beside the anvil. Verify exact-pixel alpha/WebP roundtrip, compare current and old screenshot, and keep the corrected changes restricted to the art PR. No change to A3 roll, knights, game portals, combat, or network authority. The 3/4 billboard still has the known flat-XY projection mismatch, so it must **not** be deployed directly as world art. Keep PR #350 draft and unmerged until exact-head CI and separate owner release authorization.
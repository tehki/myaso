# Moon Games Graphics 3C — P0 exact-source World #493 + Graphics 3B #500 sword-art seam

**Date:** 2026-10-21 | **First Playable P0 issues:** [#480](https://github.com/tehki/myaso/issues/480) / [#488](https://github.com/tehki/myaso/issues/488) | **Classification:** TESTED source-level compatibility; still **BLOCKED** for live integration and PLAYABLE acceptance.

## Dependencies, exactly pinned

- World open-front Blacksmith fixtures: draft [#493](https://github.com/tehki/myaso/pull/493), exact `07060f981b8a1dac89184b621b6893dd970a08ae`, stacked on World foundation #336. Four **fixture socket IDs** and anchors, no sword item IDs, no server-authoritative item state.
- Blender-generated separate sword/rack source images and pure presentation planner: Graphics 3B draft [#500](https://github.com/tehki/myaso/pull/500), exact `82b9755891e620b28d53b03cb6b1bfb4c532c1e0`, independently based on `main`, not merged to the World parent.
- Graphics 3C cached deterministic stone/ground and Blacksmith static light: current draft [#419](https://github.com/tehki/myaso/pull/419), based on unmerged World parent #336.

Neither upstream PR is imported as source into the Graphics 3C branch. Our verifier imports the **actual pinned** modules from independent detached Git checkouts and rejects SHA/map drift. It reads the actual WebP bytes, checks declared SHA-256, checks real `projectArenaPoint` at online zoom 0.84, and keeps the runtime online client/Combat/World/Items/Physics unchanged.

### Exact geometry and source transparency

At sample camera (3800,4050), online backing canvas 1100×688, world socket anchors (3740,4038), (3780,4038), (3820,4038), (3860,4038) project x=499.6,533.2,566.8,600.4, common y333.92. Four fixture centers are 33.6 screen pixels apart; each proposed sword uses the original 3B WebP, 42×115 native-pixel image rectangle. Adjacent **rectangles overlap by 8.4 pixels** — this alone is NOT an alpha-click collision.

Verified actual real Blender-sourced lossless sword WebP SHA-256: `795874620d07652e55f5e8a76952d2075f17196fc892eff88d46b165638a3b31`; rack SHA-256: `83d0d228785f80e95efd18fa6ef46a77d4ce8500a3fd5cf777d0f1f5ee3917b8`. Exact original sword image 42×115 RGBA; at Graphics 3B's alpha threshold 64, 1,007 source pixels remain opaque, with bounding box x7..34, y11..108 (exclusive bbox `[7,11,35,109]`). Source alpha overlap measured at **both floor and ceiling 33.6px projected shifts (33 and 34 source pixels)**: **zero opaque/opaque overlapping pixels for all three adjacent pairs**. This proves **art pixel separation at these exact art/camera dimensions**, NOT current-client hit-test accuracy or z-order after actual compositing, resampling, CSS scaling and camera motion.

Existing Graphics 3C static Blacksmith lamp center is over 36 world units from every proposed sword-anchor center, and socket 2 has one nearby background grass and one soil sample center within 16 world units. These static marks are not pointer surfaces; 3B and UI must visually inspect against a **real** item-present game frame before final acceptance. Do not add permanent swords into the cached background painter.

### Important blocking interface discovered

The World #493 `WORLD_ALPHA_ARMORY` object specifies fixture IDs, world anchors, layout and map, but does **not yet expose a canonical rack rendering origin**. Graphics 3B `createBlacksmithRackVisualPlan` requires `rack.origin`, a rack version and authoritative `zoneId` along with four sockets. World and the integration orchestrator must approve the art placement origin; Core 8C must supply the **trusted zone/version/fence** tied to the authoritative item snapshot. **Do not claim that World fixture socket IDs are world item IDs, or manufacture a 3C-owned zone/revision.**

The zero-item check is deliberate: a World socket adapter supplies only presentation-side `{id,worldX,worldY}` from World `{socketId,x,y}`, and a deliberately **QA-only** arithmetic midpoint origin plus non-server sentinel version/zone exercises Graphics 3B's strict parser **with an empty committed item array**. The planner returns a wood rack only and **zero** sword sprites; source alpha hit-testing that empty plan returns null. The same planner fails closed without its required origin/zone/revision. The QA-only origin is never written into World state or game runtime, and it is **not a rack layout proposal**.

### Reproduction and gate

```bash
WORLD_ALPHA_EXPECTED_HEAD=07060f981b8a1dac89184b621b6893dd970a08ae \
GRAPHICS_3B_EXPECTED_HEAD=82b9755891e620b28d53b03cb6b1bfb4c532c1e0 \
GRAPHICS_3C_EXPECTED_HEAD=<current-3C-sha> \
node tools/art/verify_p0_armory_actual_art_seam.mjs /path/to/pinned-world493-worktree /path/to/pinned-graphics3b500-worktree

python tools/art/measure_world493_3b500_sword_alpha.py \
  /path/to/pinned-graphics3b500-worktree \
  assets/environment/greyhaven/3c-p31-source-art-review/world493_3b500_3c_art_seam.json \
  assets/environment/greyhaven/3c-p31-source-art-review/world493_3b500_alpha_pixels.json
```

Requires Python Pillow only for optional WebP alpha decoding; the production quality workflow adds **only JavaScript syntax check** and never fetches draft branch repos in CI. Raw exact-source SHA/projection and transparency evidence is in `assets/environment/greyhaven/3c-p31-source-art-review/`.

**Outstanding First Playable acceptance:** actual approved rack origin and live committed Core item presence; Chrome/Firefox four independently operated humans seeing four original sword WebPs; native pointer alpha hit for each visual sword under moving camera/zoom; zero attack for valid pickup, preserved attack for empty space; authoritative single-winner item removal, equip/drop/death/reconnect state on all clients and real fist/sword PvP. Neither Graphics 3C nor this offline source evidence implements or proves any of these.

Keep draft PR #419; preserve `world=0` visual rollback and strict CI. Do not independently merge, stage, deploy or claim INTEGRATION-READY / PLAYABLE until the Main Orchestrator coordinates the real end-to-end acceptance.

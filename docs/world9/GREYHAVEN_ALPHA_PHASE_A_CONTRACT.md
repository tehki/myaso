# World 9 — Greyhaven Alpha Phase A: original World source and Rust authority contract

**Parent exactly** `88c4733c90199ab3cabf7bc85ebb58d2f8760c58`
(Main0 issue #1141; unmerged canonical Pre-Alpha draft #1138).
**Scope:** isolated source-only P0 World9 Alpha. **NOT** a production deployment
or a change to the existing Pre-Alpha arena. No change to native QUIC protocol,
Combat, Chat C1, input or Silver Knight game logic.

## Original authored World9 source

Five original UTF-8 source modules were copied byte-for-byte from Graphics 3 /
World9 #1106 at `22940ce8e377b07b70c1a73ee39d99173efb8c80`,
whose provenance is earlier approved World9+3C draft #648:

- `src/world/authored-maps.mjs`: fixed overworld `moonvale-overworld`
  8192×8192, city Greyhaven at (3520,3460), size1240×1290, 15
  original named building footprints, roads, market lane, trees, bridge
  and **visual metadata only** for the Red Lion tavern.
- `src/world/building-presentation.mjs`: the named visual replacement
  allowlist remains exactly **red-lion**. Blacksmith is NOT eligible for a
  visual replacement yet. The original Red Lion building footprint
  (4240,3880) 250×170 and depth y4075 are not changed.
- `src/browser/authored-world-renderer.mjs`: original 512-world-unit
  cache tiles, capacity24, build budget3, +X right and +Y down; existing
  960×540 Canvas projection at `ARENA_VIEW_ZOOM=0.84`.
- `src/browser/greyhaven-terrain-materials.mjs`: existing fixed cobbles,
  packed soil, grass and edge treatments, not random geography.
- `src/browser/greyhaven-atmosphere.mjs`: existing World9+3C fixed
  light fixtures and ground lighting, review only.
- `src/world/alpha-solid-geometry.mjs`: separately transplanted **unchanged**
  World9 P0 #579, `5cf352806b1a86934b699c3af41f5363a2ca0cb5`,
  pin `moonvale-greyhaven-v10-solids-v1`: 15 authored buildings + 8
  city wall rectangles. This JavaScript manifest is *not* live Rust authority.

**Art boundary:** Graphics3B's genuine Blender Red Lion source is present
only in existing draft #1111 `e48fe0bfd83ee07c18f23daf12d4da2ca5a0a0c3`.
Do not silently substitute an illustration or replace the original
Blacksmith. Graphics 3 owns the approved A2.32 day/dusk facade/roof, 3A
Silver Knight readability and 3C atmosphere blending. This World PR
renders World's **original placeholders** until separately approved
source-hashed art and depth masks are integrated.

## World layout, spawn, navigation

| Landmark | Original authored world coordinates | Authority |
| --- | --- | --- |
| City | (3520,3460) size1240×1290 | Authoring |
| Four staging spawns | (4110,4160), (4206,4160), (4110,4256), (4206,4256) | **Rust only, explicit loopback mode** |
| Blacksmith | (3710,3850) size182×162 | Static review, not active solid |
| Blacksmith safe approach | (3820,4088) | Static-safe exterior sidewalk |
| Red Lion | (4240,3880) size250×170 | Static review / visual placeholder |
| Red Lion nominal door | (4365,4060), visual portal center y4075 | **No transfer authorized** |
| Red Lion radius18 walkable approach | (4365,4080) | Static-safe street approach; not portal grant |
| Market Hall west | (4230,4380) | Static-safe street exterior |
| Chapel south | (4590,3850) | Static-safe street exterior |

The original door point (4365,4060) is only ten units south of the
Red Lion's collidable footprint edge y4050 and therefore **not** an
actor-radius18 stand against the original static rectangles. The
separate (4365,4080) pedestrian approach remains 30 units south.
Do not conflate visual door anchor, portal metadata or navigation
approach with a validated server interaction/zone transfer.

`src/world/greyhaven-alpha-foundation.mjs` pins a visible
King's Road -> Blacksmith exterior -> Red Lion exterior -> Market Hall
-> Chapel promenade. A real source-regression uses swept radius18
against **all 23** original static AABBs, and checks four original spawn
separation. This proves **proposed static path layout only**, not
currently enforceable collision.

## Exact opt-in / client and server separation

Only a **separate, loopback-bound** Rust test server with
`MYASO_WORLD9_GREYHAVEN_ALPHA=1`, original `MYASO_MAX_PLAYERS=2..4`
and **no flight background actors** reserves actual original World
`Fighter::spawn_x/y` on one of the four named Greyhaven staging anchors.
The original server `World::add_player_at` determines true actor
position and publishes its usual snapshot; later reconnect netId takes
the first currently unreserved authored spawn. There is **no client
coordinate command, artificial teleport, new packet or actor ID**.
Invalid values or non-loopback bind are rejected at startup.

Separately, a browser must be opened on loopback with a loopback
`?server=https://127.0.0.1:PORT/game` and both
`&world=1&greyhaven=1`; `scenario` must be absent. Only then it
lazily loads World9's read-only cached renderer and paints the
actual original replicated Rust actors on the **same existing camera**.
The original arena path, default server spawns, Combat/Chat and
legacy acceptance scenarios remain untouched. Missing modules or tile
render failures disable the optional painter without authorizing
anything. A loopback read-only snapshot inspection hook supplies
actual replicated actors, server ticks, camera and frame render state
to the native browser acceptance script; it does not send inputs.

**Do not expose this mode on production or public staging.**
There is no server-signed active map-id/epoch handshake in the current
QUIC protocol; browser & server opt-ins are deliberately separate.
The mode is a **source trial**, not robust public zone selection.

## Required Core 8C + Physics 6 authority signoff

The existing Rust `World` still bounds 8192×8192 and handles genuine
actor movement, HP, stamina, combat, death/respawn and QUIC snapshots.
**It does not enforce the copied 23 Greyhaven static AABBs** merely
because World9 renders them. Core8C must bind authoritative map ID,
revision, zone/actor epoch and spawn selection to server admission.
Physics6 must approve same-tick **complete** static+dynamic collision,
river, doors and occupied fighter separation, plus swept movement,
reject unknown/incomplete snapshots, and preserve all original arena
and Combat physics. No JSON manifest from the browser may claim
`complete=true` or mutate server state. No item/corpse/portal
transaction, owned sword or NPC proof exists in this slice.

Graphics3B/3C must confirm real source facade footprint, visual y4075
Red Lion actor occlusion, source SHA, day/dusk and Silver Knight HUD
readability in Chrome/Firefox. The Blacksmith remains visual-only
pending its owner approved footprint and source masks.

## First Playable release/QA gates

1. Both Rust and browser explicit loopback opt-ins on the **same source SHA**;
   two real Chrome/Firefox WebTransport actors at separate staging anchors;
   actual native W3C movement and original server tick/peer snapshots.
2. Original 960×540 Canvas, terrain cache drawing, distinct screenshots
   with SHA256, actual camera projection; original UI Chat C1 continuity.
3. Independent Graphics 3 artifact/occlusion review; safe day/dusk
   Blender source proofs; no visual changes to default arena.
4. Original exact-head protected quality, Rust, Node, Combat, Chat C1,
   Core8A/8C and QUIC checks. Preserve first-RED failures.
5. Core8C/Physics6 **authoritative** static/dynamic world collision and
   map/zone lease signoff before declaring full gameplay explorable.
6. Main0 alone integrates, merges, deploys or activates; **release HOLD**.

Two browser seats on one machine are NOT independent-host WAN acceptance.
Measurements, native pictures and real browser versions must be reported
from actual runs only, never inferred from a source test or JS illustration.

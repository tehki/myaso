# World & Gameplay D10 — Passive Trail Position and Off-Corridor Feedback

**Status:** isolated draft World & Gameplay preview addition stacked on D9; no production authority, inventory, XP, property, wallet, currency, combat or server movement changes.

## Player experience

D9 provided seven collision-certified milestone-to-milestone trail polylines. D10 adds an informative, passive gauge beneath D8's expedition compass so a player can understand whether their *actual offline preview position* is near the currently selected D9 corridor:

- **Near surveyed trail** (within 96 world units of the nearest point on the selected static corridor): shows the approximate remaining distance **along that corridor** to the next milestone.
- **Off trail** (more than 96 world units): shows geometric distance to the nearest corridor position and a reminder to return through *walkable roads*. The progress bar still reflects where the nearest corridor point lies relative to the previous/next authored milestones, **not a reward, guaranteed route to the corridor, or completion of the stage**.
- No selected/completed expedition, its first stage not yet visited, blocked/off-map player, wrong map or tavern interior: hide the bar and show no active surveyed trail.
- The existing line-of-bearing compass remains straight-line and is never mislabeled as a collision-safe route from the player. The D9 amber path remains between previously completed and next milestone, not the player.

The projected nearest point may be across a wall, river, NPC blockade, closed door, or future player structure. D10 **does not suggest a safe direct route back**. It will not steer characters, teleport them, auto-complete a stage, or authorize any server action.

## Scope and performance

`src/world/local-trail-progress.mjs` implements `localTrailPosition(state,mapId,x,y)`, a deterministic, pure point-to-segment projection onto only the currently active D9 trail polyline. It checks D2 preview walkability and finite inputs, then chooses the earliest segment for geometric tie cases. It returns frozen descriptive data: total path length, cumulative along-trail distance at projected position, remaining length, nearest-point offset, whether within 96 world units, next waypoint index/bearing, and a caution. No state mutations or reward fields.

The number of runtime segments is bounded by the D9 generated corpus (currently at most four for the northern journey). There is no A*, heap, new canvas, asset load, 8192×8192 cell grid, map scan, global actor lookup or path generator in the frame hot path. `web/world-preview.html` shares the D8 compass's 250-ms refresh throttle, updates only fixed text and a native `progress` element, and never contacts the server.

`tests/world-trail-progress.test.mjs` covers projection at endpoints and intermediate points, actual curved-route distance versus straight line, off-trail status, input rejection, tamper-resistant presentation/no quest award, independent session state, preview-only source wiring, HTML syntax and unchanged multiplayer code. `.github/workflows/ci.yml` includes an additive D10 gate; all earlier strict Combat, Rust, networking and browser checks remain intact.

## Manual acceptance

Serve repo root and visit `/web/world-preview.html` in isolated Chrome. Select **The Fallen Watch**: the Red Lion stage triggers near spawn; compass points NW and "Near surveyed trail" appears, including its along-corridor distance. Walk away toward southern Greyhaven; status changes to "Off trail by N units". Approaching the corridor again restores near-trail guidance. Pressing **M** still toggles the D9 amber sketch. Select another expedition to switch the displayed corridor; reload clears local route and progress bar. This is browser presentation acceptance only, **not multiplayer acceptance**.

## Integration gate

The central Development Center controls PR approval, merges and release. The full stacked parent chain #336 → #359 → #366 → #371 → #380 → #384 → #389 → #394 → #398 → #400 remains draft/unmerged. Inherited Combat acceptance blockers include M151, M144, M194, and M171; most recently D9 #400 exact-head quality [run #39504219834](https://github.com/tehki/myaso/actions/runs/39504219834) failed strict M194. Preserve and repair these gates in the owning Combat stream; do not bypass. Server-owned map, player movement and safe navigation require separate Core & Multiplayer architectural approval, collision against dynamic world state, replay/reconnect and multi-client proof.

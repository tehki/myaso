# World 9 — Greyhaven authored-to-Rust coordinates

**DRAFT / SOURCE ONLY / RELEASE HOLD.** World9 review for Main0 issue
#1141, stacked on Core8C integrated draft #1150 (donors World9 #1148,
Physics6 #1147, Core8C #1149). This contract cannot authorize a
portal, transfer, item transaction, new public route or deployment.

## One coordinate convention

All positions use original Rust World X/Y on moonvale-overworld:
+X right, +Y down, 8192 × 8192. The original server controls fighter
positions with radius18 and original Rust World admission. World9
960 × 540 Canvas, authored landscape and graphic assets only project
replicated server positions; no browser map chooses a server map.

| Feature | Original World X/Y | Authority / meaning |
| --- | --- | --- |
| Greyhaven | (3520,3460), 1240×1290 | City envelope and eight pinned city-wall spans |
| Spawn 1 | (4110,4160) | Core8C Rust SPAWNS[0]; authored map.spawn |
| Spawn 2 | (4206,4160) | Core8C SPAWNS[1] |
| Spawn 3 | (4110,4256) | Core8C SPAWNS[2] |
| Spawn 4 | (4206,4256) | Core8C SPAWNS[3] |
| Blacksmith | (3710,3850)–(3892,4012) | Physics6 server static footprint |
| Blacksmith approach | (3820,4088) | Static-safe exterior; no door/interior exists yet |
| Red Lion | (4240,3880)–(4490,4050) | Physics6 server static footprint |
| Red Lion visual door | (4365,4060) | Visual ONLY, invalid radius18 standing/teleport point |
| Red Lion walkable stand | (4365,4080) | Radius18 safe approach, 30 units below wall edge |
| Red Lion wall contact | y=4068 | Touching the inflated 18-unit wall boundary is BLOCKED |
| Red Lion preview marker | (4365,4075), radius52 | Offline metadata only, no Rust zone transfer |
| Market Hall west | (4230,4380) | Exterior approach |
| Chapel south | (4590,3850) | Exterior approach |
| West/east gate | y=4112..4248 | Original static-safe opening at y4180 |
| North/south gate | x=4057..4203 | Original static-safe opening at x4130 |

Core8C source server/src/greyhaven_alpha.rs supplies the actual Rust
spawn tuples. Physics6 source server/src/alpha_greyhaven_solids_generated.rs
supplies 15 static building AABBs and eight wall AABBs from
assets/world/greyhaven-alpha-solids-v1.json. The 23-shape layout hash is
9bb023c95d86821f219113d71b6e480789a72df064f083790e746d79423b3f43.
That digest identifies reviewed source geometry, not a signed active
server map revision or worker epoch.

## Entrance and portal boundary

The authored Red Lion visual doorway is 10 units from the south solid
edge, so a radius18 actor may NOT be spawned or moved to the visual door
coordinate. The safe outdoor approach (4365,4080) is distinct from the
visual door (4365,4060) and the preview-only portal center (4365,4075).
The offline red-lion-enter / red-lion-exit pair must NOT authorize live
transitions. The Blacksmith has no declared doorway, portal or interior.
The city wall gates are open corridors, not zone transitions.

A trusted server process may opt into the current isolated Alpha
World and Physics6 collision only using the original operator-owned
MYASO_WORLD9_GREYHAVEN_ALPHA=1, loopback bind, player cap 2..4 and
no synthetic flight actors. The original default arena remains OFF.
The client world=1&greyhaven=1 parameters affect only painting the
server-replicated world. Original Rust World::add_player_at and Core8C
free_spawn are the only admission path; browser metadata never mints
or repositions an actor.

## Verification and remaining HOLD

The new World9 coordinate-parity Node suite reads the actual authored
map, four Rust SPAWNS literals, Physics6 generated Rust AABBs and
reviewed JSON. It compares all 15 buildings, 8 wall segments and their
fingerprint, four spawn clearances, original city gate crossings,
entrance distinction, exterior landmark safety and avoidance of live
offline portal invocations. The existing World9 native workflow now
runs this check on exact pull-request HEAD.

This is **NOT complete navigability or a server map handshake**. River,
bridge collision, dynamic doors and actors, true terrain Z/grounding,
signed map/worker/zone epoch, future interior transactions, and genuine
two-host/four-player gameplay remain separate Core8C / Physics6 /
Main0 signoffs. Graphics3B must verify Quaternius Red Lion visual
geometry and depth against the unchanged footprint. No new portals,
world transitions, edits to the default arena, public activation,
merge or deployment are authorized.

### Native browser first-RED correction

On combined Core8C parent #1150 at exact HEAD 7af45b1b, the genuine
Chrome/Firefox wall harness observed player1 x=4426 on the south
frontage but timed out because its former arbitrary fixed X window
was 4330..4410. Position 4426 remains well within the real Red Lion
building face x4240..4490, with more than 18 units of side clearance.
World9 now derives the safe face interval from the canonical authored
footprint rather than imposing one precise click/timing sample.
The two real W3C northward steps keep a first short sidewalk move
followed by a deeper wall attempt so the second step must actually
reach the Physics6 wall. Existing final swept-wall-stop and both-peer
replication assertions remain unchanged. This alters test timing and
source-derived target bounds only; it cannot alter actors or movement.

# Core 8A P0 — four real Blacksmith players, one authoritative snapshot tick, zero overlapping bodies

**DRAFT / deliberately fail-closed acceptance; NOT a gameplay fix.**
The original [Core 8A #646](https://github.com/tehki/myaso/pull/646),
[#660](https://github.com/tehki/myaso/pull/660) and genuine
SIGKILL/rejoin [#668](https://github.com/tehki/myaso/pull/668)
prove individual arrival inside reviewed static y4068 waypoints, own
prototype 56 world-unit sword reach and four browser agreement. **Those
claims never demonstrated player-player dynamic clearance**. World
[#676](https://github.com/tehki/myaso/pull/676) independently found
a physical-radius18 counterexample: two actor centers 40 units apart
have only four units of clearance, but the independent +/-18 waypoint
arrival tolerance allows both actors to move within **8 units** of
each other, while both individually satisfy the earlier tests.

A further source-real concern: the four individually logged Core8A
arrival endpoints were taken at **different server ticks**. Comparing
their pairwise distances after the fact is NOT proof the server
simultaneously overlapped actors. Only one server-authored snapshot
frame can establish same-tick positions.

## New opt-in, genuine Rust/WebTransport proof

`MYASO_ALPHA_NATIVE_RACK_SAME_TICK_CLEARANCE=1` requires the existing
explicit Greyhaven, genuine native W3C rack-walk and proposed-reach
flags. After all four Chrome/Firefox actors independently approach
the actual four empty authored rack socket locations, and after the
already-strict 8-unit four-peer consensus check, the runner reads
four actual browser server-snapshot frames. The frame with the
highest monotonic serverTick contains **all four fighter positions
from ONE authoritative Rust tick**, so it never compares positions
from the independent arrival-time observations. Exact four ID
and scoreboard validity, true per-socket 18-waypoint and 56
prototype range, finite coordinates, no ghosts, and <=8 cross-browser
observer drift are mandatory. Compare all six actor pairs on that
single frame; require center separation **at least 36 world units**
(two radius18 bodies). A distinct `...SAME_TICK_CLEARANCE_PASS`
marker is printed only if ALL pairs pass. A genuinely observed
overlap logs `...SAME_TICK_CLEARANCE_OBSERVATION` and ultimately
`...SAME_TICK_CLEARANCE_FAIL` with actor pair distances and
server tick; tests fail red rather than treating existing proximity
milestones as physical validity.

In the joint original Firefox SIGKILL/rejoin mode, the checker
records **both** the initial roster 1,2,3,4 and the replacement
roster 1,3,4,5, where new Firefox player5 returns to original
rack2. A collision in either phase fails after both real
observations are taken; parent navigation/rejoin PASS markers remain
narrow and unchanged.

This is still **a loopback-native test**, not four independent
client devices, a signed 8C worker/zone epoch, a live dynamic
collision authority, or actual player body contacts. Source
assumes the reviewed radius18 until Physics 6 and Core 8C approve
authoritative actor overlap behavior. Never move fighters,
teleport, shrink collision radius, enlarge socket spacing,
relax any existing Combat checks, create a sword or fake an item
ACK in order to obtain a green result.

Core8C/Physics/World own any runtime collision correction if this
new genuinely sampled gate fails. Core8A owns the read-only real
browser evidence and network agreement. Existing server and
World authored geometry, Physics, Combat, Items, graphics/UI,
production bindings, migrations and `main` are unchanged.
First Playable remains HOLD pending actual visible swords,
canonical owner/epoch, authenticated pixel-click TryPickup,
single-writer atomic equipment receipts and true multi-host proof.

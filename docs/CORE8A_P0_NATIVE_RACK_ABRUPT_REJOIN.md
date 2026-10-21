# Core 8A P0 — four genuine browser rack approach + abrupt crash / fresh rack return

**DRAFT / TEST-ONLY / loopback isolated.** Strict child of Core 8A #660,
not standalone current `main`. This deliberately exercises TWO already
independently proven Core 8A paths **in one native browser/server lifetime**:
four separate Chrome/Firefox W3C players walk to the four exact World-authored
empty sword sockets and converge on the proposed World #639 nearby waypoints,
then actual Firefox #2 crashes via process-group `SIGKILL` (no graceful
`WebTransport.close()`/W3C DELETE). The surviving three independent browser
sessions must receive authoritative player2 ghost removal. A NEW true Firefox
browser connects via pinned QUIC, receives newly issued server ID **#5**,
and actual W3C A/W presses move it from the server-authorized freed
Greyhaven spawn toward its **correct original #2 socket** without server
teleport or synthetic state. All four remaining Chrome/Firefox session
screens and snapshots must independently show IDs exactly **1,3,4,5**,
no #2 in fighters or scoreboard, strictly later server ticks, all four
physical fighters again within the reviewed **prototype** 18 and 56
bounds around their individually assigned original, still-empty sword
sockets, and at most **8** world units pairwise observer drift.

Default runner behavior is untouched. Enable only in the dedicated
CI by setting all four flags to `1`:
- `MYASO_ALPHA_NATIVE_GREYHAVEN`
- `MYASO_ALPHA_NATIVE_RACK_WALK`
- `MYASO_ALPHA_NATIVE_RACK_REACH`
- `MYASO_ALPHA_NATIVE_RACK_CRASH_REJOIN`

The distinct `ALPHA_P0_FOUR_NATIVE_RACK_SIGKILL_REJOIN_PASS` marker
requires genuine first four-rack approach, genuine abrupt Firefox
process death, removal observed by three peers, server new player ID,
actual W3C replacement movement to the same slot and complete post-crash
four-peer convergence. The original M1 `ALPHA_M1_FOUR_BROWSER_CRASH_REJOIN_PASS`
reports transport recovery and fresh actor movement before the extra walk.

**What it does NOT demonstrate:** real sword item existence or a picked-up
physical object, durable character account recovery, resumed player2
identity, persistence/inventory ownership after death, authoritative
item pickup/reach/LOS/zone or a signed canonical `u128` ground ItemId,
input/ACK durability, armed-vs-fist Combat, visible rendered Greyhaven,
different client machines, public network routing or production safety.
Player5 is a fresh actor, not recovered player2. All four real browsers
and the Rust server run on a SINGLE CI host; authored rack socket
positions are fixtures, not authoritative items. This test is NOT
release authorization. Never turn the temporary acceptance-only 56 or
8-world-unit thresholds into production gameplay policies.

`node --test tests/alpha_p0_rack_walk_math.test.mjs` exercises **synthetic
negative fixtures**; `.github/workflows/core8a-p0-native-rack-crash-rejoin.yml`
runs the actual genuine Chrome+Firefox+WebTransport test. Original
protected quality, Combo Core and Combat tests remain mandatory, unchanged.
The Main Orchestrator alone approves any merge or independently authorized
isolated host flight. No network/firewall change, persistent data edit or
production deploy is allowed by this PR.

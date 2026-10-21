# Core 8A P0 — four real native browser actors reach original Blacksmith sword approaches

**DRAFT / explicit staging-only / no gameplay contract activation.** Child of Core 8A/World review [#599](https://github.com/tehki/myaso/pull/599) exact `e09aea867348d2dcaac01bd0317782ccc57a73b7`. No production, main, port exposure, writer activation or Combat logic changed.

## What's newly tested

Older #599 proved four real Chrome/Firefox clients shared the Greyhaven authority and authored city pixels, and World source statically proved paths from 4 server spawns to four original Blacksmith rack approach points. These are useful *separate* tests, but they do not prove **real native browser input moves an authenticated fighter all the way to each of the physical approach positions**.

This opt-in `MYASO_ALPHA_NATIVE_RACK_WALK=1` harness extends the *same existing* four genuine native W3C Chrome1/Firefox2/Chrome3/Firefox4 WebTransport flight in the reviewed Rust server Greyhaven (cap4 + 23 static solids, bound loopback). It reads each exact target directly from `WORLD_ALPHA_SWORD_RACK_SOCKETS` rather than rebuilding coordinates or item identities:

- Chrome player #1 → `greyhaven-rack-1` approach (3740,4088).
- Firefox player #2 → `greyhaven-rack-2` approach (3780,4088).
- Chrome player #3 → `greyhaven-rack-3` approach (3820,4088).
- Firefox player #4 → `greyhaven-rack-4` approach (3860,4088).

The native helper focuses original in-game `#arena`, waits real attack recovery, walks **west first along the clear southern courtyard before approaching north**, uses bounded actual native W3C W/A/S/D keyDown/keyUp pulses with a short post-release server input fence, re-reads the next original server-owned fighter positions and ticks, and fails if the actor stops making progress or does not arrive within 18 original world units. After four arrivals every genuine browser independently must observe **all four actual server positions near the four unique World fixtures** while the live four-person scoreboard remains present. It records the complete input/position/tick trace and screenshot evidence. No client-injected fighter coordinates or synthetic WebTransport actors.

**Default OFF:** existing #599 four-browser crash/rejoin test has identical behavior with flag unset. The new flag requires explicit Greyhaven staging profile and refuses invalid values. Separate dedicated Actions gate always runs the true native test and original World/core geometry parity. Exact-head CI must finish before success claim.

## Intentionally unproven

The `scenario=uijumpffaprimary` acceptance layer exposes **read-only actual server fighter positions** but disables original painted 2D world; rendering remains separately qualified by #589/#599. The rack itself can be shown as **empty** by Graphics 3B #603, but there is no authenticated live four-sword packet, clicked GroundEntityId or ItemId, durable exclusive writer receipt, main-hand equip, weapon-vs-fists combat, death/rejoin gear proof, and no independent two-host/client-network test. Arriving near a fixture **does not mean a sword exists there** and grants no item. Do not infer a picked-up weapon or game release. This does not modify Combat/Physics/Items gameplay or waive red full quality.

Only Main Orchestrator chooses source ancestry/merge/deploy, all branches DRAFT.

## Native-repeat finding and corrective test routing (2026-10-21)

Exact original route source `511b7207b2f8389230f7ca1ca27e2bf4cd9ef2fb` dedicated native [first CI attempt](https://github.com/tehki/myaso/actions/runs/39637941740/attempts/1) **PASS**: all four true Chrome/Firefox reached four original World rack approach points, all four peers independently saw all four positioned server fighters. **Identical-source attempt2 FAILED correctly**: Chrome #3 arrived at x3914 while travelling west after first walking north, then made zero x progress over three genuine W3C A-key attempts. The original Smith AABB is x3710–3892/y3850–4012; conservative 18-unit-radius collision at x3914 while y is too far north is geometrically consistent with the wall. This is a **routing test weakness, not evidence that server collision should be disabled**. Sample-to-sample genuine delayed W3C keyUp / position drift was also seen in real traces. A causal proof for exactly which y tick collided is not yet present (previous trace lacked whole point on each pulse).

**Correction (test harness only):** first move west along the true southern courtyard at original spawn y4160 or 4256, then north to the exact World station y4088; wait 220 ms after genuine W3C keyUp before a subsequent axis and record full authoritative x/y in every pulse trace. Added independently reviewed exact segment-versus-**all 23 pinned World AABBs inflated by authoritative fighter radius 18** unit test for both legs of all 4 routes, plus a negative witness of Smith intersection for a risky north-first y4020 path. New exact source **5/5 pure Node tests and source syntax PASS** on X230i. The *new* real native four-browser flight and full protected quality require fresh **exact-head** green before repeatability may be claimed; inherited Combat strict failures remain unwaived. No prod/UI/Rust collision/writer/gameplay code changed.

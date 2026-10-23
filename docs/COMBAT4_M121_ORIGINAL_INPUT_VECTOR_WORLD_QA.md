# Original M121 W3C directional light: 30Hz vector versus real 60Hz World

DRAFT, NONRELEASE. Child of original selected Core8 authority + QUIC
replacement review branch #945. No original Combat, HP, timing or
protected M121 test expectation is changed.

## Actual strict source evidence

#945 protected quality #40038136554 FAILED original M121.
The authentic Firefox victim lost exactly 34 HP (100 to 66), but
original threat was ordinary WINDUP / STRIKE / attack-recovery;
required LEFT WINDUP / LEFT SWEEP / directional-attack-recovery
was not observed. This is a directional VARIANT failure rather
than a missing health-damage packet or fabricated HIT.

## New read-only evidence (only original first-party loopback)

For actual web/online-game.mjs scenario=uidirectionallight and
loopback hostname ONLY, bounded diagnostics record true physical
LMB down and real held WASD direction, original onLight callback
resolved committed movement at light release, and EXACT original
30Hz clientTick/moveX/moveY, attack/heavyAttack bits and actual
key state immediately before the UNCHANGED networkClient.sendInput.
All original input handlers, attack classification, 34HP damage,
source0/source1 KeyE release-only authority, and network sender
are unchanged; the new state never controls combat or sends packets.

When the original protected left-sweep predicate is false, genuine
browser runner outputs these vectors beside the unchanged original
defender/World HP and phase evidence. The original runner also
enables existing loopback-only MYASO_FLIGHT_ACTION_PROOF for M121
to expose actual original 60Hz M201_AUTH_ACTION/HIT records.
ACKs, HUD effects and local predictions are never substituted
for real World HIT.

New dedicated nonrelease CI runs EXACT original native
MYASO_PVP_SCENARIO=uidirectionallight Chrome+Firefox scenario
two independent times on fresh real Rust game servers. BOTH must
pass real 34HP HP66 plus LEFT WINDUP, LEFT SWEEP and Sweep recovery.
The second runs even when the first is red for fail-first evidence.
Full protected quality remains mandatory separately.

The native World traces are needed before changing test choreography
or source directional input. This is one CI host, not 2-4 real
independently operated human hosts or authenticated production WAN.
No public v2, main merge, staging, restart, deployment, or GO.

## First exact-head focused CI bootstrap correction

First M121 #40039262042 native run1 was RED before WebDriver:
the GitHub runner lacked active pinned Rust 1.89.0 and
rustup auto-install exceeded the original game-server endpoint
wait while spawning cargo. This was an ENVIRONMENT/BOOTSTRAP
failure, not original directional Combat M121. Run2 on the same
now-warmed runner independently COMPLETED SUCCESS with genuine
Chrome physical KeyW/LMB and Firefox LEFT SWEEP 34HP, World
AUTH ACTION 0->9->24->25 and true AUTH HIT tick1338 hp66.
Original physical onLight committedMove moveY=-1.
The original full protected #945 M121 failure is still real.

An unskipped strict CI setup step now installs pinned 1.89.0
and compiles original --locked Rust server before EITHER genuine
Chrome/Firefox M121 run. Original per-run test scenario, timeouts,
two-run acceptance and HP/LEFT SWEEP assertions unchanged.
If bootstrap fails, workflow remains RED, and full protected
quality remains an independent mandatory gate.

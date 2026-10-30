# Combat: retain original RMB running strike on immediate LMB

Base: #1116, `874fdf178d6eb6b4806c7022b64b6dec45ccb730`.

## Reproduced defect and correction

With the selected Instant LMB profile, genuine RMB hold + WASD + short LMB
produced ordinary34HP Light instead of the original30HP running strike.
Native M119 failed on the real two-browser game. A World/session/codec test
independently reproduced immediate AttackWindup instead of RunningAttackWindup.
First reds: `combat-convergence-instant-running-first.log` and
`combat-convergence-instant-running-first-red.log`.

The original World now selects the running variant from its accepted run and
movement input, spends the existing10 stamina, and starts the original160ms
windup. The admitted World action supplies its windup duration to the existing
reducer; no client time or new packet field selects that deadline. Standard
Light remains135ms and Heavy READY remains320ms.

An unlanded running windup can still upgrade to held Heavy, including the
original150ms case. Early UP restores the captured running variant and elapsed
time without another10-point debit. A later neutral movement packet cannot
reclassify it as ordinary Light. CANCEL remains valid before actual running
contact, including after135ms. An exhausted running attempt is admitted
no-combat, consumes that gesture, and never falls back to a free Light; replay
cannot turn it into an attack after stamina recovers. A fresh gesture works.

Original running damage30, active90ms, recovery310ms, movement and costs are
unchanged. Existing Light34, Heavy46, JumpAttack42, Parry125, Block240 and
JumpAttack recovery450 remain unchanged. The typed16-byte event/ACK wire and
activation flags are unchanged.

## Validation and native proof

Five World/session/codec cases cover the original running strike, late unlanded
Heavy upgrade, early-UP restoration, cancellation and exhausted/replayed input.
Full Linux Rust449 and private-feature456 tests, formatting and strict Clippy
passed. The first full Node run had one literal source-contract assertion still
requiring the fixed135ms constant for every variant; it now requires the bound
original World deadline and retains the135ms standard-Light assertion.

The first corrected native M119 passed30HP. Final native validation additionally
runs both Chrome and Firefox as attacker, requiring the original World21→22→23
running lifecycle and exactly one original30HP victim hit. Existing native
pointer/key ordering, movement, readability and100/70HP assertions remain.
CI retains its three-player threat case and adds both running-attacker engines.

## Separate M144 CI scheduling defect

The previous candidate's Quality job failed M144 with a genuine measured201ms
lead against the unchanged60..200ms gate:
https://github.com/tehki/myaso/actions/runs/40961758734/job/123756055205 .
The flight continuously sent read-only execute commands to the same two drivers
that were issuing timed input, allowing those reads to queue ahead of the native
chord. Continuous polling now targets the actual independent focus observer.
The actors' own logs are still recorded in-page and all actors are read and
checked afterward. Original60..200ms and70..150ms lead gates, genuine180ms chord,
full authoritative phase proof, all100HP/guard checks, three-stage focus handoff
and spatial pixel assertions remain required. No gameplay timer is changed.

A subsequent genuine M145 run measured157ms against the unchanged150ms limit.
Its fixed80ms wait began after HTTP delivery of the trusted pointer receipt,
adding delivery latency to the actual input lead. The fixture now carries the
captured native event time in its existing one-use proof and waits only the
remaining70/80ms from that event. A scheduling test covers delayed delivery,
late receipt and malformed/stale/future onset rejection. This timestamp is
confined to test scheduling; gameplay admission still uses original World time.

After this correction, M145 spatial native acceptance passed. A further M144
first-red exposed a separate real delivery delay: genuine Space DOWN at epoch
1793352399516 reached the original sender at1793352399749 (233ms later), so the
actual server recovery windows did not overlap. The original World overlap
assertion remains required. This delivery issue is the next source task; the
running-strike milestone does not claim it resolved or the whole CI green.

Final pre-commit validation: Node1018/1018, Rust449/449, private456/456,
formatting and strict all-target Clippy pass. Both actual native attacker
engines pass the strengthened M119 original World30HP proof. Final Windows and
Linux Git blobs match for all12 changed runtime/test/workflow files.

```sh
cargo test --manifest-path server/Cargo.toml --test combat4_typed_running_strike
MYASO_PVP_INSTANT_LMB=1 MYASO_PVP_RUNNING_ATTACKER=chrome \
MYASO_PVP_SCENARIO=uirunningattack node scripts/pvp_browser_flight_runner.mjs
```

Repeat with `MYASO_PVP_RUNNING_ATTACKER=firefox`. Native same-host browser/QUIC
proof is separate from independent human-host/WAN qualification. Independent4D
assessment and Main0 deployment/config decisions are not implied by these tests.

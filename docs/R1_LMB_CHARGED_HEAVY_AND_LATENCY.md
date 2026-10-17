# R1: Tap-light and charged mouse-directed heavy

## Player contract

- **Short LMB** (press + release before 320 ms) = one light attack.
- **Hold LMB for 320 ms or more** = grow an amber charge ring, dedicated charge percentage/READY meter and visibly lean the fighter into the mouse-facing direction. **Release** = one server-authoritative heavy attack with the existing windup, active damage and recovery. Holding alone does not inflict damage or automatically trigger a hit.
- The body leans further during committed heavy windup and most aggressively during heavy active frames. This is **animation only**: original server damage, collision, attack range, cooldowns and stamina costs remain intact.
- **Short RMB** (<180 ms) remains one shove/kick; **hold RMB** (>=180 ms) remains run/sprint while physically held. Existing run stamina and running attack behavior are unchanged.
- Running+LMB, Space+LMB and Space pressed while holding LMB preserve their immediate special-action chords. E remains a legacy heavy shortcut, needed by existing real input-loss and feint tests.
- Mouse position defines facing on the next sampled input, including the release of a charged heavy; a heavy is *not* a target lock and can still miss or be blocked.

## Edge cases

The separate LMB recognizer ignores repeated pointerdown, unrelated pointer IDs, duplicate bubbled pointerup, lost pointer capture and blur. Cancelled holds **never fire** an attack. Short attacks are emitted **on release**, since it is impossible to know whether a press will become heavy at initial pointerdown without prematurely firing a light. This is an intentional, user-visible control timing change.

## Verification and release discipline

Seven deterministic R1 tests confirm threshold semantics, one-shot behavior, cancellation, immediate jump/sprint chords and original unchanged RMB+E contracts. Original browser runtime tests still run. Full Rust/Firefox/Chrome 512-capacity and strict timing acceptance must pass before any production update; dedicated real-browser tap/light and charged-heavy acceptance should prove one authoritative action per gesture. Keep prior release live, prepare a rollback, and do not deploy solely because JS unit tests are green.

## Movement latency investigation

Real public R0 test clients measured **137 ms RTT (Windows Machine)** and **152 ms RTT (X230i Linux)** to the current VPS, each with 0% packet loss over 8 ICMP probes. This is a measurement of these two clients, **not necessarily the player's personal RTT**. With 20 Hz remote snapshots (up to 50 ms between snapshots), 90 ms deliberate remote interpolation, and current client reconciliation behavior, substantial apparent delay is plausible even though the authoritative server had essentially idle CPU and 0 service restarts during launch. Do not blindly increase movement speed or decrease deterministic action timings to mask network path delay. Record in-browser input→ack RTT, jitter and actual camera correction magnitudes; then evaluate a smoother visual correction and, if network RTT remains high, a geographically closer game server in a separate safe PR.

Strict R1 test adaptation: original M117/M170 real Firefox/Chrome W3C feint gesture sent wheel-back while the 90ms LMB was still held. Under the corrected release-to-light contract this blocks *before* the light exists, so it cannot prove a feint. The adapted W3C sequence performs an 85ms real press/release and sends the real wheel-back 20ms later within the original 70ms feint window. This preserves original authority, visual observations and fail-closed results without altering the combat model.

M170 exhausted-feint proof now compares the real wheel-back timestamp to **pointerup** rather than pointerdown, requires wheel after release, and retains its original 80ms maximum gesture timing. Earlier M210 tests that encoded the old down-first attack were updated to validate the new 85ms press / 20ms post-release wheel W3C schedule; no hitpoints, recovery requirement, stamina cost or authority assertions were loosened.

### R1 integration: directional light release/input sampling
Short LMB now commits on pointer release; a genuine held strafe can be released in
the next W3C/browser action tick *before* the next 60 Hz input sample. That formerly
turned a left-sweep into an ordinary 34 HP light even though the player held strafe
at attack commitment. Capture only the real movement keys at light commitment,
carry them on the *single attack-bearing input* and clear after send/consumption.
Normal movement resumes from live keys on the following input. Mirror this in
offline practice. Preserve strict M121 real-browser assertions for directional
windup, recovery, and identical damage; do not alter server combat, packet
format, attack/feint windows or physics.

Rebased on R1 smooth rendering, network diagnostics and own-snapshot ACK alignment.
The separate charge-ring and opt-in network HUD are both retained. Full CI and
independent merged-main qualification remain required before VPS rollout.

### R1 M144 genuine release-order correction
The existing M144 three-client flight previously triggered a jump 25ms after
the trusted LMB pointerdown. After R1 moved short-light commitment to pointerup,
the genuine Space+LMB jump could enter recovery first and the light recovery
second. That inverted the strict expected #3 -> #1 -> nearest focus order,
despite unchanged 100HP and server-authentic inputs. The M144-only jump
choreography now waits 185ms after the trusted initial LMB down, while
validating a real 60..200ms **light pointerup -> jump pointerdown** delay.
The M145 spatial flight retains its separate 100ms trusted-down staging and
original measured 70..150ms **down -> down** gate. Strict three-stage
observer recovery, authoritative server lifecycle, true W3C gestures,
and full 100HP/100guard checks are unchanged. No production attack timing
or server mechanics are modified.

### M144 strict third-stage observation
Quality attempt 2 on head `625527b` confirmed the corrected ordered Firefox
focus sequence `PUNISH TARGET #3 -> PUNISH TARGET #1`, but the existing
760ms M144 observation ended before the second authoritative jump-recovery
window fully cleared, so `NEAREST #3` had not yet appeared. Keep the
original genuine three-stage strict gate, actual 100HP/guard, server action
proofs and real browser input evidence; extend **M144 observation only**
to a bounded 1250ms. M145 spatial observation stays 760ms and its
original 100ms trusted-input lead/70–150ms proof remains unchanged.
No production gameplay, timing or network change.

### M109 late confirmed light commitment
Quality run 39022536314 failed its strict real Chrome/Firefox M109 punish
when the genuine Chrome light pointerdown/up was seen and the remote Firefox
threat plus local `Attack committed` arrived only in the final evidence read,
after the 105ms commit poll. The old harness misclassified that positive,
non-clean evidence as an unexpected retry failure. R1 recognizes a
**late real commitment** from the SAME already-verified complete pointer
gesture and stops retrying immediately. It still requires the exact
one-hit 34HP punish, 100HP/guard defender, one genuine heavy whiff,
and bidirectional authoritative hit feedback. No extra input, synthetic
browser event, combat timing, network or production code changes.

### M33 / M146 genuine short-click parry choreography
Strict quality run 39025822336 attempt 2 reached 82 green steps and passed
M144 three-stage recovery and M145 spatial recovery. It failed M146 because
the inherited M33 parry fixture held Firefox LMB down while submitting Chrome
wheel-back and waiting a further 190ms, then sent pointerUP. Under browser
scheduler latency this becomes an R1 **charged heavy** (authoritative
Firefox heavy windup/recovery and 46-damage strikes), not the intended light.
The shared parry fixture now sends one complete 75ms authentic W3C left
tap, waits 55ms, then sends the one genuine wheel-back. Any real damage,
guard loss or committed heavy remains fatal; clean retries only. M146 still
requires the real 125ms parry, unchanged 650ms stun, a genuine delayed light
input at 340..470ms after stun, exact 34HP punish, and both authoritative
feedback events. Production combat, input routing, server and network
constants remain unchanged.

### M147/M150 FFA parry: complete genuine R1 short click
Exact-head CI 39026753719 passed strict M146 and M147 recovery tests, but
M150 failed before parry with Firefox #2 seeing a real wheel-back and
Chrome #1 still showing a lone pointerdown: inherited FFA fixture delayed
the corresponding pointerUP through a 190ms wheel hold, which conflicts
with R1's light-on-release semantics and can charge heavy under load.
M147/M150 now send one genuine 75ms W3C short click and only then a
genuine wheel-back after 55ms, with exact one-down/one-up real timestamp
proof (<320ms). The 650ms authoritative parry stun, target selection,
exact 34HP hit on parried #1, untouched #2/#3 vitals and original event
and focus restoration gates are unchanged. No production changes.

### M159 strict 60Hz simultaneous knockdown punish with R1 light-on-release
Exact-head quality run 39027292446 passed 90 steps including M146 and M150,
but both genuine four-browser M159 attempts failed strict M209 server truth:
first knockdown at ticks 393 / 405, second at 396 / 408, and punish active
at 411 / 423, later than the first victim's 16-tick knockdown expiry
(409 / 421). Legacy browser flight pressed #4 LMB near roll contact but
waited for second-victim remote observation AND expensive target re-aim
BEFORE pointerUP; R1 light commits only on release. This postpones the
135ms windup beyond the authentic shared 260ms knockdown. The flight now
sends the one genuine pointerDOWN, waits 40ms and sends matching genuine
pointerUP *before* waiting on #3 replication or re-aiming during the
already-committed windup. It additionally requires exactly one complete,
chronological short (<320ms) genuine LMB. Every original M209 60Hz server
action/hit transition, ordered dual knockdown, genuine wheel, exclusive
reaim, unchanged 34HP single target, zero guard/collateral damage, and
focus recovery assertion remains mandatory. This changes no gameplay,
server, replication, combat timing or balancing constants.

### M156 real-wheel ACK versus third-party short-LMB release
Exact-head quality 39030953365 passed 97 stages, including the repaired
strict M159 dual-knockdown and all earlier real-browser parry gates,
then failed M156: Firefox #2 genuine roll-knockdown at authoritative tick
318, Chrome2 #3 light windup at 327 and active at 336, after #2 recovery
at tick 333. Old harness awaited **both** Firefox's live knockdown and
Chrome #1's separate wheel W3C ACK before issuing Chrome2's two-command
down/40ms/up click. The post-knockdown WebDriver ACK plus multiple extra
round trips delayed real light-on-release beyond the unmodified 260ms
window. M156 now reacts to the already-observed Firefox knockdown
immediately, sends one real, complete 35ms short W3C LMB at the existing
aim in a single driver call and awaits the genuine wheel ACK afterwards,
still rejecting any wheel error. Real pointerdown/up timestamps, positive
sub-320ms release, exact 34HP/66HP victim, zero collateral and guard loss,
and strict authoritative attack-active BEFORE recovery are all mandatory.
No production gameplay/balancing/protocol changes or time-window widening.

### M235 M144 trusted input lead headroom
Exact-head quality run 39033144071 passed 80 steps then M144 failed its
*unchanged* 60..200ms genuine light-pointerUP to jump-pointerDOWN gate:
observed 212ms, with both actual gestures and original independent
server-authentic attack recovery lifecycles. This is **not** evidence for
changing any attack windows. The true W3C Chrome2 / Chrome dispatch and
event-loop skew added ~27ms to M144's former 185ms trusted-onset delay.
M144-only orchestration now uses 155ms after the existing M227 trusted
pointerdown receipt to recover 30ms scheduling headroom. The light remains
a real 90ms W3C press/release, jump remains a real 90ms Space/LMB chord,
the measured 60..200ms gate stays unmodified and fails closed, as do the
strict sequential 3-stage focus labels, M211 authoritative dual
recovery lifecycle, zero HP/guard changes, and third-stage clear.
M145 retains exactly its previous 100ms timer and 70..150ms spatial gate.
No production gameplay, network or server changes.

### M236 genuine short-LMB feint, remove post-release driver tick
Exact-head quality #39034355458 and retry #39033144071 each passed
65 CI stages before **M171** (M117 sufficient-stamina feint precondition)
produced a real 34HP hit. Genuine LMB pointerUP to wheel-back intervals
were ~77ms and ~91ms respectively. The test's R1 choreography still
inserted an extra W3C 20ms pause AND empty source-alignment tick after
the genuine 85ms short click, delaying wheel ingress beyond the
**unchanged 70ms** light-feint server window. Keep the same genuine
85ms down/up, but send the one true wheel-back in the IMMEDIATELY NEXT
W3C tick (rather than after the deliberate 20ms pause), in the same
multi-source command, with no simulated input. M117 authoritative
FeintRecovery/readability, exact no-damage/guard, exhausted-light and
exhausted-heavy non-cancellation, 12 stamina cost, original <=80ms
exhausted-gesture provenance, and server authority remain unchanged.
This is an acceptance-only scheduling candidate: full exact-head
real Chrome/Firefox CI must prove it; no production release yet.

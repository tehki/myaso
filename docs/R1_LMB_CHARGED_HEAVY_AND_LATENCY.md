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

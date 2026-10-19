# M321 — Preserve three-player punish target isolation under R2 dash

## Reproduced CI failure (19 October 2026)

Exact-head draft #320 quality run #39228320849 completed all five
genuine M194 short-block/guard-break repetitions successfully,
then failed unchanged strict M150 (three real Chrome/Firefox/Chrome2 clients).

For idle fighter #3 (Chrome2), two genuine W keyDown DOM events were
1792401601970 ms and 1792401602071 ms, **101 ms apart**. Replicated
server action transitions showed fighter #3 moved from idle (0) to
R2 dash (30) at tick 375, then returned idle at tick 384.
Fighter #3 then took the real 34 HP punish (100 -> 66) while the
intended parry-stunned fighter #1 stayed at 100 HP.
This is a genuine failure, not an acceptable strike or a game-side
target-selection defect established by the current evidence.

M147/M150 staging contains two bounded nearest-focus correction loops
of ordinary 30ms W3C W pulses on #3. With new 240ms R2 double-tap
dash behavior, repeating the corrections in either loop or across
their boundary can unintentionally dash #3 into the wrong attack lane.

## Minimal fix

Before **each** corrective W3C W tap in both loops, wait 300 ms,
greater than the unchanged 240ms double-tap threshold.
Keep both original loop attempt limits, 30ms real W3C key presses,
actual parry, unchanged original HP/guard/focus/attack assertions,
server-authoritative mechanics, and all R2 dash input mappings.
No fake DOM events, combat-rule changes, retries or test waivers.

Native browser M147/M150 and complete exact-head CI are mandatory.
After a green PR, independent merged-main CI, governance checks,
two-host multiplayer proof and production rollback remain required.
Do not merge/deploy while red. Public R0 stays pinned.

# M320 — Authoritative short-block diagnosis (DRAFT)

## Reproduced failure

The exact-head CI of PR #319, quality run #39225097747, passed the initial
genuine M194 guard-break repetition and then failed the second: the second
Firefox wheel was genuinely trusted and the Chrome LMB was genuine, but the
server awarded **parry** rather than the expected **-38 guard**. The Firefox
DOM-local wheel-to-parry cue was 205 ms. PR #317 run #39223959402 similarly
failed the third exchange after a Firefox DOM-local wheel-to-parry cue of
189 ms. Both are real red results, not skips, retries, or passes.

DOM wheel-to-visual-impact timing is **not authoritative block age**.
The server resolves parry using the 125 ms Block action elapsed window,
while browser short-block input is held for 240 ms. Input and snapshot frames
are asynchronous even on loopback. A 205 ms DOM interval cannot rule out an
authoritative action younger than 125 ms, or a reset between the wheel and hit.

## Change: evidence only

Enable the already guarded loopback-only MYASO_FLIGHT_ACTION_PROOF for genuine
uiguardbreak and uiguardbreaktell flights. The existing 60 Hz transition
trace now emits the actual tick of block/parry/guard-break combat events (along
with the existing fighter action changes). Print at most 16 relevant new
trace lines per genuine wheel/attack exchange **before** the unchanged
M193/M34 rejection branches. Associate with authoritative player net IDs,
not client wall-clock guesses.

Compare the defender's Block action-enter tick against its Parry/Block combat
event tick for the same attacker and defender. A block whose server age is
<=125 ms explains a legitimate parry; a block older than 125 ms with a parry
indicates an actual authoritative logic problem; missing transitions require
separate ingress and snapshot diagnosis.

This adds **no new gameplay input, authentication path, wire packet, game
constant, network timing, synthetic input, retries, or relaxed acceptance**.
The trace is off by default and non-loopback server start rejects the trace
flag. Production R0 remains pinned and neither PR #319 nor #317 is release
qualified. Next: inspect the full exact-head M194 result and use the
authoritative trace to implement the narrowest correct fix, not a guessed delay.

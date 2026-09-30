# M129 — Real Recovery Roll Buffer

## Goal

Prove M128's late light-recovery roll buffer through real Chrome controls and an independent Firefox authoritative witness.

## Real-control choreography

1. Chrome performs one genuine LMB light attack aimed at the staged Firefox fighter.
2. Firefox independently observes the replicated authoritative `attack-recovery` state.
3. Only after that observation, Chrome performs a second real W3C action sequence:
   - retarget the pointer perpendicular to the original attack line;
   - wait 145 ms on the browser-owned action clock;
   - emit exactly one genuine wheel-forward event.
4. Firefox must later observe authoritative `dodge-recovery`.

The proof no longer infers the buffer window from the original LMB timestamp. For the M129 scenario only, browser evidence records epoch timestamps for recovery-state transitions, pointer movement, and wheel input. The real Chrome wheel must occur after Firefox entered authoritative attack recovery and before Firefox left that recovery.

Because an ordinary wheel pressed outside light recovery either starts immediately from idle or is ignored before the M128 buffer opens, the required causal sequence — wheel physically inside attack recovery followed by later authoritative dodge recovery — proves the recovery buffer end to end.

## Acceptance

The flight fails closed unless:

- the real LMB down/up pair is observed;
- the original light resolves as exactly one 34 HP hit with 100 guard preserved;
- Firefox timestamps authoritative `attack-recovery`;
- the perpendicular pointer retarget occurs after that recovery began;
- exactly one real wheel-forward is observed;
- the wheel epoch falls inside Firefox's observed authoritative attack-recovery interval;
- Firefox later observes authoritative `dodge-recovery`;
- no parry result appears.

M128's deterministic browser and Rust tests remain the proof that the queued roll captures pointer-facing direction, does not charge stamina until execution, does not cancel recovery, rejects early-held input, and respects latest buffered intent.

## Boundary

No combat constants, packet format, client input cadence, stamina cost, roll duration, iframe duration, movement speed, damage, attack timing, recovery timing, collision behavior, or production UI behavior changes.

This milestone adds only real-browser acceptance evidence. The playable build is not opened.

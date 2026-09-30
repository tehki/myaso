# M129 — Real Recovery Roll Buffer

## Goal

Prove M128's late light-recovery roll buffer through real Chrome controls and an independent Firefox authoritative witness.

## Real-control choreography

Chrome performs one W3C action sequence:

- genuine LMB light attack aimed at the staged opponent;
- 40 ms LMB hold, then release;
- pointer stays on the attack line through windup/active, then the W3C sequence retargets perpendicular during recovery at about 320 ms requested time;
- the W3C sequence requests one genuine wheel-forward at about 370 ms after LMB-down.

The unchanged light timeline is 135 ms windup + 80 ms active + 255 ms recovery. Therefore the final 90 ms buffer window opens at about 380 ms and full recovery ends at about 470 ms. Chrome's measured CI action-dispatch overhead adds roughly 42–58 ms, so acceptance uses the actual DOM event timestamps and requires the real wheel itself to land inside the late-recovery window.

## Acceptance

The flight fails closed unless:

- the real LMB down/up pair is observed;
- a real perpendicular pointer move is observed before the wheel;
- exactly one real wheel-forward is observed;
- the wheel lands inside the intended late-recovery schedule;
- Firefox observes authoritative attack recovery before authoritative dodge recovery;
- Chrome observes the authoritative dodge only after the wheel and after a non-zero remaining-recovery delay;
- the original light still resolves as exactly one 34 HP hit with 100 guard preserved;
- no parry result appears.

M128's deterministic browser and Rust tests remain the proof that the queued roll captures pointer-facing direction, does not charge stamina until execution, does not cancel recovery, rejects early-held input, and respects latest buffered intent.

## Boundary

No combat constants, packet format, client input cadence, stamina cost, roll duration, iframe duration, movement speed, damage, attack timing, recovery timing, collision behavior, or production UI behavior changes.

This milestone adds only real-browser acceptance coverage. The playable build is not opened.

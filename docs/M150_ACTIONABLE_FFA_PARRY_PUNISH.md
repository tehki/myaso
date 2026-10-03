# M150 — Actionable FFA parry punish

## Goal
Prove that the authoritative `PARRY PUNISH` target is actionable in a real three-player fight, not only readable.

M150 changes no combat constants or authoritative combat rules. It extends browser acceptance on top of M148/M149.

## Three-player choreography
- Chrome / #1 attacks Firefox / #2 with one genuine aimed LMB.
- Firefox / #2 uses a genuine wheel-back parry.
- second Chrome / #3 is staged geometrically closer to Firefox and remains idle.
- the HUD must override ordinary `NEAREST #3` with `PARRY PUNISH #1`.
- while #1 is still in the unchanged 650 ms authoritative parry stun, Firefox aims back toward #1 and commits one genuine LMB.

## Acceptance
- #3 never becomes a parry-punish target.
- Firefox exposes `PARRY PUNISH #1` and `PUNISH / Parry stun`.
- the punish pointer-down occurs during #1's authoritative stun.
- exactly one unchanged 34 HP light hit lands on #1.
- final HP is #1 = 66, #2 = 100, #3 = 100.
- all guards remain 100.
- #3 receives no damage feedback.
- after the stun closes, Firefox returns to ordinary `NEAREST #3`.
- the playable build is not opened.

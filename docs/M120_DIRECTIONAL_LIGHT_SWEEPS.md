# M120 — Directional Light Sweeps

## Goal

Add attack-direction variation without another button or a damage upgrade.

A normal standing LMB remains the centered light attack. When the player is meaningfully strafing at the moment LMB is committed, the same light attack becomes a left- or right-shifted sweep lane.

## Input selection

- neutral / forward / backward movement + LMB -> centered light
- strafe toward the fighter's left + LMB -> left sweep
- strafe toward the fighter's right + LMB -> right sweep
- sprint + meaningful movement + LMB still has priority and remains the M118 running strike

The side choice is derived from movement relative to current facing, so no protocol button bit is added.

## Combat profile

Directional sweeps preserve normal light damage and timing:

- windup: 135 ms
- active: 80 ms
- recovery: 255 ms
- reach: 76
- damage: 34 HP
- guard damage: 38
- knockback: 18

The tradeoff is geometry:

- centered light arc: PI × 0.78
- directional sweep arc: PI × 0.62
- directional center offset: +/- PI × 0.16
- lateral selection threshold: 0.45 normalized movement

A side sweep therefore reaches farther around the chosen side while giving up coverage on the opposite side.

## Commitment and counterplay

Directional lights use the same commitment rules as normal light:

- active movement is locked;
- recovery remains punishable;
- the first 70 ms remain feintable by wheel-back;
- parry, block, guard pressure, dodge and death resolution remain authoritative and unchanged.

## Replication

Dedicated action states make the chosen lane readable remotely:

- 24 — left windup
- 25 — left active
- 26 — left recovery
- 27 — right windup
- 28 — right active
- 29 — right recovery

The threat HUD exposes LEFT/RIGHT WINDUP and LEFT/RIGHT SWEEP. Recovery uses PUNISH · Sweep recovery.

## Validation

M120 proves:

- left/right strafe selects the matching action;
- a side lane can hit geometry the centered light does not cover;
- damage stays 34 HP rather than becoming a stronger attack;
- directional windup still follows the ordinary early-light feint contract;
- codes 24–29 round-trip through snapshots;
- local and online rendering show the shifted attack arc;
- online prediction mirrors light windup/active/recovery movement restrictions;
- the sparring AI both reads directional windups and can create one using ordinary lateral movement + LMB.

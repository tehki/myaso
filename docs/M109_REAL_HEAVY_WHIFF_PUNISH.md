# M109 — Real Heavy Whiff Punish

## Objective

Prove with genuine Chrome/Firefox controls that heavy commitment creates a real punish window after a spacing whiff.

M109 exercises the combat north-star rule that recovery must reward spacing, timing, and counter-commitment. It changes no production combat or protocol behavior.

## Base

M108 exact green head `a053d2af22d4a1fb65a847dcefde2b6508bb8ee9`.

Quality run `36117355555`: PASS.

M108 already proves the heavy edge survives deliberate first-send input loss. M109 proves the resulting playable heavy can be whiff-punished by a real opponent.

## Scenario

New scenario:

`MYASO_PVP_SCENARIO=uiheavypunish`

Browser roles are fixed for repeatability:

- Firefox: heavy attacker;
- Chrome: spacing defender / light punisher.

## Exchange

The Firefox attacker first performs the normal shallow role-staging tap, then makes a real 120 ms retreat away from Chrome before pressing real `E`.

The retreat deliberately moves the heavy beyond its contact envelope. Chrome begins closing only near the end of the 320 ms windup plus 100 ms active window; the remaining spacing keeps those first closing frames outside heavy contact while allowing the counterattack to reach during recovery.

During authoritative heavy recovery, Chrome:

- closes distance with a real horizontal movement key;
- aims back toward the recovering attacker;
- delivers a real left-mouse light attack.

The light active frame lands while the attacker's unchanged 420 ms heavy recovery is still in force.

## Acceptance

The flight requires:

- real heavy role-staging movement, retreat movement, and `KeyE` down/up delivery;
- no 46-damage heavy hit;
- visible `PUNISH · Heavy recovery`;
- real defender closing movement;
- real defender left-mouse down/up with correct aim;

- exactly one authoritative 34-damage light punish;
- heavy attacker ends at 66 HP / 100 guard;
- defender remains at 100 HP / 100 guard;
- defender sees `Opponent hit - 34 HP.`;
- attacker sees `Hit taken - 34 HP.`;
- defender receives `hit-confirm`;
- attacker receives `damage-taken`.

## Focused CI

`Validate M109 real heavy whiff punish` syntax-checks the PvP browser harness and runs `uiheavypunish` as an isolated Chrome/Firefox flight.

All inherited M108 and earlier quality gates remain required.

## Production boundary

M109 changes only:

- browser acceptance harness registration and scenario logic;
- focused CI;
- milestone documentation;
- the README control list so the already-shipped `E` heavy binding is visible.

No damage, timing, reach, arc, knockback, guard, dodge, parry, movement, packet, snapshot, replication, scoring, persistence, deployment, or runtime settings change.

## Rollback

Close/discard M109; M108 remains the exact green heavy-input-loss base.

# M111 — Real Post-Heavy Guard-Break Punish

## Objective

Make the existing **"Opponent guard broken - punish."** promise mechanically true after a heavy guard break.

M110 proves that two legitimate heavies break a full held guard. M111 proves the attacker then has a real post-recovery opening to convert that break into a normal light punish before the defender leaves authoritative stun.

## Timing rationale

Before M111, all guard breaks used a 520 ms stun.

That duration is already appropriate for the light attack:

- light active: 80 ms
- light recovery: 255 ms
- existing guard-break stun: 520 ms
- post-recovery punish margin: **520 - 80 - 255 = 185 ms**

For a heavy attack, the attacker still owes:

- heavy active: 100 ms
- heavy recovery: 420 ms
- remaining commitment after the guard break: **520 ms**

Using the same 520 ms stun therefore leaves **0 ms** after heavy recovery.

M111 preserves the existing 185 ms post-recovery margin rather than inventing a new feel target:

- heavy active + recovery: 100 + 420 = 520 ms
- inherited punish margin: 185 ms
- heavy guard-break stun: **705 ms**

Light guard-break behavior remains unchanged at 520 ms.

## Authoritative acceptance

The Rust combat test proves:

1. ordinary held Block receives a first heavy and falls from 100 guard to 36;
2. a second heavy exhausts guard and produces authoritative `GuardBreak`;
3. the attacker completes the exact remaining heavy commitment;
4. the defender is still `Stunned` when the attacker returns to `Idle`;
5. a normal 135 ms light windup fits inside that opening;
6. the light lands for exactly 34 HP while the defender is still authoritatively stunned.

## Real-browser acceptance

The `uiheavyguardbreakpunish` flight runs the production client in Chrome and Firefox against the authoritative loopback server.

It first reuses the complete M110 proof:

- genuine directional movement;
- genuine held RMB Block;
- two genuine E heavy commitments;
- guard `100 -> 36 -> 0`;
- defender HP remains 100 through the break;
- authoritative guard-break feedback and `STUNNED` ownership.

Then M111:

- observes the attacker's real `PUNISH · Heavy recovery` cue while the defender is still visibly `STUNNED`;
- schedules a bounded genuine LMB burst at the tail of that real recovery;
- requires a new normal light commitment;
- requires exactly the normal 34 HP punish result, defender `100 -> 66`;
- requires the defender to still be visibly `STUNNED` when that hit is observed;
- rejects parry or dodge fallback.

## Scope

Production change is intentionally narrow:

- light guard-break stun: unchanged at 520 ms;
- heavy guard-break stun: derived to 705 ms;
- heavy damage: unchanged at 46;
- heavy guard damage: unchanged at 64;
- heavy windup/active/recovery: unchanged at 320/100/420 ms;
- light timing/damage: unchanged at 135/80/255 ms and 34 HP;
- parry timing, block arc, movement, guard regeneration, protocol, persistence, and deployment behavior are unchanged.

The server selects guard-break stun duration from the attack profile, so only heavy guard breaks receive the longer duration.

## Rollback

Discard the M111 branch/PR. Exact-green M110 head `8dd8f72f52d6561446300bf9ae209a909e5a9906` remains the frozen baseline.

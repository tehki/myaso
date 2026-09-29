# M105 — Heavy Committed Strike Kernel

## Objective

Deepen human-vs-human combat with a second offensive decision while preserving the project's combat north star: readable commitment, server authority, dodge/parry counterplay, and no progression-stat advantage.

M105 deliberately implements only the authoritative combat/protocol kernel. Player-facing binding, spatial tell styling, HUD feedback, and real-browser heavy-strike acceptance are deferred to M106 so the authority/wire contract can be proven independently.

## Base

M104 exact green head `e56efd03bb2d66f7d3d35e285586f3a25d6f71bf`.

Quality run `36074344071`, bounded unchanged-head rerun job `107973973926`: PASS.

At 512 players M104 retains the 1100-byte datagram ceiling, zero combat/near deadline misses, and 20 Hz replication within the 50 ms budget.

## Combat design

Light attack remains unchanged.

Heavy attack adds three committed states:

- `HeavyAttackWindup` / `heavy_attack_windup` — wire action code 9;
- `HeavyAttackActive` / `heavy_attack_active` — wire action code 10;
- `HeavyAttackRecovery` / `heavy_attack_recovery` — wire action code 11.

Heavy profile:

- windup: 320 ms;
- active: 100 ms;
- recovery: 420 ms;
- reach: 82 world units;
- arc: `PI * 0.68`;
- health damage: 46;
- guard damage: 64;
- knockback: 28;
- windup movement multiplier: 0.20;
- recovery movement multiplier: 0.35.

The existing light attack remains:

- 135 / 80 / 255 ms;
- 76 reach;
- `PI * 0.78` arc;
- 34 damage;
- 38 guard damage;
- 18 knockback.

### Intent

Heavy is stronger against passive blocking but substantially easier to read and punish:

- 46 damage still requires three clean hits from full HP;
- 64 guard damage means two blocked heavies break full guard;
- longer/narrower commitment makes dodge, spacing, and whiff punishment more valuable;
- the same fresh-block parry window can still stun the heavy attacker;
- dodge i-frames remain unchanged.

Heavy does not cancel light attacks, recovery, dodge, stun, death, or block. If heavy and light bits are present together from idle, heavy has explicit priority.

## Shared attack resolution

M105 does not fork combat resolution.

Rust and JavaScript resolve light/heavy through one attack-profile path. Both retain the same:

- target iteration/order;
- one-hit-per-target set;
- dodge invulnerability;
- directional block test;
- fresh-block parry;
- guard-break event;
- hit/death event ordering.

Only profile values differ.

## Input wire

The input sample stays exactly 6 bytes.

Button byte:

- bit 0: light attack;
- bit 1: dodge;
- bit 2: block;
- bit 3: heavy attack;
- bits 4–7 remain reserved.

Three redundant samples therefore remain exactly 34 bytes including the existing 16-byte packet header.

Global protocol version remains 1.

## Loss recovery

M63 semantics are extended rather than bypassed.

The newest accepted one-shot sample containing light attack, heavy attack, or dodge supplies committed one-shot bits/facing. Newest continuous movement/block state remains authoritative, except dodge retains its original movement direction exactly as before.

The loopback first-send action-drop fixture also recognizes heavy attack, so a later browser acceptance can prove heavy edges survive normal three-sample redundancy.

## Snapshot compatibility

Historical action codes 0–8 are unchanged.

Heavy uses 9–11, which fit M103's four-bit v6 action representation. Normal heavy action+kill-flag records therefore remain one action byte under v6.

Public JavaScript snapshot decoding maps all three heavy codes to explicit action names.

No snapshot encoding/version change is required.

## Focused validation

Rust:

- `heavy_attack_preserves_long_commitment_and_deals_46_once`;
- `heavy_attack_applies_64_guard_pressure_and_remains_parryable`;
- heavy states encode as action codes 9/10/11;
- `decodes_heavy_attack_from_spare_input_button_bit`;
- `coalesces_redundant_heavy_attack_edge_with_committed_facing`.

JavaScript:

- heavy phase commitment mirrors Rust;
- one heavy hit deals exactly 46 once;
- blocked heavy costs exactly 64 guard;
- fresh block still parries heavy;
- heavy input bit leaves packet size at 34 bytes;
- heavy action names round-trip through current snapshot encoding.

All inherited combat, networking, browser, FFA, input-loss, convergence, reliable-delta, and 512-player capacity checks remain required.

## Explicit M105 boundary

M105 does **not** bind heavy attack to a keyboard/mouse control yet and does not add its spatial tell/readability treatment.

That player-facing surface is intentionally isolated for M106 after the kernel is green.

## Unchanged

No light attack constants, dodge timings, block/parry angle/window, guard regeneration, death/respawn, FFA scoring, snapshot cadence, interest management, persistence, deployment, or runtime configuration changes.

## Rollback

Close/discard M105; M104 remains the exact green base.

# M121 — Forward Thrust and Backward Overhead

## Goal

Complete the movement-driven light-attack grammar without adding another button.

The attack chosen by LMB now depends on movement relative to the current mouse-facing direction:

- neutral input -> centered light
- dominant lateral input -> left/right sweep
- movement toward the pointer -> thrust
- movement away from the pointer -> overhead
- sprint + meaningful movement still takes priority -> running strike

Diagonal inputs are deterministic: the dominant movement axis owns the attack choice.

## Thrust

The thrust converts forward footwork into range, not damage.

- windup: 150 ms
- active: 70 ms
- recovery: 270 ms
- reach: 96
- arc: PI × 0.22
- damage: 30 HP
- guard damage: 30
- knockback: 16
- windup movement: 0.55x
- active movement: 0.25x
- recovery movement: 0.45x

It reaches farther than the centered light, but its narrow lane and lower damage make lateral evasion the natural answer.

## Overhead

The overhead converts backward-relative input into slower close pressure.

- windup: 185 ms
- active: 85 ms
- recovery: 300 ms
- reach: 72
- arc: PI × 0.36
- damage: 38 HP
- guard damage: 46
- knockback: 24
- windup movement: 0.25x
- active movement: 0x
- recovery movement: 0.38x

It hits harder than the centered light and pressures guard more, but gives the opponent a longer tell and a longer punishable recovery. Heavy attack remains the higher-commitment/highest-pressure option.

## Feints and defense

Both new attacks use the existing light feint contract:

- wheel-back may cancel only during the first 70 ms of windup;
- feint still costs 12 stamina and enters 270 ms recovery;
- late wheel-back cannot erase the committed strike.

Parry, short block, roll, guard pressure, death and respawn remain authoritative and unchanged.

## Replication

Dedicated action states make the selected lane visible remotely:

- 30 — thrust windup
- 31 — thrust active
- 32 — thrust recovery
- 33 — overhead windup
- 34 — overhead active
- 35 — overhead recovery

Threat HUD phases are THRUST WINDUP / THRUST and OVERHEAD WINDUP / OVERHEAD. Recovery exposes dedicated PUNISH cues.

## Validation

M121 proves:

- movement toward aim selects thrust;
- movement away from aim selects overhead;
- dominant lateral movement still selects the side sweep on diagonals;
- thrust can reach geometry where a stationary centered light cannot;
- thrust damage stays lower at 30 HP;
- overhead deals 38 HP and carries more guard pressure than centered light;
- both remain early-feintable under the ordinary light contract;
- action codes 30–35 round-trip through snapshots;
- local and online renderers expose distinct thrust/overhead tells;
- online prediction mirrors authoritative movement commitment;
- the deterministic sparring AI reads and deliberately uses both options.

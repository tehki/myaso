# M117 — Forward Thrust

## Goal

Add the first directional light-attack variation without adding another combat button.

A normal LMB remains the existing broad slash. Holding movement substantially toward the current mouse-facing direction while pressing LMB selects a committed thrust instead.

## Selection

At attack start, the normalized movement vector is compared with fighter facing.

- forward alignment dot >= 0.65: thrust
- neutral, sideways, or backward movement: normal slash

The choice is made once at commitment start. Movement cannot morph a slash into a thrust or vice versa after windup begins.

## Thrust profile

- windup: 120 ms
- active: 70 ms
- recovery: 235 ms
- reach: 94
- total arc: 0.20π (36 degrees)
- damage: 30 HP
- guard damage: 32
- knockback: 16

The existing slash remains broader and harder-hitting, while thrust trades width and a little damage for reach and forward pressure.

## Authority and replication

The authoritative Rust simulation makes the same directional choice as the local combat model.

New snapshot actions:

- 20 — thrust windup
- 21 — thrust active
- 22 — thrust recovery

The current wide-action encoding path carries these states without a protocol version change.

## Readability

Thrust has:

- a narrow blue attack cone
- a distinct narrow weapon trail
- THRUST WINDUP / THRUST threat labels
- a dedicated PUNISH · Thrust recovery cue
- threat selection using thrust's real reach and arc

## Validation

Local combat/readability/network/impact/AI validation is 101/101 green and proves:

- forward LMB selects thrust
- neutral LMB remains slash
- thrust reaches farther than slash
- off-axis targets miss the narrow cone
- damage is applied once
- windup/active/recovery commitment remains intact
- snapshot actions 20/21/22 round-trip
- FFA threat selection uses the thrust geometry

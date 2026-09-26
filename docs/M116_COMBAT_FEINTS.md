# M116 — Combat Feints

## Goal

Add a deliberate bait/counter-bait layer without turning attack commitment into a free cancel.

A wheel-back input keeps its normal parry/short-block role while idle. During the **early** part of an attack windup, the same input becomes a feint.

## Rules

### Light feint

- available only during the first **70 ms** of light windup
- costs **12 stamina**
- cancels the attack before it can become active
- enters **270 ms feint recovery**
- movement is limited to **0.5x** during recovery

### Heavy feint

- available only during the first **160 ms** of heavy windup
- same **12 stamina** cost
- same **270 ms** recovery

A wheel-back after the feint window does **not** erase the commitment. The strike continues normally.

## Counterplay

Feints are not free safety:

- insufficient stamina prevents the cancel;
- the recovery is replicated as action code **19**;
- opponents receive a **PUNISH · Feint recovery** readability cue;
- the sparring AI treats feint recovery as a real light-punish opportunity;
- the normal 240 ms wheel-back pulse expires before the 270 ms feint recovery finishes, so a completed feint does not automatically become a free block.

## Authority

The Rust simulation owns the feint window, stamina payment, action transition and recovery duration. The browser mirrors the same constants for local combat and prediction.

No new input bit is required: feint intentionally reuses the existing wheel-back/block input.

## Acceptance

The milestone proves:

- an early light wheel-back enters feint recovery and spends stamina;
- a late heavy wheel-back cannot cancel the committed strike;
- an exhausted attacker cannot feint;
- feint recovery round-trips through snapshot action code 19;
- recovery is presented as punishable;
- the sparring AI punishes exposed feint recovery.

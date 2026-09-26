# M121 — Real Directional Light Sweep

## Goal

Prove the M120 side-sweep selection through the production browser controls and authoritative server.

## Real input contract

The Chrome attacker:

- closes to normal light range using ordinary movement;
- aims at the Firefox rival;
- holds the screen-space left strafe key relative to current facing;
- presses and releases LMB while that strafe remains active;
- releases the strafe after the attack has been sampled.

No direct input-state mutation, combat-state mutation, teleport, or server-side action injection is allowed.

Because the arena uses screen coordinates with Y increasing downward, screen-left is:

- **W** while facing right;
- **S** while facing left.

## Required authoritative result

The flight requires:

- real strafe key down/up;
- real LMB down/up;
- exactly one 34 HP hit: defender 100 -> 66;
- attacker stays 100 HP / 100 guard;
- defender guard remains 100;
- attacker renders `Opponent hit - 34 HP.`;
- defender renders `Hit taken - 34 HP.`;
- defender observes `LEFT WINDUP` or `LEFT SWEEP`;
- defender observes `PUNISH · Sweep recovery`;
- attacker renders left-sweep commitment/recovery text.

The flight fails closed on missing controls, wrong damage, guard interaction, wrong sweep side, missing threat readability, or missing recovery readability.

## Why this matters

M120 defines directional geometry. M121 proves a player can select that geometry with ordinary strafe + LMB through the same production UI and authoritative network path used by real play.

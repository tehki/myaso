# M115 — Wilds Sparring AI

## Goal

Make the local sparring opponent exercise the new combat grammar instead of behaving like the pre-M113 prototype.

The bot remains deterministic and testable. It does not use randomness, hidden state from the player, or privileged combat outcomes.

## Behaviors

### Distance closing

At long range the bot moves toward the player and runs when stamina allows. Low stamina automatically disables running while preserving ordinary movement.

### Threat reads

When it sees a readable light, heavy, or jumping-attack windup at close range, the bot deterministically chooses between:

- short directional block
- pointer-directed roll toward/through the attacker
- retreat movement

This makes the new counterplay mechanics appear naturally during sparring.

### Anti-turtle pressure

When the player is visibly blocking inside shove range, the bot prefers kick/shove rather than repeatedly feeding the guard.

### Offensive variation

At close range the bot cycles deterministically through:

- light attack
- kick/shove
- jump into jumping attack
- committed heavy attack

The cycle uses normal combat inputs and the same stamina gates as a player.

### Jump chaining

A jump decision arms one follow-up. Once the authoritative/local combat model reports the bot in the jump action, the next AI sample sends a genuine attack input to produce the jumping attack.

## Constraints

- no randomness
- no teleporting
- no direct HP/guard/stamina mutation
- no bypass of action commitment
- no privileged knowledge beyond current fighter state
- pointer-directed roll keeps the same M113 direction rule

## Validation

Dedicated tests prove:

- run closes distance and low stamina disables sprint
- readable windup can trigger pointer-directed roll
- short block remains bounded
- blocking player triggers shove
- jump chains into jumping attack
- heavy attack remains part of the offensive rotation

The combined combat, impact, readability, networking, and sparring-AI local suite is green.

# M113 — Wilds-Style Movement and Combat Schema

## Goal

Replace the prototype's keyboard-heavy defensive movement with the requested mouse-driven Wilds.io-style combat schema while preserving server authority.

## Controls

- **WASD** — movement
- **Mouse** — facing / aim
- **LMB** — normal attack
- **E** — heavy committed attack
- **Mouse wheel forward** — roll
- **Mouse wheel backward** — parry + short directional block
- **RMB tap** — kick / shove
- **RMB hold (180 ms+)** — run
- **Space** — jump
- **Space + LMB** — jumping attack

A right-click is resolved by duration: a short click becomes a shove; holding past 180 ms becomes running and does not fire a shove on release.

## Combat behavior

### Roll

Roll replaces the old Space dodge binding.

- 170 ms roll
- 125 ms i-frame window
- committed 180 ms recovery
- costs 28 stamina
- roll direction is always the current mouse-pointer/facing direction; WASD does not steer the roll
- collision with a rival knocks them away and applies a short 260 ms stun

### Parry / short block

Wheel-back opens a 240 ms directional block pulse.

- first 125 ms are the parry window
- successful parry stuns the attacker for 650 ms
- this deliberately gives the defender a comfortable real light-punish opportunity
- holding a permanent turtle block is no longer part of the player control schema

### Kick / shove

RMB tap performs a committed close-range shove.

- 90 ms windup / 70 ms active / 220 ms recovery
- costs 18 stamina
- unblocked contact deals no HP damage, knocks the target away, and stuns for 360 ms
- a correctly facing block absorbs the stun and instead takes 30 guard pressure

### Running and stamina

Running begins after RMB has been held for 180 ms.

- 1.55x movement speed
- drains 24 stamina per second while moving
- stamina regenerates at 30 per second after a 360 ms delay
- roll, kick, jump, and jumping attack also consume stamina
- stamina max is 100

### Jump / jumping attack

Space begins a 430 ms jump and costs 14 stamina.

Pressing LMB while airborne converts it into a committed jumping attack:

- 105 ms windup / 105 ms active / 290 ms recovery
- 42 HP damage
- deliberately short 48-unit reach
- deliberately narrow 0.24π attack cone (about 43° total)
- 52 guard pressure
- stronger 34-unit knockback
- costs an additional 12 stamina

## Authority

The new action buttons use the previously spare bits in the existing one-byte input button field, so input packets do not grow.

The Rust simulation owns action acceptance, stamina spending, running speed, roll collision stun, kick stun/guard pressure, jumping attack damage, parry stun, death, and collision outcomes.

The browser may predict movement/stamina presentation for responsiveness, but does not invent authoritative hits, stuns, damage, parries, deaths, or respawns.

## Compatibility

Existing light/heavy attack controls and their damage values remain available.

The legacy model-level `dodge` and `block` input fields remain as protocol primitives for compatibility and automated tests; the playable UI remaps them to wheel-forward roll and wheel-back short block.

## Follow-on feel work

This milestone establishes the requested movement grammar. The next feel slices build on it with impact/hit-stop and particles, directional attack variation and feints, and the first-to-5 duel/rematch loop.

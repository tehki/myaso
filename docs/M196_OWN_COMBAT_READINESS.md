# M196 — Authoritative local combat readiness

## Motivation

The game already describes opponent threats and punish opportunities, and it
shows major event feedback. However, a fighter looking at their own HUD cannot
always distinguish readiness from an attack already committed or its vulnerable
recovery. Pressed keys and dispatched wheel events are not authoritative proof
that a combat action took effect, especially under cross-browser latency.

## Implementation

The **You** HUD card gains a concise readiness chip based exclusively on
the authoritative player snapshot from the network client.

- **READY:** idle; movement and light attacks are available (other actions
  remain subject to authoritative stamina costs).
- **WINDUP / STRIKING:** committed light/heavy/running/side-sweep/jump/kick
  attack phases.
- **RECOVERING / ROLL RECOVERY:** punishable action recovery, distinguished
  from the ready state.
- **BLOCKING:** server-confirmed held block; no speculative parry-success claim.
- **ROLLING / AIRBORNE:** movement commitment from authoritative action.
- **STUNNED / KNOCKED DOWN:** locked action states.

The chip is hidden before the authoritative player snapshot, on death,
or for invalid/unrecognized actions. DOM writes occur only when state/text
changes. Text supplements color, and the original threat overlay,
opponent punish cues, and combat feedback remain intact.

## Promotion

Deterministic tests cover every living action identifier, invalid/dead
states, snapshot immutability, and DOM source wiring. Full Rust,
JavaScript, Chrome/Firefox real-input multiplayer acceptance, FFA,
guard break, parry, and 512-player capacity CI remain required.

No changes to gameplay timing, combat costs/damage, input controls,
network protocol, playable build access, or deployment. Merge only after
exact-head CI passes, then verify post-merge main CI independently.

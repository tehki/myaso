# M118 — Running Strike

## Goal

Turn movement into offense without adding another dedicated button.

While already sprinting with meaningful movement input, pressing light attack commits to a running strike. The move is longer-reaching than the standing light, but it costs stamina, has a readable lane, and leaves a larger punish window.

## Input

- hold run
- keep a movement direction active
- press light attack

Run without movement plus light attack remains an ordinary standing light.

## Authoritative profile

- windup: 160 ms
- active: 90 ms
- recovery: 310 ms
- reach: 92
- arc: PI × 0.58
- damage: 30 HP
- guard damage: 34
- knockback: 22
- stamina cost: 10
- windup movement: 0.90x
- active movement: 0.60x
- recovery movement: 0.42x

The running strike intentionally does less damage than standing light. Its advantage is spatial conversion: sprint momentum becomes a committed approach attack.

## Readability and counterplay

The move has dedicated replicated states:

- 21 — running attack windup
- 22 — running attack active
- 23 — running attack recovery

Threat HUD labels distinguish RUNNING WINDUP / RUNNING STRIKE from standing light. Recovery exposes a PUNISH cue. The sparring AI reads the windup and can also use the running strike at medium range.

## Acceptance

M118 proves:

- sprint + meaningful movement + light enters running attack windup;
- the attack costs 10 stamina;
- it traverses space during commitment;
- it can connect from a distance where an unmoving standing light misses;
- run + light without meaningful movement stays a normal light;
- action codes 21–23 round-trip through snapshots;
- running recovery is explicitly punishable;
- both local and online renderers expose a distinct lunge tell.

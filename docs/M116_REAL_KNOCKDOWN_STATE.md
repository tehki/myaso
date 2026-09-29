# M116 — Real Knockdown State

## Goal

Make shove and roll collision visibly and mechanically **knock fighters down** instead of reusing the generic stun state.

Parry and guard break remain stun mechanics. Knockdown is a separate authoritative action with its own wire code, browser presentation, recovery cue, and movement lock.

## Authoritative behavior

### Kick / shove

An unblocked kick:

- deals no HP damage
- applies the existing shove knockback
- enters **Knockdown** for 360 ms
- ignores movement and facing input until recovery completes

A blocked kick still becomes guard pressure and does not knock the blocker down.

### Roll collision

A roll collision:

- keeps the existing roll collision knockback
- enters **Knockdown** for 260 ms
- ignores movement and facing input until recovery completes

The roller remains in its committed roll/recovery sequence.

## Distinction from stun

'Stunned' remains reserved for:

- successful parry punish windows
- guard break punish windows

'Knockdown' is reserved for physical displacement/control outcomes such as shove and roll collision.

This keeps combat readability honest: a player can immediately tell whether they were outplayed defensively (stun) or physically put on the floor (knockdown).

## Replication

Knockdown is authoritative wire action **19**.

The existing snapshot codec uses its wide action escape when the compact 4-bit action representation cannot encode that value, so no protocol version change is required.

## Presentation

While knocked down:

- the fighter is rendered as a flattened/rotated fallen body
- local facing is frozen
- online prediction locks movement and facing
- the overlay reads **KNOCKED DOWN**
- opponents receive a **PUNISH · Knockdown recovery** cue
- shove/roll impact effects from M114 remain active

Parry and guard-break visuals continue to use the existing upright stun presentation.

## Validation

Local validation covers:

- kick enters knockdown
- roll collision enters knockdown
- knockdown duration is bounded
- movement and facing inputs cannot move/rotate the fallen fighter
- parry remains Stunned
- guard break remains Stunned
- knockdown survives snapshot encoding as action 19
- knockdown owns distinct overlay/recovery presentation
- existing combat, impact, readability, networking, and sparring-AI behavior remains green

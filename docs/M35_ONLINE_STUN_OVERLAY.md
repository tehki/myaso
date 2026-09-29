# M35 — Authoritative Online Stun Overlay

## Objective

Make the server-owned punish window unmistakable on the normal online arena without moving combat authority into the browser.

## Product behavior

- When the local authoritative fighter action is `Stunned` (`7`), the arena overlay shows `STUNNED` and `Punish window open.`.
- The overlay clears automatically when the authoritative action leaves `Stunned`.
- `Dead` (`8`) remains the separate M31 `DEFEATED / Respawning…` lifecycle.
- Existing parry, guard-break, hit, HUD, and canvas tells remain presentation-only consumers of authoritative snapshots.

## Browser acceptance

The `uistun` flight reuses the accepted M33 Chrome-attacker / Firefox-defender parry choreography with real W3C controls.
Acceptance requires:

- the parried attacker to receive the existing `parried` feedback;
- the parrying defender to receive the existing `parry-success` feedback;
- only the stunned attacker to show the `STUNNED` overlay;
- no `DEFEATED` overlay during the stun lifecycle;
- the stun overlay to return to hidden after authoritative recovery;
- both fighters to remain at 100 HP and 100 guard through the parry exchange.

## Boundaries

No server simulation, parry timing, stun duration, combat constants, wire protocol, persistence, networking, public bind, deployment, or production activation changes are part of M35.
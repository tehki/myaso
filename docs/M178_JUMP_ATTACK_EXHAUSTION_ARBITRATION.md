# M178 — Exhausted Jump / Light-Attack Arbitration

## Goal

Complete the Wilds-style Space+LMB chord's fail-closed stamina behavior in both the JavaScript combat model and authoritative Rust server, consistent with M174–M176 input arbitration.

## Contract

- Affordable simultaneous Space+LMB from Idle still starts the original narrow jump attack and spends the unchanged combined 26 stamina.
- A chord with 14–25 stamina degrades to an ordinary 14-stamina jump, never a free light attack.
- A chord with fewer than 14 stamina is rejected as one jump intent; its simultaneous LMB edge is consumed rather than creating a standing/directional light attack.
- During late light recovery, an unaffordable Space+LMB chord cannot create a new buffered light, jump or jump attack.
- An attack buffered on an earlier tick remains valid after a later exhausted Space+LMB chord.
- No repeat-on-hold is introduced, and existing feint, roll, kick, block and running-attack arbitration stays unchanged.
- Combat movement, stamina values, hitboxes, windups, packets, snapshots, networking, and protocol remain unchanged.

## Acceptance

JavaScript and authoritative Rust regressions prove the denied idle chord, denied late-recovery chord, and earlier buffered-light preservation. Existing affordable and downgraded-to-normal-jump tests stay green.

The existing browser uijumpattack and uistaminaconfirmed acceptance flights remain unchanged: this is a same-input-tick kernel safety rule, not a simulated browser gesture that WebDriver cannot guarantee atomically.

The playable build remains intentionally closed.

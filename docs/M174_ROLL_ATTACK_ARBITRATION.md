# M174 — Roll / Light-Attack Arbitration

## Goal

Make wheel-forward roll intent deterministic when LMB lands on the same authoritative input tick.

## Contract

- Wheel-forward roll remains the higher-priority action when roll and light attack arrive together.
- An affordable same-tick roll + LMB resolves exclusively to Dodge and spends only the unchanged 28-stamina roll cost.
- If roll stamina is below 28, the same-tick LMB edge is consumed with the denied roll. It must not leak into an ordinary or directional light attack.
- During late light-attack recovery, an exhausted same-tick roll + LMB must not create a new light buffer.
- A light attack already buffered on an earlier input tick is preserved if a later exhausted roll + LMB chord arrives; denial does not erase prior committed intent.
- Roll direction remains pointer-owned.
- The existing authority-confirmed low-stamina cue remains “Low stamina — roll needs 28.” and is shown only after processedClientTick acknowledges the denied roll input.
- No stamina costs, regeneration/drain rates, damage, guard, movement speeds, action timings, hitboxes, packet layouts, snapshot layouts, or protocol constants change.

## Acceptance

The existing real Chrome + Firefox `uistaminaconfirmed` gate becomes an M174 superset:

1. preserve confirmed low-stamina roll, kick, jump, and running-attack denial;
2. while authoritatively exhausted, submit one genuine same-WebDriver-tick wheel-forward + LMB chord;
3. prove one real wheel-forward and one real LMB gesture were recorded together;
4. require authority-confirmed roll denial after the exact input tick is acknowledged;
5. prove no Dodge/DodgeRecovery and no ordinary/directional light-attack state occurs;
6. prove the chord spends no stamina and changes no health or guard.

JS and Rust regressions separately cover affordable arbitration, exhausted idle arbitration, exhausted recovery arbitration, and preservation of an earlier buffered light.

The playable build remains intentionally closed while combat acceptance continues.

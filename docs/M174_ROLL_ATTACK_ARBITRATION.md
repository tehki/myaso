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
2. while authoritatively exhausted, submit wheel-forward and LMB from one WebDriver multi-source action;
3. prove one real wheel-forward and one real LMB gesture were recorded within a bounded near-simultaneous interval;
4. require authority-confirmed roll denial after the exact roll input tick is acknowledged;
5. prove no Dodge/DodgeRecovery is accepted and no roll stamina is spent;
6. prove combat health and guard remain unchanged.

ChromeDriver does not dispatch W3C wheel and pointer sources atomically; observed source skew can span multiple 60 Hz input samples. The browser phase therefore proves genuine control generation plus confirmed roll denial, while JS and Rust regressions are the authority for true same-input-tick arbitration: affordable roll priority, exhausted idle attack consumption, exhausted recovery arbitration, and preservation of an earlier buffered light.

The playable build remains intentionally closed while combat acceptance continues.

# M175 — Kick / Light-Attack Arbitration

## Goal

Make short-RMB kick intent deterministic when LMB lands on the same authoritative input tick, matching the fail-closed roll arbitration established by M174.

## Contract

- Short RMB kick remains the higher-priority action when kick and light attack arrive together.
- An affordable same-tick kick + LMB resolves exclusively to KickWindup and spends only the unchanged 18-stamina kick cost.
- If kick stamina is below 18, the same-tick LMB edge is consumed with the denied kick. It must not leak into an ordinary or directional light attack.
- During late light-attack recovery, an exhausted same-tick kick + LMB must not create a new light buffer.
- A light attack already buffered on an earlier input tick is preserved if a later exhausted kick + LMB chord is denied; denial does not erase prior committed intent.
- The existing authority-confirmed cue remains “Low stamina — kick needs 18.” and appears only after processedClientTick acknowledges the denied kick input.
- No stamina costs, regeneration/drain rates, damage, guard, movement speeds, action timings, hitboxes, packet layouts, snapshot layouts, or protocol constants change.

## Acceptance

The existing real Chrome + Firefox `uistaminaconfirmed` gate becomes an M175 superset:

1. preserve M174 confirmed roll/light arbitration and the existing roll, kick, jump, and running-attack denial proofs;
2. while authoritatively exhausted, submit one genuine short-RMB + LMB gesture;
3. prove one real right-button press/release shorter than the unchanged 180 ms run threshold and one real LMB press/release were recorded in the same bounded gesture;
4. require authority-confirmed kick denial after the kick input is acknowledged;
5. prove no KickWindup/KickActive/KickRecovery is accepted and no kick stamina is spent;
6. prove combat health and guard remain unchanged.

WebDriver serializes mouse-button transitions rather than exposing a guaranteed single engine input tick. The browser phase therefore proves genuine control generation plus confirmed kick denial, while JS and Rust regressions are authoritative for true same-input-tick arbitration: affordable kick priority, exhausted idle attack consumption, exhausted recovery arbitration, and preservation of an earlier buffered light.

The playable build remains intentionally closed while combat acceptance continues.

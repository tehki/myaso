# ⚔️ Combat4 Pre-Alpha P0: direct real-World hit/HP bridge (REVIEW ONLY)

**Purpose:** prove Main's owner-approved instant light/320 ms release-heavy intent against the *actual original authoritative Rust `World`*; not merely a pure reducer and not any fake HP/test attack. The versioned v2 gesture transport, DOM, lease binding and live actor command dispatch remain unimplemented and unauthorized for public endpoints. This branch is a **draft child of #711**, stacked through versioned proposal #705 and partial source-fix #700.

## What code changes / does not change

The original `server/src/simulation.rs` now provides one explicitly named **`World::apply_review_only_lmb_gesture_command`** method, which is **not called by `server/src/main.rs`, networking or any production gameplay client**. It interprets only a proposed `GestureAuthority` decision, and it fails closed unless the actual fighter is in an appropriate unlanded original action. Original World windup, hit/guard damage, knockback, action reach, active/recovery, duel scoring and 60Hz hit resolver stay unchanged. It starts the actual `AttackWindup` on accepted `BeginLightWindup`; upgrades only a gesture-owned, unlanded attack to held heavy with original **World** elapsed clock; retains READY until explicit accepted release; restores original elapsed light phase for early release; cancels still-unlanded light/heavy without phantom hits.

Two private, initially `false` `Fighter` flags exclusively separate v2 review action ownership from live legacy v1 attack bits. A v2 reviewer cannot cancel or upgrade an unrelated v1 light, nor commit/cancel an unrelated `KeyE` heavy. A v2 held charge no longer self-cancels because the v1 button snapshot (correctly) did not contain v2 state. The unchanged original v1 branch operates exactly as before when neither review flag is set. These flags are **not serialized, not added to wire layout, not enabled in any production actor input path**.

For defense in depth, `UpgradeHeldHeavy` and `ResumeLight` cross-check command/server time against **fighter.action_elapsed_ms** within one original 60Hz tick; externally invented elapsed values cannot launch hit/READY. Server active/hit resolution is always driven by normal `World::step()`, including real damage events and actual `fighter.hp`. The bridge does not inject CombatEvents or edit HP in tests.

## Actual fail-first reproduction and correction

1. Added integration test that invoked the nonexisting `apply_review_only_lmb_gesture_command` on real `World`: compile RED, not a fabricated assertion.
2. Initial bridge code passed the native actual 34HP immediate press-light and quick tap, but failed three actual World tests: a valid held-upgraded v2 charge was dropped by the old `input.attack && input.heavy_attack` legacy gate on the next server tick even though v2 is a separate stream. This prevented 320ms READY, early-light fallback and Cancel from operating. Preserved original failure output.
3. Added a private gesture-owned charge fence; **legacy v1 branch untouched when flag false**. Focused end-to-end World tests now GREEN.
4. Added a strict v2 action ownership fence, timestamp mismatch and actor rejoin checks, then four genuine original World fighter objects and duplicate replay test.

## Genuine original World outcome

`server/tests/prealpha_lmb_world_hit_proof.rs` uses 60Hz `World::step()` and matching source `GestureAuthority` events, observing real `CombatEvent::Hit` and HP:

| Case | Exact original World result |
| --- | --- |
| Authenticated review `PRESS` before first `World.step` | Real `AttackWindup` immediately, then **one 34HP HIT**, victim **100→66HP**, never pre-windup damage |
| Accepted upgrade during first ~83ms, hold past 320ms indefinitely | No early light HP damage and no auto-heavy; READY held |
| Matching release after READY | Real `HeavyAttackActive` then **one 46HP HIT**, victim **100→54HP**, no double hit |
| Press + release between two server ticks | One light **34HP** remains; no phantom extra hit |
| Focus/gesture CANCEL before light contact | Zero HIT events, victim HP remains 100 |
| Heavy upgrade followed by release before READY | Resume original light; **one 34HP HIT**, no heavy |
| Cancel heavy after READY | Zero HP damage |
| 4 actual server-owned fighter roster | In-range victim 46HP once; two out-of-range fighter HP unchanged at 100 |
| Duplicate server RELEASE / replay | No second heavy HIT |
| Delayed or absent UPGRADE after light active | No heavy; light dealt just once |
| Unrelated legacy v1 light or `KeyE` heavy | Review bridge **cannot cancel, upgrade or commit** legacy actions |
| Active block, nonexistent actor or forged elapsed timestamp | Commands fail closed |
| Remove and rejoin same net ID | Old release/cancel cannot strike the new idle fighter |

All timings measured from **server-owned World clock**, not browser/request `client_tick`. `GestureAuthority` still owns monotonic lease/sequence/gesture fences; this source cannot authenticate a network sender by itself.

## Still unimplemented and release blocking

- Core 8A must implement an explicitly negotiated, authenticated and bounded reliable input-v2 transport for separate LMB events, preserving actual DOM pointerdown/up even between 30Hz legacy samples, ACK/dedup/replay guarantees, key-E origin isolation and backpressure.
- Core 8C must own the session/actor/lease/v2 epoch authority and call commands **atomically in the real server World tick**: a network actor must never supply `Command` values to this bridge; they must come exclusively from Core-authenticated, server-timed `GestureAuthority`. Suppress conflicting legacy LMB inputs for negotiated v2 sessions. Death/rejoin/zone lifecycle and simultaneous RMB/Space/wheel-parry must arbitrate safely.
- UI10 must implement real native W3C browser pointer/blur/capture/RMB+LMB/Space+LMB focus behavior and should never claim instant damage from local sound/animation or user timestamps. C1 Enter/Escape must release game inputs without phantom hit and restore control.
- Original full protected native M-suite, independent two/four-human cross-host acceptance, combined exact SHA with five Silver atlases/24 OGG/four MP3/optional OFF Chat C1, immutable build/stage/rollback and explicit Main release GO remain **unverified**.

**NO direct merge into `main`, no live protocol switch, no deployment, no staging, no removal of native tests.**
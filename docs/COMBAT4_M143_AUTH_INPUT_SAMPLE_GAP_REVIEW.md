# Combat 4 — M143 real browser Space+LMB / 30 Hz v1 input admission gap

**DRAFT / TEST-ONLY / UNACTIVATED.** This is an isolated child of [Combat4 M193 original server-tick test #752](https://github.com/tehki/myaso/pull/752), with **one new original Rust World test file and this review memo only**. Do not change live browser input, original 34-byte v1 protocol, authoritative Combat code, native W3C M143/M144 assertions or original action costs/damage. Main [Pre-Alpha #695](https://github.com/tehki/myaso/issues/695) and [Combat P0 #696](https://github.com/tehki/myaso/issues/696) remain HOLD.

## 1. Real exact-head protected native failure — source of truth

On exact [draft #752](https://github.com/tehki/myaso/pull/752) commit `3836c488a969bf486c0559bde078a2faee7663c0`, protected [full quality #39765622658](https://github.com/tehki/myaso/actions/runs/39765622658) **COMPLETED FAILURE** in `Validate M143 jump recovery FFA focus`, job `119780219108`. The earlier suite of 3/3 original M193 Rust parry-vs-guard tests is local PASS, not a claim that this protected gate passed.

Actual authenticated three-browser W3C scenario `uijumprecoveryffa`:
- Chrome #1 attacked from pre-aimed x=0.314, with one true pointerDOWN at epoch `1792667386027`, one Space keyDOWN `1792667386028` (1ms delta), both corresponding UPs at `1792667386189` (~161–162ms down); no synthesized DOM event.
- Chrome #1 authoritative `ownActionTransitions` remained `Idle (0)` throughout and stamina remained `100`. No observed server action states `JumpAttackWindup(16) → JumpAttackActive(17) → JumpAttackRecovery(18)`; no remotely observed recovery.
- Firefox observer #2 was staged to `NEAREST #3`; its focus transitions after baseline were **empty**, no genuine `PUNISH TARGET #1` interval. Chrome2 #3 moved with genuine KeyA and remained Idle. All actor HP/guard remained 100.
- Therefore M143 legitimately fails. Do NOT cosmetically change HUD selection or lower W3C exact event and server action thresholds. **The native log does not itself show whether the later real 30Hz INPUT datagram was missed, stale, rejected or misclassified.**

### Important read-only trace gap — verified source, NOT packet-loss proof

`web/online-game.mjs::simulatePrediction` already provides read-only M336 transmission logging:
`lastSubmittedClientTick`, `lastSubmittedAtEpochMs`, and an at-most-32 `inputSubmissions` ring recording `clientTick`, `attack`, `jump`, `heavyAttack`, but that instrumentation is enabled **only for `uimultirecoveryspatial`**, **NOT `uijumprecoveryffa`**. Consequently the M143 JSON's empty inputSubmissions and null latest submitted tick indicate **no eligible instrumentation**, and CANNOT be used to infer no input packet was sent.

A local read-only *fail-first source check* proved this missing eligibility (one red test / one existing native-strictness control green) but the attempted source edit to extend scenario-only logging was blocked and **was not committed, pushed, or included in this test-only PR**. UI10 owns any permitted extension with identical input bytes/timing and must qualify separate exact-head native W3C gate. Do not retry or bypass security blocks. Core8A can correlate source-owned admitted session/tick and Core8C per-actor epoch if a true missing/late edge is established.

## 2. Four new genuine Rust World characterization tests

`server/tests/prealpha_m143_legacy_chord_sample_boundary.rs` uses **only actual original `World::set_input`, 60Hz `World.step()`, real `Action`, original stamina/HP**, never overwrites World fighter HP, fabricates a jump action, or simulates a QUIC connection:
1. Valid single **admitted** current v1 sample with both Space (`jump`) and LMB (`attack`) edges (and original charge boolean) starts **JumpAttackWindup(16)** and spends genuine stamina **100→74** immediately. Normal real World arbitration is not globally broken.
2. A first **admitted** LMB button-held sample without Space starts original `HeavyAttackWindup(9)`; if the next actual **admitted** v1 sample carries `jump=true, attack=true, heavy=false`, original World correctly transitions to `JumpAttackWindup(16)` and spends 26 stamina.
3. If the first LMB-only sample arrives but the *subsequent* true jump+attack sample **does not reach World**, and only a neutral sample is observed, the original held-charge action **cancels back to Idle**, stamina remains100, target HP100 and no phantom hit. This is a **counterfactual missing-input fixture**, not captured QUIC loss evidence.
4. If no attack sample ever reaches the authoritative World, it idles at 100 stamina with no Combat events; identical basic server state is not a unique fingerprint of why M143 failed.

**Local source-focused test: 4/4 PASS.** Complete combined 591 Node, locked Rust, strict Clippy and fmt must still qualify on this branch; final exact-head protected original M143 cannot be inferred from source-unit tests.

## 3. Required cross-owner next milestone

1. UI10 enables **read-only, M143-only** sample logging in the actual 30Hz sender and collects genuine `jump`/`attack`/`heavyAttack` submission fields with monotonic `clientTick`, plus actual native Space/LMB events. Do not inject/replay extra input or change W3C chord timing.
2. Core8A correlates authenticated arrival and admitted INPUT_ACK to that client tick and actual World turn; Core8C/Combat verify actor identity, server tick, action arbitration and stun/match state. A transmission ACK is **not** proof World applied a jump.
3. Same-source real Chrome+Firefox 3-browser M143 and existing M144/M136 strictly prove exact jump16→17→18, genuine one chord and recovery focus **NEAREST #3→PUNISH #1→NEAREST #3**. Then run protected full quality on the exact combined head without assertion waivers.
4. The core owner-required instant pointerDOWN light and 320ms held release heavy remain **outside unnegotiated v1**; canonical authenticated versioned gesture issue [#723](https://github.com/tehki/myaso/issues/723) and real v2 gameplay still required. Do NOT broaden or enable that wire in this diagnostic.

NO merge to main, v2 admission, public listener, deployment, staging, server restart or Pre-Alpha GO.

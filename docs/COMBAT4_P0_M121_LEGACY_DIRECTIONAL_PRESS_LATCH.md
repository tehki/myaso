# ⚔️ Combat4 P0 — M121 original left-sweep server provenance diagnostic and minimal fix

**Scope:** Original authoritative arena/legacy v1 short LMB charge, not the future approved LMB v2. Isolated draft child of source-combined Core8A/8C+Combat review [#740](https://github.com/tehki/myaso/pull/740). No DOM event listener, public QUIC protocol, hit range/damage, light windup, heavy timing, parry, graphic atlas, sound, Chat, or native M test assertion changed.

## Precise real native observation, separate from hypothesis

Unchanged-head [PR #737 protected native quality #39724019933](https://github.com/tehki/myaso/actions/runs/39724019933) **FAILED strict M121** on an authenticated Firefox defender. Original Rust World genuinely dealt **34 HP** and Firefox transitioned threat bearing **FROM LEFT** through **HEAVY WINDUP → generic WINDUP → STRIKE**, but failed to show the strict required `LEFT WINDUP/LEFT SWEEP` and `directional-attack-recovery`/Sweep recovery. Original M121 test [`scripts/pvp_browser_flight_runner.mjs`](https://github.com/tehki/myaso/blob/a95ec4636b044c75777cca3e353fd8420efaf4e2/scripts/pvp_browser_flight_runner.mjs) at line ~1645 therefore correctly rejected the incomplete directional state. Not merely absent target HP. It would be inaccurate to claim that failure was caused by the dormant v2 source fence. This branch investigates **one independently reproducible v1 server-state mechanism** that can explain a heavy→generic-light progression; causation to that original native run remains to be proven on this new head.

Current v1 source starts charging whenever simultaneous `input.attack && input.heavy_attack` is sampled at attack press. If it is released **before server 320ms READY**, the existing fallback chooses one ordinary/directional 34HP light using the **release input's latest movement**. Real browser W3C strafe/short click events cross asynchronous input 30Hz snapshots: strafe direction can become neutral between original press and release sample, making the originally left/right-sweep gesture return to generic light while still scoring 34 HP.

## Fail-first original authoritative World proof

Added `server/tests/prealpha_m121_legacy_directional_charge_latch.rs`, using only actual `World::set_input`, 60Hz `World.step()` and original `CombatEvent::Hit`. On unchanged source, **3 of 5 initial regressions failed**:
- Original LMB charge with **left strafe at press** and neutral release became `AttackWindup`, expected `AttackLeftWindup`.
- Same with **right strafe at press** became generic, expected `AttackRightWindup`.
- **Neutral press**, new left strafe only on release, incorrectly invented `AttackLeftWindup`.
- Original canceled charge and genuine original 34HP damage tests already passed.

The minimal correction retains **one private `Fighter::legacy_charge_press_lateral: f32`**, set only on authenticated legacy World-observed held LMB press, or derived from already started left/right light on the existing legitimate upgrade path. On early release, `begin_light_attack` uses that immutable original strafe direction rather than later release movement. `Fighter::set_action` clears it when exiting heavy windup, including cancellation/death/respawn, with no remote client claim. Legitimate heavy READY still waits for release (existing 320ms), original 135ms directional windup and **34/46 HP** unchanged. Dormant v2 gesture-owned light operates as before, and source1 KeyE still rejected pending Main #723.

After minimum change, extended to **8/8 Rust tests PASS** including a real full server-owned **AttackLeftWindup → AttackLeftActive → AttackLeftRecovery** phase sequence with one real 34 HP target 100→66, a legitimate lateral-light→held-upgrade→early-release retaining the original left side, and fully charged original one 46HP heavy on release. Local isolated Serj validation: complete **591/591 Node PASS**, full locked Cargo Rust including existing QUIC/WebTransport PASS, strict all-target Clippy `-D warnings` and Rustfmt PASS. Exact-head GitHub protected native M121 has not yet been qualified.

## Strict release caveat

This is a deterministic original World fix for a *press vs release directional commitment ambiguity*, not a demonstrated cure of genuine W3C M121 across Chrome+Firefox until the exact-head protected run completes. Do not weaken `LEFT WINDUP/LEFT SWEEP`, punish recovery, HP, or actual pointer/strafe requirements. Preserve the original strict M121 and all M144/M145/M155/M156/M172/M173. The broader owner-critical instant **pointerDOWN** light and release-only **held READY** heavy require authenticated v2 Event0x11/Ack0x12, Core8A reliable sender, Core8C real-world session lease/death/reset checks, UI10 true native input replacement and Main release GO; all remain *unactivated*. No merge to main, staging, deployment, service restart or public feature toggle.

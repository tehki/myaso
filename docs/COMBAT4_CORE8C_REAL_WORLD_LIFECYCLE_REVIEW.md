# ⚔️ Combat4 × Core8C — Pre-Alpha P0 real World lifecycle/HP review

**DRAFT / default-OFF / no runtime hook.** This isolated source branch combines the earlier Combat4/UI10/Core8A replay-to-original-World review [#737](https://github.com/tehki/myaso/pull/737), including genuine single-hit 34/46HP and review-only KeyE source separation, with the original complete authored commits from Core8C [#733](https://github.com/tehki/myaso/pull/733). All upstream authored Core8C source is reused unchanged; new Combat4 contribution is one integration-test file plus this precise acceptance and release-limits memo.

## Test-owned World lock / lease verification

The 5 test cases in `server/tests/prealpha_combat_core8c_lifecycle_hit_proof.rs` feed **actual Core8C** `ReviewWorldLease` with a *fixture-owned* admitted identity, preserve **actual Core8A** ingress ordering, then drain typed 16-byte Combat4 `0x11` events and apply only source-owned `GestureAuthority` commands on the real original authoritative Rust `World` / `World.step()`.

1. Same-simulation-tick PRESS/RELEASE is admitted and drained in order; immediately starts a server `AttackWindup`, not an HP decrement. The original server collider resolves exactly **one 34HP hit** to a real victim from 100 to 66 HP; replayed terminal RELEASE carries no new intent.
2. PRESS followed by ~67ms trusted World time and still-unlanded UPGRADE reaches server-ready **320ms**, holds indefinitely without an HP HIT; matching RELEASE produces exactly **one 46HP hit**, victim 100→54. Diagnostic `clientTick=u32::MAX` is deliberately irrelevant.
3. Valid v2 held state before explicit server-side actor removal/rejoin: Core8C review lease retires, stale RELEASE no longer drains; reused network actor ID is Idle and cannot commit an old heavy. Victim HP stays 100.
4. After a gap of two authentic `World.step()` ticks with unobserved lifecycle, Core8C fails closed and discards a queued PRESS; no light/hit.
5. Wrong source actor generation is STALE, cannot drain or alter the original World/HP.

Test results must be paired with inherited Core8C original real World lifecycle tests, including original CombatEvent::Death and real five-kill FFA match-over retirement; none require changing production game code.

## Source ownership and unsolved gates

Original review `server/src/prealpha_core8c_world_lease_review.rs` is NOT an authenticated WebTransport admission path and does not own a real server lock. These tests are a single-process harness, with no real browser WebDriver peers or actual in-flight connection shutdown/rejoin. True **single authoritative World tick lock** and actor generation/zone/match epoch, network ACK delivery, congestion/reorder/retry, atomic v1 vs v2 attack ownership and actual DOM-to-server pointerDOWN replacement remain Core8A/Core8C/UI10/Main integration work.

Core8A [one-wire candidate #727](https://github.com/tehki/myaso/pull/727) proposes a single 16-byte `0x11` EVENT / `0x12` ACK family with future source byte3 `1=KeyE`; Combat4's [source fence #737](https://github.com/tehki/myaso/pull/737) conditionally supports independent KeyE identity, without authorizing the current codec to accept source=1. Competing `0x52` envelope remains incompatible and rejected; do not let a client-supplied epoch prove authenticity. Formal Main single-wire decision [#723](https://github.com/tehki/myaso/issues/723) not yet finalized.

**Release blockers:** full protected exact-head browser test gate, original M121/M144/M145/M155/M156/M172/M173 and remainder without waiver, independently controlled 2–4 real Chrome/Firefox human hosts, actual server-side instant LMB light and held-release heavy, C1 chat Enter/Escape focus, authored original Silver animation + R4 sound, immutable stage+rollback + explicit Main GO. None are achieved by these review-only tests. In particular, parent [#737 protected run #39724019933](https://github.com/tehki/myaso/actions/runs/39724019933) is **RED at original native M121 directional-light cue acceptance** even though the real 34HP hit and FROM LEFT cue were recorded; this may be an unrelated native timeline gap and must not be waived or mislabeled green.

**DRAFT ONLY. No main merge, actual gameplay v2 switch, deployment, service restart, release or staging.**

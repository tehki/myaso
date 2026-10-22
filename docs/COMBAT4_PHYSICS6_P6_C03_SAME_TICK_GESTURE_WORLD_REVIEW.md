# Combat 4 × Physics 6 — same authoritative four-fighter hit-tick clearance

**Review-only, pre-Alpha draft.** Direct child of Combat4/Core8C [#783](https://github.com/tehki/myaso/pull/783) exact source `34267d853e5009002114373e711e378a87fe71df`, which achieved original [complete protected quality 165/165 SUCCESS](https://github.com/tehki/myaso/actions/runs/39791361196). All new child-head protected gate results must qualify independently.

## Scope and source integrity

Combined six ORIGINAL Physics6 owner-authored historical commits for P6-C02/C03 on top of the original Combat4, Core8A, Core8C and UI10 review source. The original P6-C02 commits are `79793f9` (fail-first four-fighter pair-overlap Rust tests), `861bc52` (bounded original four-fighter settle), and `a66a004` (cap extra collision checks for original 512-player cadence). Original P6-C03 commits are `3aedae7` (fail-first post-kick/light four-fighter overlap), `828e418` (original Rustfmt test cleanup), and `34b83db` (the original Physics6 minimal post-knockback settle). All six were **cherry-picked without code/source conflicts**, retaining authorship and the original Combat4 legacy LMB directional press fence, review-only LMB gesture bridge and World/HP server truth. No Main integration [#784](https://github.com/tehki/myaso/pull/784) code or CI status is silently claimed or overwritten.

Physics6 fix changes `World::step_by_into`: after actual server `resolve_attacks` displaced a victim with a real kick or damaging hit, run the already existing bounded pair-separation solver again before the authoritative tick completes and before publishing positions. Zero extra pair sweep on non-hit ticks. All original 135ms light, 320ms heavy, 125ms parry, 240ms block, kick non-HP damage, 34/46 hit damage and world input/wire contracts unchanged. No synthetic client, forged CombatEvent, new QUIC network type, live v2, gameplay flag, browser/CI assertion relaxation or main merge.

## Strict fail-first then fix, combined real World

After genuine original P6-C02 had passed **both older Rust four-fighter tests**, the original source fail-first P6-C03 **FAILED two new tests on this same Combat4 stack** before importing the original narrow fix:
1. Actual real **kick** on tick18 knocked victim #2 to position **(306,200)**, exact same as bystander #3 **(306,200)**, distance **0**, violating required 36-unit diameter, although kick is non-damaging.
2. Actual real 34HP **light** hit on tick27 displaced victim #2 to **(290,200)** while bystander #3 remained **(308,200)**, distance **18** versus required **36**, with actual victim HP66.

Cherry-picked original Physics6 `34b83db` unchanged on combined source. Exact tests then **4/4 PASS** for full server completed-tick four-person crowd/wall/kick/light, preserving original collision target. The fix is not a new Combat hypothesis; it is the original Physics department source, verified on the same combined World.

## NEW genuine Combat4 gesture/Physics6 cross-contract

Added `server/tests/prealpha_combat4_physics_p6_c03_gesture_knockback.rs`, two real `World.step()` original authoritative hit/collider tests (not live gameplay QUIC):
- Four actual World fighters actor IDs 1/2/3/4 positioned at x200/272/308/344. Original **dormant review-owned** `Command::BeginLightWindup` immediately enters original real light 135ms; exactly **one original real 34HP Hit** for victim2 **100→66**. On the EXACT actual hit tick, every one of six fighter pairs is at least **36 units** apart (±0.01 float tolerance), bystanders3/4 retain 100 HP. Damage is from original real CombatEvent, never a test-written HP field.
- Same actors, real review-only light upgraded legitimately before 135ms with **actual trusted World elapsed time**, then held server-heavy at original **320ms READY** for dozens of real `World.step()` without ANY hit before release. A single accepted `Command::ReleaseHeavy` causes exactly **one original 46HP Hit** victim2 **100→54**, and all six genuine fighter pairs are separated on that same hit tick, bystanders HP100. This guards against delayed collision settlement and premature auto-heavy, while NEVER implying client v2 event/source authentication.

New combined test **2/2 PASS** after original Physics6 code import. Inherited true P6-C03 Rust tests **4/4 PASS**, original inherited Combat4/Core8A/Core8C server-action/HP and genuine original v1 four-client pinned QUIC source tests remain.

## Explicit blockers / handoff

These are genuine server simulation units in one process, **not** a real pinned 4-client QUIC session delivering proposed v2 gesture bytes. Original Core8C real QUIC still only admits legacy v1. Additional unchanged native 4-browser actual kick/light hit and 36u same-tick raw source-position assertions (rather than quantized replica) remain a separate **Physics6 / Core8C / UI10** browser acceptance and profiling gate. Running bounded extra O(players^2) pairs under actual hit-heavy 512-player load must also be independently profiled, and the original P6-C03 Main #784 and Physics6 #776 native integrated quality cannot be inherited.

Main's [#723](https://github.com/tehki/myaso/issues/723) unfinalized one actual authenticated 0x11 EVENT/0x12 ACK with explicit source0 LMB/source1 standalone KeyE must be formally decided before any negotiated runtime wiring. Core8A signed/bounded reliable outbox + Core8C session generation, lease and same World lock + Combat one real 34HP instant pointerDOWN and 46HP 320ms READY release-only strike + UI10 native Chrome/Firefox 2–4 independent human hosts, original Silver/R4/Chat default-OFF, strict all original protected Combat gates, immutable stage+rollback and Main/owner GO remain.

**DRAFT only. No main merge, v2 QUIC activation, public listener, staging, deployment, server restart, physics acceptance waiver or Combat release.**

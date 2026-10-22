# Combat 4 — draft typed KEY_E(source1) versus LMB(source0) World acceptance

**DRAFT / review-only.** Main Reserve's current [draft byte layout decision](https://github.com/tehki/myaso/issues/723#issuecomment-6344860886), created on October 22, 2026, selects `0x11` 16-byte EVENT / `0x12` 16-byte ACK as the single v2 design family. This Combat4 document is acceptance guidance, NOT final multi-department ABI sign-off or live v2 admission.

This test branch is a child of [Combat4 × Physics6 #793](https://github.com/tehki/myaso/pull/793) exact `c2c35af373b083d20e6a3950a448d617559d4976`. Parent protected [#39798132885](https://github.com/tehki/myaso/actions/runs/39798132885) **FAILED the original strict M143 genuine Chrome+Firefox jump/focus acceptance**; do NOT inherit previous upstream [#783 165/165 green](https://github.com/tehki/myaso/actions/runs/39791361196) or imply native input proof from local Rust.

## Main-approved draft ABI (not a deployed packet)

All fields little-endian:
- EVENT bytes `[0]=2,[1]=0x11,[2]=action PRESS1/UPGRADE2/RELEASE3/CANCEL4,[3]=source 0 LMB / 1 KEY_E,[4:8]=nonzero shared per-lease u32 sequence,[8:12]=nonzero shared per-lease gesture ID,[12:16]=diagnostic-only clientTick`.
- ACK bytes `[0]=2,[1]=0x12,[2]=status1/2/3/4,[3]=reserved ZERO,[4:8]=matching event seq,[8:12]=gesture ID,[12:16]=trusted World serverTick`. ACK = receipt, never attack, HIT, HP or auth claim.
- LMB source0: PRESS starts genuine **135ms light** at the server, at most one UPGRADE while still unlanded; heavy READY at genuine server **320ms**, indefinitely HELD until **matching RELEASE**; then at most one actual **46HP** heavy. Otherwise exactly one 34HP light or valid zero-hit cancel.
- KEY_E source1: PRESS starts one independent standalone original heavy if server state eligible, with normal windup and **one** genuine 46HP hit even if KeyE keyUP immediately. KEY_E RELEASE/CANCEL is only lifecycle/anti-stuck and must NEVER invoke additional heavy or release LMB-owned READY. KEY_E UPGRADE invalid. No source2+ accepted. Concurrent LMB and E require deterministic Combat arbitration rather than silently reinterpreting both as one legacy v1 charge.
- **Cross-owner**: Core8A owns true JS+Rust codecs, LMB/KeyE unified allocator/outbox, source pairing and golden vectors; Core8C authenticates connection/actor-life-generation and same World lock, including actor ID ABA death/rejoin; UI10 captures actual keyboard/pointer focus and no duplicates; Combat4 owns actual server action/hit once and recovery arbitration.

## New original World tests (not a source-tagged event stream)

`server/tests/prealpha_combat4_keye_lmb_source_arbitration_review.rs` is deliberately written against **existing** `World::set_input(heavy_attack)` for the historical standalone KeyE analog, and existing **dormant** `World::apply_review_only_lmb_gesture_command` for source0 LMB. It does **NOT** claim actual typed source1 byte decoding, trusted browser origin, QUIC dispatch or global cross-source event sequence. All damage/HP assertions come only from original `World.step()` `CombatEvent::Hit`; no fabricated hits, direct fighter HP writes, World actor spoof or synthetic tick progression.

Six genuine original World test results:
1. KeyE original heavy input PRESS then immediate keyUP: original single 46HP hit actor2 **100→54**, never fires again on keyUP.
2. KeyE held constantly across 170 genuine World ticks: exactly one 46HP hit, **no repeat based on a held Boolean**.
3. KeyE enters during a genuine source0 34HP light attack's ACTIVE/RECOVERY: no late 46HP queued after light recovery, victim remains **66HP**.
4. Source0 LMB Press while original independent KeyE heavy windup exists: original World rejects new LMB light, KeyE still gives only 46HP, no light after recovery.
5. Source0 light legitimately UPGRADED before 135ms and sits at true server 320ms READY indefinitely. KeyE press+release while source0 READY neither activates that heavy nor hits anything; only original source0 `ReleaseHeavy` causes exactly one original **46HP**, no early light.
6. Source0 live unlanded light encounters separate KeyE pressed during 135ms windup: it does **not** convert LMB to heavy. One and only one original 34HP real light still hits, no late KEY_E heavy.

## Live-wire blockers and negative cross-source checks

The current Rust `server/src/prealpha_lmb_gesture_proposal.rs` and JS proposal codec still enforce `event[3] == 0` and include an old "source1 is Reserved" negative. The current Core8A outbox has one LMB gesture-active state and is not yet a shared typed-source allocator. **No live source1 event can be accepted today**, and this Combat4 test branch does NOT modify those code files, the production 34-byte v1 input, WebTransport or server listener. Core8A must add:
- immutable JS-issued exact new source1 event goldens decoding identically in Rust, original byte3=0 LMB goldens unchanged;
- reject KEY_E UPGRADE, source >=2, ACK byte3 nonzero, 0x52, bad IDs/version, one sequence reused across different sources, stale/duplicate/ABA,
- global shared monotonic sequence **and gesture-ID** allocator per lease, exact max16 gap/replay/cancel/death fences, bounded admission and ACK reception;
- explicit cross-source concurrency including KeyE press while an LMB source0 light or READY heavy exists, no hidden E replay after recovery;
- real actor-owned authenticated QUIC World apply under Core8C's same lock, genuine Chrome/Firefox 2–4 independent human players and real confirmed one 34HP or 46HP HIT without double impact;
- independent M143/M144 W3C Space+LMB read-only input-submission/admission provenance and mandatory M143 16→17→18 recovery/focus, since current #793 head is RED at M143.

**Pre-Alpha status**: source semantics review positive if exact test results pass; typed transport, production integration, cross-source security, strict full protected integrated head, Silver/R4/C1 text default-OFF, stage/rollback and Main/owner GO NOT DONE. Do NOT merge to main, stage, deploy, open public QUIC, restart service, activate v2, weaken tests or claim release ready.

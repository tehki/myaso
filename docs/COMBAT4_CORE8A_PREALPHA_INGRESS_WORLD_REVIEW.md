# Combat 4 × Core 8A — Pre-Alpha P0 review ingress → original World

**DRAFT / unactivated / no authenticated QUIC or browser gameplay claim.** For [Main P0 one-wire #723](https://github.com/tehki/myaso/issues/723) and [Combat P0 #696](https://github.com/tehki/myaso/issues/696). This isolated child reuses entire previously reviewed [UI10/Core8A/Combat4 source integration draft #725](https://github.com/tehki/myaso/pull/725), then cherry-picks all 14 original Core8A [draft #724](https://github.com/tehki/myaso/pull/724) authored commits unmodified into the same source branch (no conflicts), and adds **one new Rust integration test file**. Never merge without avoiding duplicate original Core8A changes when Main consolidates.

## Original trusted-event model → genuine World

`server/tests/prealpha_lmb_ingress_to_real_world_review.rs` tests the actual dormant `ReviewLmbIngress` and `TrustedLeaseKey` shipped as original Core8A source, feeding accepted canonical Combat4 `v2/type0x11` event bytes via the genuine review codec into the original `GestureAuthority` and isolated `World::apply_review_only_lmb_gesture_command`, then running true original 60Hz `World.step()` and collecting actual `CombatEvent::Hit { attacker:1,target:2,damage,hp }`. It never sets fighter HP or constructs a HIT event in the tests. ACK receipts are actual `encode_ack` type `0x12`, and are transport acceptance, **NOT** a damage authorization or a proof the World applied the command.

Six new source-real P0 cases:
1. RELEASE seq2 arrives before PRESS seq1: ingress buffers it with **no ACK**, no combat action; when PRESS arrives it releases two ordered accepted edges at trusted server-time, World begins one true light windup and eventually produces exactly **34 HP** victim100→66 once.
2. PRESS then ~83ms World time then UPGRADE (server within 135ms) then held READY beyond 320ms: no early HP hit; matching RELEASE produces one genuine **46HP** heavy victim100→54; exact duplicate RELEASE returns duplicate ACK and no second attack.
3. An attacker client that sends far-future `clientTick=u32::MAX` with UPGRADE/RELEASE while missing PRESS cannot charge retroactively when PRESS finally fills the sequence gap: batch at a single true server tick resolves **one original 34HP light**, never invented READY or 46HP.
4. Wrong actor generation/nonce fails stale and wrong tentative Core8C `v2/type0x52` bytes rejected with zero World actor/HP changes.
5. Duplicate accepted PRESS yields no second World command; a **mutated** old accepted event with identical sequence/gesture closes ingress, without suppressing the one previously legal 34HP World hit or allowing a second hit.
6. After a held heavy starts, an actor remove/rejoin changes trusted generation+nonce: old RELEASE is stale, new actor idle refuses the old heavy commit, target remains 100HP.

These are review-only tests. Core8C must provide actual QUIC-authenticated actor, session lease and monotonic world epochs. **The fixture API is not authentication.** Actual ingress ACKs and Combat reducer decisions must be atomically sequenced in the same admitted connection/World turn; on a rejected World action an ACK must NOT be portrayed as Combat success. The proposed manual dispatch loop is only test harness, not wired into server main, and the actual legacy v1 34-byte wire still runs unchanged.

## CI, release limits and owner choices

- Source baseline: draft #725 UI10 pointerDown/up source → Core8A bounded outbox → Combat4 v2 bytes/authority and original World true HP tests.
- Core8A original #724 server ingress ordering/nonce/replay model was individually tested on [focused workflow #39721208010](https://github.com/tehki/myaso/actions/runs/39721208010), not yet real admitted QUIC or correct actor lifecycle. This child demonstrates source-level compatibility of all three department artifacts, not live acceptance.
- This new branch must pass the six new Rust tests, inherited 14 ingress Rust + 11 World + 12 reducer + 4 byte-to-World tests, complete locked Cargo incl existing WebTransport, all-target strict Clippy, Rustfmt, complete Node tests and separate exact-head protected Chrome/Firefox quality with all original M gates intact. None can be inferred from parent success.

**Actual missing P0:** One Main-approved canonical wire/ACK/KeyE source and protocol negotiation, authenticated server ingress+client outbox+real reliable byte delivery, Core8C lease/death/rejoin fence, browser UI actual live pointerDown switch replacing v1 (never duplicate handler), independent Chrome/Firefox real server HP/cues with loss/reorder, 2–4 human operators on separate hosts, assembled Silver/R4/C1-off QA, Physics knockback contact clearance, immutable staging+rollback and explicit Main GO. No main merge/deploy/restart/public listener or protected assertion waiver.

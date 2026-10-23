# Core 8A P0 — Source1 KeyE on the negotiated authenticated QUIC→World route

**DRAFT / NONRELEASE.** Direct child of Core 8 #852 (four native QUIC seats), which is stacked on #848 boot/lease identity → #846 retransmission fix → #841 native source0 experiment. Not on protected `main`. No public v2 deployment, server restart, v1 behavior change, second protocol or release GO.

## Exact changed runtime boundary

The already-admitted WebTransport QUIC connection retains exactly one 16-byte canonical `02 11` event / `02 12` ACK family. The existing connection-owned session identity (boot nonce + checked lease + actor + World instance/life) is revalidated under the original `GameState.world` mutex for both LMB source0 and KeyE source1. The typed source is byte3; client tick and actor parameters cannot set server action authority. Both sources now share one per-lease monotonically checked sequence and gesture-ID highwater. An event ahead of a missing sequence gets NO terminal ACK while awaiting the original outbox's retransmission; stale/lower unknown sequence is refused. KeyE UPGRADE is invalid in the existing typed codec.

KeyE PRESS (source1) checks original World actor eligibility and, only if Idle and not blocking/dodging/kicking/jumping/dashing, begins one original `HeavyAttackWindup` of 320ms. Original 60Hz `World.step()` alone produces active/heavy/recovery and genuine 46HP damage on an eligible target. Unlike LMB held charge, KeyE is standalone: release or cancel **cannot create, accelerate, repeat or retroactively cancel** that heavy or release an LMB gesture. KeyE accepted events use a bounded 64-entry duplicate journal; sequence tombstone survives journal eviction within the lease. Cross-source reuse of a gesture ID or sequence does not generate hits.

The existing source0 semantics remain: 135ms light/34HP, same-gesture UPGRADE, server-clock 320ms READY and matching release-only held-heavy/46HP, exactly-once replay and out-of-order RELEASE repair. The original 22/28/34-byte v1 INPUT family remains the default; v1 combat bits are suppressed after explicit loopback-only v2 grant to prevent two attack sources.

## Genuine evidence and limitations

- Rust original `World.step()` tests: source1 KeyE PRESS alone creates **exactly one true 46HP hit**, HP100→54; duplicate PRESS and source1 CANCEL/RELEASE cannot add damage; mixed lease source0 light after recovery hits for 34HP, HP54→20. Future KeyE PRESS reordered before lost earlier source0 PRESS is held without ACK until older event is retransmitted. Foreign boot fails STALE, invalid KeyE UPGRADE fails codec.
- Real native test: original spawned Rust server, genuine pinned QUIC game seat, separate 8-byte negotiation uni-stream plus FIN, real source1 datagrams, **two server ACKs**, real original `M201_AUTH_ACTION` HeavyWindup9→HeavyActive10 exactly once after genuine KeyE PRESS+CANCEL. Previous 4 independently connected native QUIC seats and fifth-seat refusal tests remain intact.
- This is **not** the real UI10 physical KeyE keydown/keyup→shared source0+source1 browser allocator/reliable outbox integration; neither original production page nor remote human principal, multi-zone owner, cross-host four human operators nor full original protected quality is certified by focused Rust/QUIC tests. UI10, Combat4, Core8B, Core8C and Main sign-off remains required.
- The current bounded original sender treats REJECTED as an error; actual native conflict semantics (e.g., simultaneous valid LMB+KeyE PRESS while World busy) need Combat4/UI10 acceptance. No silent rule substitution or forged hit ACK. The cross-source gap fence assumes the canonical shared outbox issues consecutive committed event sequences and retries missing edges. Finite retries/lease retirement remain a client-owner obligation.
- Inherited original prototype-only policy rejecting runtime imports must be consciously reconciled with Main before integration. No assertion/timeout reductions, CI waivers, staging, public port or merge are allowed.

**Classification:** SOURCE-TESTED + NATIVE-VERIFIED in a default-OFF loopback experiment only. **Pre-Alpha HOLD.**

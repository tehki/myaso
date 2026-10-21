# 🌕⚡️🚀 Core 8A and Core 8C — Stale Input Lease Source Integration

DRAFT child of combined rendered Greyhaven [#674](https://github.com/tehki/myaso/pull/674), not merged into main, no deployment.

## Two exact source parents

- First parent [#674](https://github.com/tehki/myaso/pull/674), commit d165642e9006d3905f245c396a6d5980a3728990: four actual Chrome/Firefox browsers with original empty Blacksmith rack, combined Core8A/8C real four-QUIC kill/respawn and postmortem replay regression. Four focused exact-head workflows passed. Its protected [quality #39657415755](https://github.com/tehki/myaso/actions/runs/39657415755) **FAILED true native Combat M194** repeated guard pressure, not waived.
- Second parent [Core8A #673](https://github.com/tehki/myaso/pull/673), commit 8bfdb17093ec33e65e6541aa08825016c2ff7598: real four-browser Blacksmith arrival, Firefox SIGKILL/fresh net ID5 return, and genuine Rust server input lease freshness fix. Eight focused head workflows PASS, but its protected [quality #39657267397](https://github.com/tehki/myaso/actions/runs/39657267397) **FAILED the same Combat M194**, not inherited-green.
- Read-only Git merge-tree returned clean source tree 84f897f7517ce94ba16ed56211eb2578d55bf1db. The actual isolated two-parent source merge had zero textual conflicts and preserved both source parents with no dropped tests.

## Genuine runtime authority correction imported from Core8A

Previously the Rust server renewed a connected fighter's **30-second input inactivity lease** merely after decoding a syntactically valid QUIC datagram. An authorized peer could endlessly resend *already consumed client sample ticks*, increasing the enclosing packet sequence/ACK, and keep a ghost fighter/admission slot alive while authoritative InputIngressWindow accepted zero new gameplay samples.

The imported server/src/main.rs fix retains the exact 30-second limit, cap four, original wire format and gameplay. Lease renewal now occurs only after actual server ingress accepts at least one **fresh gameplay sample tick**. The Rust regression tests actual decoding, replayed ticks with changing transport envelope, new legitimate ticks, and u32 tick wrap. This is a *real Core8A production runtime fix imported into a DRAFT source integration*, not a new Core8C implementation.

Core8C's complementary four-QUIC tests exercise **gameplay-level** replay protection: in-range heavy input from a Dead fighter causes no damage, replayed identical bytes after respawn remain inert, reenveloping the old sample tick in a new packet also remains inert, while fresh attack after authentic respawn executes 46HP damage on all four genuine independent peers. These tests do not alone prove a correct inactivity lease.

## Exact merged-local validation

- Entire Rust server regression suite PASS, including all 11 actual WebTransport/QUIC tests, Combat/World tests, and new Core8A lease check. Rustfmt and all-target strict Clippy PASS.
- **29/29** targeted Node source, host-pair, genuine browser planning, original EMPTY rack, Firefox rejoin and replay liveness contracts PASS. Temporary fixture bytes were written to a Core8C-owned writable TMPDIR; no shared cache deletion. Pinned 23-solid immutable Greyhaven geometry checksum PASS.
- Event-path triggers added to the **existing unchanged real Chrome/Firefox rendered Blacksmith walk workflow**, requiring exact combined-head native browser requalification when server ingress lease source changes. No browser assertions or protected tests are removed, mocked or weakened.
- Full original protected quality and all original Core8A 4-browser/rack crash-rejoin, Core8C real-QUIC and combined Core8A8C workflows MUST independently pass on this exact merged head. Previous native M194 failures remain hard release blockers.

## Nonclaims and P0 HOLD

A malicious connected client producing genuinely new ticks can still remain online; this is not cryptographic anti-replay, durable CharacterId identity, persisted gear, or account recovery across server restart. The first-party Blacksmith rack remains **EMPTY**, with no four signed collectible sword ItemIds, canonical MYTX sole writer/atomic MainHand, armed PvP or full World/Physics LOS/epochs. Four real CI browsers on one loopback runner are not two separately operated client PCs with a separately approved private server. No broadening of 127.0.0.1 listener, firewall, database, public host, production runtime deployment, main merge or Combat CI waiver. Main Orchestrator #360 controls promotion; First Playable #480 remains HOLD.

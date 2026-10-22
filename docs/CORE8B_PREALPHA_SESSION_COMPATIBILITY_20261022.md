# Core 8B — Pre-Alpha 0.1 temporary session-ID compatibility

Scope: issue #695, current `main` `6fa59b649112c272bcbc018b4a32bf963f9a5bba`. **No canonical durable identity, account registration, MYTX, PostgreSQL or IDR activated.**

## Source audit and ownership

- `server/src/main.rs`: current Rust WebTransport `/game` admission gives each accepted connection a server-issued `u32` fighter ID, keeps packet ingress, snapshot and ACK state within that connection task, and removes its World fighter after the task exits. Client input packets do not select the fighter ID.
- `server/src/simulation.rs`: `World::set_input` rejects absent fighter IDs and `World::remove_player` deletes the fighter. These are ephemeral arena memberships, **not** durable `CharacterId`s or proof of account authentication. A returning human gets a new ID; character continuity is not promised.
- The old `AtomicU32::fetch_add` allocator wrapped through zero and eventually reused ID 1. This guard reserves zero as a permanently exhausted sentinel, rejects further admissions with a distinct close reason, and tests both last legal IDs, concurrent exhaustion races and repeated exhaustion. Normal-session wire, combat, input timing and respawn behavior are unchanged.
- Chat C1 is optional, tracked separately. Validate its actual sender binding to the admitted connection before integration. The P0 guard introduces no chat ID schema or durable observer knowledge.

## Isolated local verification (Serj Linux, Rust 1.89)

- `cargo test --locked --manifest-path server/Cargo.toml --bin myaso-server core8b_prealpha_session_fencing_tests`: **4/4 PASS**.
- `cargo test --locked --manifest-path server/Cargo.toml`: **188 PASS; no failures** across Rust library, binary, integration, native WebTransport and doc tests.
- `cargo clippy --locked --manifest-path server/Cargo.toml --all-targets -- -D warnings`: **PASS**.
- `cargo fmt --manifest-path server/Cargo.toml -- --check` and `git diff --check`: **PASS**.
- Node and genuine multi-browser protected quality were not run locally. Initial exact-head protected quality #39762095149 on this draft passed Rust and early Combat gates but FAILED mandatory M121 left-sweep native-browser readability (real 34 HP damage and LEFT windup/strike seen, final acceptance incomplete). This failure is preserved and handed to Main/Combat; revised exact-head CI remains required. An initial full cargo attempt on a sparse checkout lacked shared `tests/fixtures`; including them resolved that setup error. The first cache-free attempt hit an environmental disk quota, resolved by reusing an existing Rust target cache and an isolated local temp directory. Neither error demonstrates a code failure.

## Limits and remaining gates

The unit tests prove no allocation wrap, concurrent uniqueness and refusal of absent fighters even when a late decoded input reaches the World path. They also explicitly show that a transport input ACK can be queued without successful World action authorization. They do **not** constitute native Chrome/Firefox two/four-human reconnect, kill/death/respawn, persistent authentication, long-lived multi-host session lease, crash recovery, gameplay HIT proof or complete Pre-Alpha acceptance. #695 retains all Core 8A/8C, Combat4 and Main gates. A network fighter ID must never be interpreted as `CharacterId(u128)` or a persistent item ownership principal. An input transport ACK is not gameplay HIT or durable item commit.

Core 8A owns WebTransport transport/admission, Core 8C owns World membership/authority, Combat4 owns death/respawn and action validity, and Core 8B owns the future durable identity/generation contract. Shared contract and migration decisions stay in #405 and #432; IDR #653 remains OFF. No production migration, main merge, new login, item ledger, listener change or deployment is requested.

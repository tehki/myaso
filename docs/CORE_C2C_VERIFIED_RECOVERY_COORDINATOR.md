# Core C2c — dormant verified-identity recovery coordinator

Base: Core C2b [PR #369](https://github.com/tehki/myaso/pull/369); in turn
stacked on Core C2a [PR #365](https://github.com/tehki/myaso/pull/365).
This change is **not** live login, authenticated production identity, online
reconnect or production deployment.

## Purpose

`server/src/character_recovery.rs` composes the dormant C2a character/session
primitives with the dormant C2b single-writer durable record store:

1. A *server-installed* `TrustedIdentityVerifier` must authenticate the claim
   and resolve the exact owned `CharacterId`. No arbitrary client-provided
   character identifier is a credential.
2. A connection already bound to another live character is rejected **before**
   consuming a new durable generation.
3. The coordinator loads the exact already-provisioned character record;
   **login never auto-provisions** characters.
4. The store commits the next generation before a session lease is activated.
   On failure/uncertainty it returns no lease; callers must re-authenticate
   and reload to recover.
5. Current-session checks reject old connections after authenticated takeover.
   A delayed disconnect of a superseded lease cannot evict the new connection.
6. After restart a new successful verified login consumes another epoch, so
   sessions from the old process cannot be authorized by the new registry.

The in-repo verifier is only a deterministic unit-test mock and is **not** a
real account system, authorization implementation or production provider.

## Local proof tests

A self-contained Rust 1.89 test harness compiling `identity.rs`,
`character_store.rs` and `character_recovery.rs` passed **17 / 17** tests,
including six coordinator-specific tests:

- Authorized takeover and delayed disconnect fencing.
- Rejected credentials and missing characters do not create characters.
- Connection reuse is blocked before a second character's epoch is spent.
- Persisted generation is recovered and advanced following process restart.
- Crash after a committed generation but before activation uses a newer epoch.
- Invalid durable records never produce a live lease.

Run the following on the branch for normal CI acceptance:

```bash
cargo fmt --manifest-path server/Cargo.toml -- --check
cargo test --locked --manifest-path server/Cargo.toml character_recovery::
cargo test --locked --manifest-path server/Cargo.toml --lib
```

Full exact-head GitHub `quality` remains mandatory, including the unrelated
combat and browser regression suites. An isolated module test is not a
substitute for full integration tests or production security review.

## Mandatory integration and security blockers

- **Verified account ownership:** implement actual issuer/session verification,
  signed claim integrity, short-lived nonces, expiry, replay prevention,
  account-to-character mapping, logout/revocation and compromised-device
  handling. Never accept mock login claims on live endpoints.
- **Distributed authority:** replace the local single-writer file store with
  a transactional durable database or verifiable cross-host compare-and-swap
  authority before running more than one game worker per character.
- **Atomic character/world restore:** bind the new lease to server-authoritative
  world state, items, corpse, housing and economic records without duplicating
  ownership or rolling back transactions on crashes.
- **Hot-path fencing:** check lease generation on every accepted state-changing
  input and mutation; rejected/stale clients must not mutate game state.
- **Async isolation:** storage reads, writes, fsyncs and verifications must not
  run on the 60 Hz combat simulation clock.
- **Crash and race acceptance:** exercise process termination before/after
  commit and before/after ACK, concurrent worker handoff, duplicate login,
  lease expiry, store loss and rollback/replay under real browser clients.
- **Operational review:** protected permissions, migration and backups,
  monitoring, rate limiting, abuse prevention and staged rollout.

Externally visible denial must be generic: never reveal which character
exists, whose claim failed, or which storage corruption was detected. Internal
errors may be logged without credential contents.

## Release boundary

No live auth credentials, WebTransport protocol, game-session reconnect,
crypto wallet, economy, combat rules, multiplayer capacity target, deployment
config or production game runtime changes are enabled by this PR. Only the
Development Center can approve integration, merging and deployment.

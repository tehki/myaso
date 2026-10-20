# Core C2b — dormant durable character record storage

Base: Core C2a [PR #365](https://github.com/tehki/myaso/pull/365), not `main`.
C2b is a **stacked** pull request: merge C2a through the Development Center first.

## Scope

`server/src/character_store.rs` is an inactive, dependency-free, synchronous
local-file implementation of **only the 36-byte character identity record**
introduced by C2a. It does not save inventory, character positions, spell
progression, currency, house ownership, corpses, combat or world entities.

- Each trusted server-issued `CharacterId` has a canonical, hex-addressed
  `.mych` record filename. No client-controlled path input.
- New records are staged with `create_new`, written and `sync_all`'d, then
  published with `hard_link` to avoid replacing an existing ID.
- A generation update loads and checks the caller's entire expected record,
  rejects stale state or invalid bytes, stages the successor in the same
  directory, then renames it onto the canonical file and syncs the directory.
- A failed file/directory sync can mean the commit outcome is **uncertain**.
  A caller must fail closed, reload from the canonical file, and must never
  activate a new session on the basis of the failed write.
- Orphan staging files left after interruption are not treated as committed
  records and do not determine generation or ownership.
- Corrupt, truncated, oversized, unsupported-version, zero-ID and wrong-ID
  records are rejected without substituting a default character.

## Persistence and concurrency invariants

The store expects a **single trusted writer per local directory** and a
filesystem supporting atomic same-directory rename, hard links, and durable
file/directory sync. It offers no distributed CAS or lock, so a second writer
racing a generation update can violate exclusivity.

This is a Linux/local-filesystem research foundation, not permission to
activate persistence on shared storage or to run multiple authorities against
the same character. If directory sync is unsupported, operations return an
error rather than claiming a confirmed commit.

An operator must provision the directory and its permissions outside the game.
`open` does not securely establish private ownership or detect hostile
symlink manipulation; the store must not be pointed at an untrusted directory.
Record checksums detect accidental corruption only, not malicious tampering.

## Tests

The module's deterministic Rust tests cover:

- Create, advance twice, drop/reopen, and recover the exact generation.
- Duplicate identity provisioning failure.
- Stale-generation failure after a committed update, including a second
  handle's sequential stale attempt.
- Missing, wrong-ID, truncated and oversized records fail closed.
- Orphan stage files are ignored during recovery.
- Two independently named identities do not share state.

Acceptance for this branch:

```bash
cargo fmt --manifest-path server/Cargo.toml -- --check
cargo test --locked --manifest-path server/Cargo.toml character_store::
cargo test --locked --manifest-path server/Cargo.toml --lib
```

Run exact-head `quality` GitHub CI and preserve existing combat/WebTransport
regression checks.

## Remaining mandatory blockers

1. **Authenticated ownership:** a trusted identity provider binds login to
   immutable `CharacterId`. No browser-provided ID is authoritative.
2. **Multi-writer exclusivity:** database transaction or equivalent strong
   cross-worker CAS, with committed generation fencing on every world-changing
   operation. Do not use this single-writer file store for multi-host writes.
3. **Durable world state:** versioned snapshots or transactional event log
   for player position, inventory, corpses, ground items, deeds and economy.
4. **Real recovery evidence:** fault injection around write, rename, fsync,
   restart, and concurrent character restore with a validated rollback plan.
5. **Async isolation:** all disk I/O must run outside the 60 Hz simulation
   clock and outside hot-path network handlers.
6. **Operational rollout:** filesystem permission checks, storage backups,
   observability, migration, monitoring, explicit rollout gate, and
   Development Center integration approval.

No new client protocol, realtime behavior, login, live wallet, Moon Coin
settlement, server restart, production file write or deployment is activated
by this PR.

# Core C4b — locally durable, OS-locked zone authority (dormant)

Stack base: Core C4a [PR #381](https://github.com/tehki/myaso/pull/381),
itself based on Core C2a [PR #365](https://github.com/tehki/myaso/pull/365).

**Scope boundary:** this is a *one-host, one-writer* durable authority
prototype. It is **not** distributed CAS/consensus, cross-host fencing,
production MMORPG persistence, or permission to activate live zone migration.

## Problem

Core C4a defines one in-process authority lease per character or ground item:
`{entity, worker, zone, epoch}`. Pending handoff denies both source and
destination mutations; commit advances a generation and permanently fences
the earlier owner.

A process restart must not reset an entity's epoch, resurrect retired IDs,
silently abort a prepared handoff or create another owner because a commit
was successful but its acknowledgment was lost.

## C4b implementation

`server/src/durable_zone_authority.rs` uses a dedicated, server-provisioned,
private **local filesystem** directory and a long-held POSIX `flock`
advisory lock to serialize **cooperating local processes**. The narrow Unix
adapter preserves the server's Rust 1.88 minimum supported version; on other
operating systems this prototype refuses to acquire an authority lock. The lock is
explicitly released on normal shutdown and released by the operating system
upon process termination. An independently opened second handle or separate
test process fails closed with `Busy` while a writer is present.

A versioned, fixed 96-byte `MYZA` event records:

- Immutable entity kind (character or ground item) and nonzero ID.
- Owner worker, owner zone, monotonic nonzero authority epoch.
- Exactly one action: **Register, Prepare, Commit, Abort, Retire**.
- For handoffs, immutable target worker/zone and globally unique nonzero
  operation ID.
- Strictly increasing event sequence and corruption-detection checksum.

The checksum uses FNV-1a for accidental damage, **not** authentication.
Record schemas reject invalid magic, versions, reserved bits, zero identities,
noncanonical fields, corrupt data and missing or reordered sequences.

For each transition the implementation clones/validates the in-memory
registry, writes a uniquely named unpublished `.pending-zone-*` file,
synchronizes the file, publishes the canonical sequence with a hard link,
synchronizes the containing directory and **only then** swaps the validated
new state into memory and acknowledges the operation.

If an I/O or sync operation fails, the handle is **poisoned** and denies
further mutations; a committed write might still have happened, so the
operator must recover the canonical state rather than blindly retry on
the old instance.

A restart loads only canonical records in sequence, reconstructs authority
epochs, pending freezes, retired-entity tombstones and used handoff operation
IDs, and verifies that a commit or abort has an exact earlier prepared
transfer. Orphan staging files cannot authorize an entity.

A prepared-but-uncommitted transfer stays **frozen** after restart until a
trusted coordinator explicitly commits or aborts it. A committed transfer
without an ACK is recovered as the new owner; a matching duplicate ACK
returns the original lease without publishing a second event. Reusing
a handoff operation ID for another transfer, even after abort and restart,
fails closed.

## Verified local tests

Using Rust 1.89, an isolated test binary compiling
`identity.rs`, `zone_lease.rs`, and `durable_zone_authority.rs`
passed **26 regular tests** with no failures; the intentionally ignored
child-process helper was separately invoked by its parent test and passed.

New C4b scenarios include:

- Handoff success, restart and permanent stale source fencing.
- Interrupted prepare remains frozen across restart; explicit abort restores
  the old owner without changing its epoch.
- Repeating a committed transfer after restart consumes no new generation.
- Simulated crash after canonical commit publication but before in-memory
  application or ACK: restart restores the new owner exactly once.
- Concurrent local writer denial, including a **separate OS process**.
- Missing, corrupted or out-of-sequence committed records fail closed.
- Orphan staging files are ignored; a commit lacking prepare is refused.
- Destroyed IDs remain retired and cannot be re-registered after restart.
- Conflicting transfers do not publish phantom commits.
- Previously used operation IDs are rejected after abort and restart.
- Unix record files are restricted to owner-only mode 0600.

This is **not** a SIGKILL/power-cut or WAN partition certification; the crash
simulation injects a committed record and restarts the registry.

Required protected CI at each exact feature-branch head:

```bash
cargo fmt --manifest-path server/Cargo.toml -- --check
cargo clippy --manifest-path server/Cargo.toml --all-targets -- -D warnings
cargo test --locked --manifest-path server/Cargo.toml durable_zone_authority::
cargo test --locked --manifest-path server/Cargo.toml --lib
```

The repository's full `quality` workflow also checks the broader
WebTransport, browser/combat, capacity and whitespace regressions.

## Non-negotiable C4c and production gates

1. **Cross-host transactional CAS:** a central transactional SQL database
   with serializable unique entity/version predicates, durable reservation
   records, transaction receipts and a fencing token validated by every
   authoritative worker; or an equivalently reviewed consensus-backed
   state machine. Two VPS nodes with separate journals are **unsafe**.
2. **Worker authentication:** authenticate every service and its authority,
   enforce worker lifetimes and account/session ownership, and never accept
   a client-supplied entity/zone/epoch/operation as trusted authorization.
3. **Real-world hot-path enforcement:** every input, combat hit, physics
   callback, inventory transaction, loot claim, trade, portal action and
   snapshot must verify the current committed lease/epoch. None do so yet.
4. **Atomic world handoff:** durable character/item state, inventory,
   cooldowns, ground/corpse physical entities and outbound replication
   lifecycle must follow one transition with a replay-safe outbox/ACK path.
5. **Failure and partition acceptance:** independent workers across actual
   network isolation, duplicate claims, source SIGKILL, target restart,
   commit/ACK loss, disk exhaustion, fsync failure, backup/restore and
   rollback scenarios must maintain one globally valid writer.
6. **Storage hygiene:** no hostile processes, symlinks, NFS or unsupported
   filesystems in the trusted directory; file/directory sync guarantees
   must be tested. Provide access controls, backups, schema migrations,
   observability, compaction and disk quotas.
7. **Performance:** C4b clones its in-memory registry for every event
   and retains all historical records/used IDs. It is **not suitable** for
   a large 60 Hz MMO hot path. Replace with indexed transactional storage
   and measure p99 latency/throughput before activation.
8. **Integration discipline:** coordinate with World & Gameplay, Magic &
   Items, Economics and the Development Center. No independent-network
   multiplayer acceptance claim is made by same-host process tests.

## Release boundary

Dormant code only. No WebTransport protocol, game server login, world
simulation, live portal/ground transfers, economy, real Moon Coin/MOCMP
settlement, production file writes, VPS restart, deployment or `main`
change is authorized or performed by this PR.

**Never merge the stacked branch or activate C4b without Development Center
review and all protected exact-head CI checks.**

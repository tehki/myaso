# Core C4a — epoch-fenced zone authority (dormant)

Base: Core C2a identity foundation [PR #365](https://github.com/tehki/myaso/pull/365).
Existing `server/src/zone.rs` remains unchanged. C4a is a separate,
**in-process and inactive** reference contract; it does not enable cross-worker
transfer, persistent world state, portal teleportation or live multiplayer
migration.

## Motivation and invariants

Characters, physical ground items and their mutations must have **exactly one
active zone authority** at a time. A late source worker must not write a
position or recreate an item after a destination takes ownership. Duplicate
client inputs, retrying a transfer, or a delayed disconnect must not undo a
later committed authority epoch.

`server/src/zone_lease.rs` provides:

- A typed key `OwnedEntity::Character(CharacterId)` or
  `OwnedEntity::GroundItem(NonZeroU128)`, so numerically identical character
  and item IDs never collide.
- Server-internal `WorkerId` and `ZoneKey` types with nonzero IDs.
- `AuthorityLease` carrying the entity, owner worker, owner zone and a
  strictly monotonic `u64` authority epoch.
- A **single slot per entity** within `ZoneLeaseRegistry`. Registration of
  an existing entity fails closed; retirement leaves a tombstone, so a
  delayed request cannot resurrect the same ID.
- `can_mutate(lease)` is only true for the exact current owner and epoch
  when **no handoff is pending**. This method must gate every eventual
  state-changing gameplay operation, including inventory, loot, movement,
  combat and world replication.
- `prepare(source, target, transaction_id)` validates the exact current
  source and potential epoch increment, and **freezes both sides** by setting
  a pending handoff without changing the current owner.
- Identical prepare retries return the same ticket; a conflicting use of
  the same transaction ID is rejected; a different handoff during pending
  is rejected.
- `commit(ticket)` updates worker, zone and epoch as a single in-memory
  transition, invalidating the source lease; repeating the most recent
  exact commit is idempotent while its result remains current.
- `abort(ticket)` resumes the original owner only while the exact
  prepare is still pending; late aborts and late commits cannot undo a
  successor.
- Epoch exhaustion is checked *before freezing* and cannot silently wrap.

## Critical trust boundary

**This is not distributed exclusivity.** A `BTreeMap` in one process cannot
detect another server with its own `BTreeMap`. Tests using a mutex prove
serialization within one shared registry only.

Most importantly, the API's commit and abort methods deliberately implement
the *state transition* in one registry; they do **not** verify a durable
transaction or trusted worker message. They must not be called from a live
network endpoint until an external, authoritative transactional coordinator
has proven which action has durably committed.

The source remains the nominal current owner during prepare, but
`can_mutate` denies **every worker**, including the nominal source. The
destination must not spawn an active entity or admit its gameplay inputs
until after successful durable commit and restored state.

## Verified isolated test coverage

A local Rust 1.89 test harness compiled `identity.rs` and `zone_lease.rs`
with **14/14 passing tests** (9 new C4a-specific tests):

- Nonzero typed IDs; distinct character/item namespace.
- Prepare freezes writes, commit advances epoch and invalidates source.
- Exact prepare retry, different transaction conflict, abort recovery.
- Delayed commit/abort/replay cannot reverse a successor.
- Retired ground item ID cannot be re-registered.
- Retirement refused while transfer is prepared; stale lease denied.
- Epoch overflow fails without freezing/mutating.
- 512 distinct character authority leases, half migrated to another worker,
  with no stale source authorization.
- Two real OS threads racing under **one mutex-owned registry** produce
  exactly one prepared transfer.

Full protected exact-head CI is separately required:

```bash
cargo fmt --manifest-path server/Cargo.toml -- --check
cargo test --locked --manifest-path server/Cargo.toml zone_lease::
cargo test --locked --manifest-path server/Cargo.toml --lib
```

## Non-negotiable activation gates for C4b and beyond

1. **Global CAS and durable owner epochs.** Create a single transactional
   service/database with unique entity keys and version predicates, durable
   operation IDs, prepared transaction outcomes, and worker fencing. Two
   independent workers must be unable to claim one item even if each loses
   contact with the other.
2. **Crash and partition behavior.** Establish precise recovery for a crash
   after prepare, after commit/before ACK, target startup, source timeout,
   and network split; never treat an unknown outcome as an aborted transfer.
3. **Fencing in the actual world loop.** Validate lease epochs for all
   world-changing actions, including delayed inputs, server timer callbacks,
   dead players, item trades, corpses and economic mutation. No permission
   checks are wired in this milestone.
4. **Atomic world transfer.** Serialize/restore player authoritative
   position, action state, movement cooldowns, hitbox, equipment, inventory,
   corpses, ground item entity lifecycle and interest-management ownership.
   A transition cannot create a second simulation of the same entity.
5. **Trusted worker identity.** Authenticate worker services and authorize
   character/session/zone ownership; forbid client-supplied worker, zone,
   epoch or transfer IDs from being treated as trusted.
6. **Scale and observability.** Benchmark concurrent area transfers and
   failovers, journal/database growth, tick p99, memory, snapshot/reset
   correctness and egress; reuse M8 laboratory probes but do not call them
   verified production capacity.
7. **Cross-department consistency.** Coordinate with World & Gameplay,
   Magic & Items and Economics on physical ground entities, full-loot and
   monetary invariants. C4a touches none of those live systems.

## Release boundary

No changes to `main`, production VPS, server deployment, login, WebTransport
packet format, live zone assignments, item mint/burn, wallets or Moon Coin
settlement. The Moon Games Development Center alone owns integration and
release approval.

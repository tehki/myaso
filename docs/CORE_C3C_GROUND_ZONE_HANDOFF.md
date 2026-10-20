# Core C3c — durable ground-zone handoff and arrival fencing

This is a **dormant, single-authority reference implementation**, not live
multi-worker region migration. It is stacked on Core C3b
[PR #377](https://github.com/tehki/myaso/pull/377), which depends on C3a
[PR #375](https://github.com/tehki/myaso/pull/375) and C2a
[PR #365](https://github.com/tehki/myaso/pull/365).

## Why it exists

In a persistent full-loot realm, physical ground items have to be present in
**exactly one authoritative zone** at a time. A disconnect, packet retry,
late destination ACK or server restart must not spawn a second copy or
permanently erase the committed location.

The existing item journal stores item locations and complete idempotent
transaction receipts. C3c introduces `server/src/zone_item_transfer.rs` as
a small, separate state machine and two **read-only verification** functions
in `item_ownership.rs` and `item_journal.rs`.

## Single-authority transfer contract

1. A trusted server-side zone authority decides an item may move. It supplies
   a unique transaction ID, item ID, an **exact** expected source ground
   location and target ground location in a **different** zone.
2. `GroundTransferCoordinator::commit` rejects same-zone transfers and calls
   the durable journal to publish exactly one ownership `Move` from source
   `Ground { zone_id, x_cm, y_cm }` to destination. The old ground location
   stops being authoritative in the same transaction that publishes the new
   one.
3. The journal returns the canonical idempotency receipt only **after** its
   local durable commit completes. No acknowledgment precedes commit.
4. A `GroundTransferProof` carries the proposed transfer and receipt inside
   trusted Rust code. It is **not** a signed network token.
5. `confirm_arrival` performs a **read-only** lookup for the exact committed
   transaction ID, complete operation and receipt. It cannot write to the
   journal, consume a sequence, or create an item.
6. The proof is `Current` only if the journal's **present** item location
   equals that transfer's destination. If a later transaction already moved
   the item, the old proof becomes `Superseded`.
7. After restart, the journal rebuilds the exact current location and
   immutable receipts from its canonical commits. A matching retry returns
   the original receipt and cannot create a second ground object.
8. An invalid expected source, conflicting transaction ID, missing receipt,
   forged/mismatched receipt or corrupt on-disk commit is rejected.

Because C3b requires a single trusted local writer, this sequence proves
internal ordering on **one shared authority**. It does not prove a distributed
transaction between two independent VPS workers, simultaneous network
partitions or an independent-network multiplayer acceptance result.

## Exact test evidence

An isolated Rust 1.89 harness compiled `identity.rs`,
`item_ownership.rs`, `item_journal.rs`, and
`zone_item_transfer.rs`. The run passed **30 of 30 tests**, including seven
C3c-specific tests:

- Cross-zone transfer, durable commit, restart and idempotent retry.
- Two conflicting source-zone moves cannot both claim the item.
- A missing or fabricated receipt is rejected until commit.
- Retrying the same transaction with a different destination fails.
- A subsequent zone transfer supersedes earlier arrival proofs, even after
  restart.
- Invalid same-zone or stale-source requests do not consume a sequence.
- Corrupt committed records refuse recovery instead of creating ghost items.

The coordinator builds on the inherited C3a/C3b full-loot death and
anti-duplication tests.

The required full-suite acceptance remains:

```bash
cargo fmt --manifest-path server/Cargo.toml -- --check
cargo test --locked --manifest-path server/Cargo.toml zone_item_transfer::
cargo test --locked --manifest-path server/Cargo.toml --lib
```

All protected exact-head GitHub `quality` jobs, including real browser combat,
capacity and WebTransport acceptance, must also succeed.

## Mandatory activation blockers

**Do not invoke this code from live zone workers yet.** The following have
not been implemented or proven:

- **Real distributed transaction authority:** replace single-process file
  writes with serializable global item uniqueness, CAS/version predicates,
  committed idempotency receipts and durable event outbox/inbox. A local
  hard-link journal cannot coordinate two simultaneous authorities.
- **Authoritative source validation:** verify session generation, inventory
  and full-loot permissions, obstacle/collision rules, ground-item lifecycle,
  current zone owner and transfer eligibility. Requests from browsers must
  never directly mint a `GroundZoneTransfer`.
- **Worker handoff:** implement durable source freeze, exclusive target
  activation, exactly-once/at-least-once-safe delivery, ACK and timeout
  protocol, zone epoch fencing and deterministic rollback/recovery across
  independent processes.
- **Physical world integration:** map a committed item location to one
  canonical server-managed ground entity with interest-based replication.
  Until then, a `Current` proof establishes *ledger state*, not a rendered
  or physically collidable item.
- **Player and corpse migration:** this module addresses **ground-to-ground
  item movement only**. It does not migrate a player's inventory, active
  character, corpse world entity, spell effects, ownership deed or money.
- **Resilience and scale:** injected crashes and network partitions during
  source freeze/commit/ACK; multi-host runner tests; p95/p99 transfer latency,
  queue budgets, snapshot compaction and recovery under real realm load.
- **Trust and permissions:** protect journal directory/files from untrusted
  processes and symlinks; check disk quota and directory fsync semantics.
  Receipts and FNV checksums are not signed or cryptographically trusted.
- **Cross-department coordination:** Core & Multiplayer owns unique authority
  and durability; World & Gameplay owns region and object migration; Magic &
  Items owns lootability; Economics owns future trade and ownership monetary
  effects. No Moon Coin settlement is included.

## Release boundary

No server startup flag, live WebTransport endpoint, map migration, physical
item spawn, production database, wallet, gameplay change, merge, deployment
or production restart is enabled by C3c. The Moon Games Development Center
retains full responsibility for integration sequencing and release.

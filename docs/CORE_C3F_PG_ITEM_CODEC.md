# Core C3f — canonical item identity/location PostgreSQL boundary

Department 8B (Identity, Persistence & Transactions), stacked on [draft C3e PR #406](https://github.com/tehki/myaso/pull/406) (itself on C3d #401 and its parent chain). This is a **dormant encoding contract**, not a database migration or live gameplay adapter.

## Concrete mismatch discovered

The C3b `MYTX` file journal serializes numeric item IDs, character IDs, zone IDs and ground coordinates in **little-endian** order. Core 8C's C4d `world_mutation_contract.rs` and PostgreSQL `core_zone.entities` use **big-endian** 16-byte nonzero IDs. Copying binary journal fields into a SQL `bytea` argument would silently turn one valid identity into a different valid identity. This is worse than a parse error: it could corrupt ownership across independently deployed workers.

## Contract in `server/src/item_pg_codec.rs`

- Ground item entity namespace is **2** to match 8C `OwnedEntity::GroundItem`.
- All item IDs and ownership transaction IDs map `NonZeroU128` to exactly **16 network-order / big-endian bytes**, as C4d's world mutation contract already does. Zero IDs, malformed lengths and any failed roundtrip are rejected.
- Proposed **26-byte canonical location value** (not currently a PostgreSQL schema field, pending 8C/8B review): **tag 1** inventory, **tag 2** equipped, **tag 3** corpse, **tag 4** ground. Character and corpse IDs occupy bytes 1–16 big-endian; equipped slot is byte 17. Ground zone ID occupies bytes 1–8 big-endian; signed centimeter x/y coordinates occupy bytes 18–21 and 22–25 big-endian. Every unused/reserved byte must be zero.
- The parser rejects unknown tags, zero principals/zones, incorrect lengths, and noncanonical reserved bytes. A canonical location produces the same representation across architectures.
- The conversion accepts only **already typed trusted values**. It does not authenticate actors, ensure an item transfer is authorized, make PostgreSQL commits, check worker leases or prove transactional atomicity. Do **not** call directly with client-selected identities.

## Required next integration

Coordinate with Core 8C's pending [PR #393](https://github.com/tehki/myaso/pull/393) and Magic/Items to create a PostgreSQL *atomic item ownership + world-event* mutation with one authoritative serialized lock order, immutable complete request receipt, durable tombstones, no item duplication, verified character/worker claims, and persistent outbox. This may use the proposed location blob **only after explicit schema/version review**. Multi-entity moves, death loot, trades and economics require shared transactions; C4d currently guarantees only one world entity per mutation.

Do not use local C3b journal and remote C4d database simultaneously as co-equal writers. No shared network filesystem or distributed lease is provided by C3e's flock. No database, live identity, server runtime, production VPS, MOCMP wallet or main merge is modified by C3f.

## Acceptance

```sh
cargo fmt --manifest-path server/Cargo.toml -- --check
cargo test --locked --manifest-path server/Cargo.toml --lib item_pg_codec
cargo test --locked --manifest-path server/Cargo.toml --lib
cargo clippy --locked --manifest-path server/Cargo.toml --lib -- -D warnings
```

Full protected exact-head `quality` CI must pass before integration. The earlier C3e #406 first quality attempt failed unrelated protected M194 combat/browser; retry on the **same** C3e exact head was initiated with no test weakening.

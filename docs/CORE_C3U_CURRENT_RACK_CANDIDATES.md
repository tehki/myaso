# Core 8B C3u — current four-rack item candidates (First Playable P0)

**Status: DORMANT / READ-ONLY / local Rust TESTED / NOT a live item-authority API.**

Core 8B C3u is a child of the four-owner exact-source closure [#568](https://github.com/tehki/myaso/pull/568), which is itself stacked on World/Items/Core mapping preflight [#541](https://github.com/tehki/myaso/pull/541). It answers the Main Orchestrator's [#432](https://github.com/tehki/myaso/issues/432) requirement for a **versioned current on-rack/ground/item binding** without preemptively choosing an item writer, actor identity or centimeter/world-unit conversion.

## New read-only candidate contract

`read_proposed_current_four_rack_items(journal, source[4], legacy_import, explicit_conversion)`:

1. Runs the existing exact Greyhaven authored V1 **four named sockets** preflight against provided separately registered `u64` legacy `GroundEntity` and `Item` source identities. It requires exactly four unique physical item IDs and independently unique ground entity IDs. It fails closed for fake/swapped socket names or coordinate drift, duplicate/missing identities and invalid or overflowing coordinate conversions.
2. Resolves each legacy source into **separate canonical `u128` namespaces**: `canonical_ground_entity` and typed `ItemId`. This is *not* a live mint, database migration or runtime wire namespace, and there is still **NO** signed/checkpoint-backed input verifier here.
3. Reads the existing C3e **single-host, exclusive-writer local durable journal** at one immutable `&DurableItemJournal` borrow. The new `checked_ground_membership` method rejects a poisoned journal, requires a typed Ground location, and returns the latest committed **journal head** plus the item's current location-specific mutation sequence **only if** that exact canonical item is still at its proposed Ground location.
4. Returns private-field `CurrentFourRackCandidates { journal_sequence:u64, slots:[Option<CurrentRackCandidate>;4] }`. Each present candidate carries `socket_id`, proposed `canonical_ground_entity:u128`, canonical `ItemId`, precise Core `ItemLocation::Ground` and `item_mutation_sequence:u64`. `None` is an explicit *currently absent from this reviewed location* slot, including after a successful pickup, a drop elsewhere or a transfer to a different actor. All four slots share the one local journal sequence; absence has its own monotonically increasing sequence.
5. **ABA-safe local revision behavior:** a sword returned to the exact rack after equip→drop obtains a *newer* item mutation watermark. Historical pickup success is **not** treated as current rack presence.

The projection verifies **current journal item location** against **an externally supplied proposed source mapping**. It does **NOT** establish that the proposed ground-entity instance currently exists in live World/Items state, that its ID belongs to the expected physical item in a signed checkpoint, or that visual socket coordinates are valid in the server's current world epoch. A compromised or stale source manifest is outside this module's trust boundary. Positive output is a **local candidate** for a future authenticated adapter, NOT a server-issued pickup lease or a safe client item claim.

## Actual local regression tests

- A new empty journal has four explicit absent slots at sequence zero. Four distinct canonical sword identities created at the reviewed proposed rack Ground locations produce four present candidates with four independently registered ground entities and sequence=1.
- Pickup of one exact item to the first player's MainHand=0 removes that one rack candidate and advances the journal head; dropping it elsewhere does not show it on the rack. Returning that very same ID to the original rack produces a **newer** mutation sequence; closing and reopening the durable journal restores exactly the same snapshot, with all four items conserved.
- Fake socket names, repeated ground-entity IDs and unregistered item IDs fail mapping preflight. Swapping two registered item IDs between reviewed sockets cannot advertise either wrong sword. A numerically valid but wrong offset returns no current rack items; it does not authorize a conversion.

**Serj Linux Rust 1.89 exact implementation source** `777fb20772aab0a39b23e28015826a8a9e73c31b`: focused `alpha_current_rack_bindings` **3/3 PASS**; full `cargo test --locked --lib` **123 PASS, 0 FAIL, 3 intentionally ignored subprocess helper entries**; `cargo fmt --check` **PASS**; strict `cargo clippy --lib -- -D warnings` **PASS**. The new module adds no extra files, network handler, gameplay writer, schema, migrations, authentication or item mint.

Parent #541 exact-head protected [quality #39610109795](https://github.com/tehki/myaso/actions/runs/39610109795) PASSED 163/163. Separate parent #568 full [quality #39617285338](https://github.com/tehki/myaso/actions/runs/39617285338) **FAILED real protected M138 jump-attack counterplay** on an unrelated browser test; did not change Combat, and cannot be waived. This child requires **its own exact-head full protected quality**.

## Integration prerequisites — cannot be skipped

- **Items 2B / Core 8B / 8C / Main Orchestrator:** sign **ONE** canonical durable sword writer and reversible `u64↔u128` migration/ownership source. Both Items MYWLD003 and Core MYTX remain separate dormant prototypes and MUST NOT co-write any item. Ground-entity and item identities cannot be swapped or truncated. Complete retirement/collision screening, actual persistent item-kind registry and `MainHand=0` signoff are required.
- **World / 8C / Physics:** approve the actual world-unit→Core cm scale, origin/zone mapping, worker epoch and **same-tick** full rack LOS/reach against reviewed solids. Neither `x1` nor `x100` test mapping has been approved.
- **8A:** bind authenticated stable character and current session lease, actual exact selected ground entity **and** item ID, replay-safe `TryPickup`, one world+item commit and a durable ordered observer outbox/ACK with writer epoch. Local C3e journal sequence is NOT comparable across separate workers, failover, or migration, and output can go stale between read and publish.
- **UI / Graphics / Combat:** actual sword pixel hit-test and derived `ItemKind` from trusted current registry, and true fists vs sword transitions; never draw/equip a sword merely because a proposed `ItemId` is Some. At the three adjacent stand midpoints **two** rack swords are in 56-world-unit reach, so the actual click must identify the intended sword, not select nearest/first.

The authoritative four-independent-browser Chrome/Firefox and two-host M1–M5 proof, protected exact-head CI, review signoff, migration rollback and staging release are all still outstanding. This read-only projection cannot alone make the alpha playable.

**No `main` merge, DB change, live pickup execution, writer activation, production deployment or MOCMP.**

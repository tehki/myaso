# Core 8B — Character / session-generation and physical-item adapter contract v0 (review-only)

**Status:** DRAFT / INACTIVE. **Coordinator:** [Core X1 #405](https://github.com/tehki/myaso/issues/405). **Owner:** Core 8B. **Consumers:** Core 8A, Core 8C, Magic 2B, Combat 4, Economics 7. **Baseline:** the unmerged Core C2→C3d chain ending at [#401](https://github.com/tehki/myaso/pull/401) / `5d0313758f9aefe890f04e9d82bfb0230ddcb527`. **Cross-check:** unmerged Magic [#354](https://github.com/tehki/myaso/pull/354) / `8d4c7ce1b2f2e4bf3db4949604f63320b1bd8d5e`.

This records a **proposed versioned integration boundary**, not an implemented authentication provider, schema migration, gameplay packet, database adapter or approval to merge. None of the dormant identity/loot prototype PRs is part of the Combat Pre-Alpha release [#1036](https://github.com/tehki/myaso/pull/1036). Maintain HARD HOLD on production/account/item-value activation.

## 1. Source-of-truth inventory and conflicts

| Topic | Core 8B source | Magic source | Contract decision |
|---|---|---|---|
| Persistent character | `identity::CharacterId(u128)` nonzero, 36-byte versioned `CharacterRecord`, `session_generation: u64` | `character_identity::CharacterId(NonZeroU64)` | Core 8B owns *one* nonzero 128-bit canonical ID; Magic may adapt legacy IDs only through verified migration rows |
| Session | `SessionLeaseRegistry::activate_committed` consumes precommitted generation + nonzero connection ID, invalidates old lease | `SessionIdentityRegistry` uses `SessionLease {server_session:u32, epoch:u64}` and per-number high-water | One durable character-generation fence plus one current server-owned connection/actor incarnation; Magic cannot mint/authenticate a second principal |
| Items | `item_ownership::ItemId(u128)`, `OwnershipTxnId(u128)`, exclusive `ItemLocation`, exact expected-source operations, receipt, last-mutation sequence and retirement | Loot `ItemStack` numeric IDs, `loot_transaction::transact_operation`, whole-world `save_quiescent` checkpoint | One physical item record and idempotent journal/transaction authority. Magic emits domain proposals and presents views; no second committing ownership ledger |
| World / DB | Core8B C3 prototype is in-memory; journal and replay are separate dormant modules | Magic checkpoint is not a shared DB atomic transaction | Core8C alone admits the current zone worker/epoch and owns same-transaction DB fence, item/character state and outbox [#393](https://github.com/tehki/myaso/pull/393) |
| Combat arena | `player_id:u32`, boot nonce, local lease epoch, world instance, actor incarnation | No authenticated account binding in current arena | Keep these **ephemeral**; they can never become a durable CharacterId or authorize loot/account writes |

**Explicit non-equivalence:** 8B's `SessionLease.connection_id` and `session_generation`, Magic's `SessionLease.server_session/epoch`, and the existing QUIC `ServerActorBinding { player_id, boot_nonce, lease_epoch, world_instance, incarnation }` are different dimensions. No unchecked field-cast or numeric coincidence authenticates a player. The existing `main.rs` temporary arena has no account authentication service.

## 2. Proposed `character-binding/v1` contract

**Canonical type:** `CanonicalCharacterId = identity::CharacterId` (all 128 nonzero bits preserved). **Record:** immutable character ID plus durably committed, monotonically increasing nonzero `session_generation: u64`. Generation zero is never admitted. The 36-byte `MYCH` v1 identity record has an **FNV corruption check, not a signature or proof of authentication**; the authenticated backing store must separately provide integrity, authorization, CAS and durability.

**Admission sequence (server-only; propose interface, NOT wired):**

1. Verify account credentials with a trusted account authority. Derive a server-owned account-to-canonical-character lookup; reject a browser-supplied character ID, generation, ownership token, actor ID or zone/worker claim. Mock/unverified identities fail closed.
2. Load the existing identity and generation under the **durable character/connection single-writer fence**. Atomically reserve/commit the strictly next `u64` generation (checked increment; refuse overflow) with a compare-and-swap against the previous value. Recoverable failure before durability is **no admission**.
3. After commit, establish an 8B `SessionLease` keyed by canonical ID, committed generation and authenticated current connection ID. Only then bind the already-admitted 8A WebTransport connection to the exact 8C current world/zone epoch and server-owned `ServerActorBinding`. Return an opaque server-internal `CurrentCharacterBinding`; never echo it as a client-authoritative input.
4. Every gameplay or persistence command must check **the complete currently admitted binding** under the same authority fence used for its mutation: account/character, durable generation, exact connection and boot/actor incarnation, current zone worker epoch, permission and expected state revision. A separate `is_current` read followed by an unfenced write is insufficient.
5. Reconnect wins only after its generation is durably committed. Retire the old binding, old stream/ACK cursor and pending command authority *before* newly admitted gameplay mutates. A delayed old disconnect may close its own socket but must not remove/unbind its successor. Failure to reach the persistence authority denies writes.
6. Server restart reloads the durable generation high-water mark **before** accepting a new session. A replayed old record, packet, kill/loot ACK, stale hit cursor, disconnected QUIC writer or recycled `player_id` may not reattach or mutate the new character incarnation.

**Example review-only shape, not production Rust API:**

```text
CurrentCharacterBindingV1 {
  character_id: CharacterId(u128 nonzero),
  durable_session_generation: u64 nonzero,
  authenticated_connection_id: u64 nonzero,
  ephemeral_actor: { player_id:u32, boot_nonce:u128,
                     lease_epoch:u64, world_instance:u64, incarnation:u64 },
  zone_owner: { zone_id:u64, worker_id, lease_epoch:u64 },
}
authoritative_mutate(binding, expected_revision, operation_id, proposal)
    -> committed receipt | stale binding | conflict | unavailable
```

All nested values are derived on the server, not decoded from client inputs. The shape is intentionally **not** added to the original combat packet protocol, the dormant hit receipt/control proposal or to client state.

## 3. Non-lossy Magic character-ID migration

Magic currently owns a distinct `CharacterId(NonZeroU64)`. For import only, call it `MagicLegacyCharacterIdV1`, **not** an alternate live CharacterId.

**Proposed durable mapping (DB schema design, not present):**

```text
legacy_character_mapping_v1(
  source_namespace, legacy_id_u64_nonzero,
  canonical_character_id_u128_nonzero,
  migration_revision, migration_status
)
UNIQUE (source_namespace, legacy_id_u64_nonzero)
UNIQUE (canonical_character_id_u128_nonzero)
```

The migration transaction must: enumerate all old IDs and ownership references; reject zero, duplicate source IDs, missing owners and inconsistent aliases; reserve the canonical IDs from the *same global allocator/namespace* as new characters; persist a collision-checked one-to-one mapping; rewrite each character, inventory, equipment, corpse, receipt and command-sequence reference into staged canonical form; validate counts, ownership, references and checksums; then atomically publish a migration marker. Never truncate `u128→u64`, use a naïve `u64 as u128` cast as an identity proof, or allocate an ID from an independent Magic namespace without collision checks. Retry with the same mapping ID is idempotent; partially imported/missing rows keep that character's access **disabled**, not minted anew.

Use **16-byte big-endian** `bytea` for canonical character/item/transaction IDs in PostgreSQL. Legacy full `u64` values are not all representable as positive signed `bigint`; store unsigned legacy bytes or enforce a separately reviewed safe encoding. Use checked positive signed-`bigint` conversion for worker/zone/epoch fields, rejecting values greater than `i64::MAX`; never wrap.

A compatibility adapter may read an old `NonZeroU64` only together with a **verified durable mapping lookup**. No Magic method may activate a separate `SessionIdentityRegistry` as the authoritative player principal after cutover. Retire old writers only after full replay and rollback verification.

## 4. Proposed `physical-item-ownership/v1` adapter

**One authoritative physical item:** `item_ownership::ItemId(u128)` is globally unique, nonzero and never reassigned. Each item has **exactly one current location** among `Inventory(CharacterId)`, `Equipped {character_id,slot}`, `Corpse(CorpseId)`, `Ground {zone_id,x_cm,y_cm}`, or is permanently **retired by a Destroy tombstone** (not a second live location). A physical item cannot simultaneously be in a Magic checkpoint and an independent Core ledger with two write paths.

**Magic → Core proposal (no direct writes):**

```text
LootProposalV1 {
  current_binding: CurrentCharacterBindingV1,
  operation_id: OwnershipTxnId(u128),
  expected_world_revision,
  expected_item_last_mutation: [(ItemId, mutation_seq)],
  expected_sources: [(ItemId, ItemLocation)],
  intent: equip | unequip | loot_corpse | drop | pickup |
          death_scatter | consume | trade
}
```

Core8B validates item IDs and exact expected sources, one globally current location and equipped-slot uniqueness; Magic validates gameplay-only rules (reagents, corpse loot permissions, ranges, inventory capacity, full-loot policy) under the same World decision; Core8C verifies the **current zone owner/epoch**, authoritative actor presence and all touched revisions. All checks must be inside the **same DB write transaction** that updates durable character/item states, transaction receipt, last-mutation sequence, permanent tombstones and corresponding outbox events. No second writer or independent checkpointer commits a parallel truth.

**Commit / replay:**
- One `OwnershipTxnId` identifies an entire multi-item atomic batch. An identical retry returns the **same durable receipt** and emits no new mutation/outbox event; different operations under the same ID fail `ConflictingReplay`.
- Movement, equip, corpse and death settlement check expected source **and** per-item last mutation revision; a later A→B→A or A→B→C→B location ABA must reject stale arrival proofs even when current coordinates/owner appear equal.
- Death must transfer equipped + backpack + permitted ground/corpse state, inventory revision and outbox in **one** operation, with no visible partial drop or duplication after crash, reconnect, lost ACK or repeated kill event.
- Cross-zone handoff holds source in prepare/frozen state and transfers only after fenced 8C commit. A lost handoff ACK may replay the committed receipt; it must not mint, move or resurrect a second physical item.
- The dormant C3 in-memory journal's unbounded applied history, Magic's per-world checkpoint and SQLite Economics lab are **not** proof of a live single-primary distributed transaction. Do not activate full loot or transferable balances until real DB and restore tests pass.

**Item migration:** import every old Magic numeric ItemStack identity through a separate collision-checked `legacy_item_mapping_v1` keyed by import source and old item ID. Never infer that an existing `u64` is an available physical `u128`. Validate stack count/amount semantics separately from physical uniqueness. Quarantine orphan items and conflicting references; never silently drop items, create currency or auto-repair ownership in production.

## 5. Acceptance matrix (required before integration/activation)

| Fixture | Required evidence |
|---|---|
| Wrong/unverified account or client-selected character | No session, no character information leak, no item mutation |
| Same character concurrent login and reconnect | Only one current generation/connection; old input, HIT ACK, chat ACK, disconnect and loot cannot affect successor |
| Numeric `player_id` reuse / new World boot / death-respawn | Exact old actor incarnation rejected; fresh controls alone can mutate |
| Restart after durable generation reserve and before socket activation | No reuse of committed old generation; clean retry gets a new generation |
| Zero, high `u128`, high `u64`, alias and collision during Magic mapping | Full 128 bits survive; invalid or conflicting import fails without partial publish |
| Inventory↔equipment↔corpse↔ground + simultaneous equip conflict | Exactly one location, one slot owner, one batch receipt |
| Duplicate operation ID, conflicting replay, lost ACK, A-B-C-B arrival | Same receipt for identical retry; conflicting/stale operation rejected; no phantom second item |
| Kill/death multi-item settlement crash **at each commit boundary** | Every affected item and character state entirely pre- or post-transaction; outbox exactly once from durable receipt |
| Current zone lease expires / stale worker or split-brain / DB unavailable | No stale mutation, no untethered check-then-act window, no two writers |
| Genuine Chrome/Firefox/WAN reconnect and combat regression | Original World & Combat M41/M147/M194/M205 still pass; native current-actor proof survives race and net impairment |

Test in this order: **pure Rust contract tests → integration with authenticated test authority and single DB transaction → restart and process-kill recovery → three-client original QUIC/browser tests → isolated independent-network failure injection.** Verify the **same SHA** for every dependent acceptance suite. Parent CI red must not be masked by green child workflows.

## 6. Review ownership, ordering and out-of-scope

1. Core 8B + Magic 2B review ID conversion, legacy migration, gameplay proposal vocabulary and no-second-writer rule. Core 8B authors the adapter; Magic uses it only after shared compilation and regression proof.
2. Core 8C reviews transaction coupling, row-level current zone epoch CAS, and crash/partition behavior. No two-phase independent DB commits masquerading as atomic settlement.
3. Core 8A supplies server-authenticated connection/actor binding and invalidated ACK cursors. Existing original `/game` ephemeral session is **not** an authenticated character session.
4. Main Orchestrator 0 verifies PR merge order against #405 / #360 and protected exact-head suites. Do not merge this review-only contract into the Combat release branch for convenience.

**No approval here for:** production login provider, persistent world DB deployment, account migration, full loot, PvP balancing changes, MOCMP wallets, live-value currency, public QUIC private HIT extension, weakening acceptance or merging any existing draft PR.

**Gate remains HARD HOLD until all owners sign off and end-to-end evidence is green.**

## 7. Non-activating Magic carried-item reference preflight (Core 8B X1 review extension)

The dormant `legacy_identity_import::resolve_carried_stacks` helper validates **one complete, bounded staging partition** of Magic-style Backpack/Equipped stack references *only after* separately supplied character/item mappings have been staged. Each row supplies a namespaced legacy owner and physical item ID, a Backpack or opaque Equipped slot, and its original nonzero `u16` amount. It returns full-width canonical character/item IDs without changing any registry, World, item ledger, on-disk state, or network actor binding.

This preflight refuses an unmapped owner or item, the same physical item in two positions/owners, two distinct items in one owner's equipment slot, a zero stack amount or more than 1,024 rows in one batch. All failure cases return **no partial resolved rows**. The equipment slot byte is explicitly **opaque**: Magic 2B must review its slot enum encoding, item kind/stackability and permitted slot semantics before any actual integration. No character or item is authenticated or allocated by its appearance in a mapping.

**Scope boundary:** duplicates in a different partition or any Corpse/Ground record are **not** caught by this preflight. Global physical uniqueness, corpse ID mapping, cross-zone coordinates/leases, zero vs nonstackable amount rules, and the `ItemStack` kind are deliberately outside this helper; they need one authoritative full-import ledger check. Nothing here is a durable transaction or an approved `loot_transaction` writer. Never pass a partially validated migration to a live system or interpret this local proof as support for account login, real money, game progression, or full loot.

# Core X1 — Character identity byte contract v1 (test fixture only)

**Owner of this integration contract:** Core 8 Chief Architect, coordinating
Core 8B Persistence & Identity and Core 8C World Runtime.

**Normative domain owner:** Core 8B owns the verified durable `CharacterId`
and session-generation fencing semantics. Core 8C owns the authority database
mapping and authoritative worker/zone/epoch. This fixture creates **no new
identity type, login verifier, production serializer, persisted state, or
third competing authority registry**.

**Coordination:** [Core X1 issue #405](https://github.com/tehki/myaso/issues/405),
[Development Center #360](https://github.com/tehki/myaso/issues/360).
Baseline reviewed: `main` SHA
`7c5fe9b08e86254cff9e05ae07c1d0d572cb7879`.

## Existing implementations (verified, NOT yet integrated)

- **8B C2a [PR #365](https://github.com/tehki/myaso/pull/365):**
  `server/src/identity.rs::CharacterId(u128)`, validated nonzero;
  `CharacterRecord` uses **36-byte `MYCH` v1 format**:
  magic bytes `0..4`, version byte `4`, zero-reserved `5..8`,
  character ID as **16-byte little-endian** at `8..24`, session-generation
  `u64` **little-endian** at `24..32`, checksum at `32..36`.
  Checksum is `FNV-1a32(record[0..32])`, stored little-endian, for
  accidental corruption only. Generation zero may represent an unactivated
  record; live leases must consume a durably committed newer generation.
- **8C C4d [PR #393](https://github.com/tehki/myaso/pull/393):**
  `server/src/world_mutation_contract.rs::WorldMutationCommand` binds the
  same nonzero `u128` identity into a **big-endian** 16-byte PostgreSQL
  `bytea`, alongside entity kind `1` (character) / `2` (ground item).
  A mutation operation ID is likewise a nonzero **big-endian** 16-byte
  `bytea`. Worker, zone and authority epoch must fit PostgreSQL
  **positive signed 63-bit** `bigint`; the expected world revision may be
  **zero** for a new entity, but must never be negative or exceed signed 63 bits.
- **Magic [PR #354](https://github.com/tehki/myaso/pull/354):**
  `server/src/character_identity.rs::CharacterId(NonZeroU64)` and a
  separate `SessionIdentityRegistry` cannot represent the entire 8B ID
  range and have different session-generation semantics. No unchecked
  truncation, reinterpretation or automatic casting is authorized.

## Conformance fixtures

`tests/fixtures/core-x1-character-id-v1.json` contains byte-level golden
vectors for `1`, a full-width mixed-byte ID, and an ID with the highest bit
set. These include the exact 8B durable record, 8B little-endian stored ID,
8C big-endian SQL `bytea`, generation and checksum.

`tests/core-x1-identity-wire.test.mjs` independently recomputes and checks:
- Exact `MYCH` record layout, reserved/version bytes and FNV-1a checksum.
- 128-bit round trips across both byte orders, including high-half bits.
- **Explicit endian reversal** between 8B record bytes and 8C SQL bytes.
  Copying a 16-byte little-endian slice verbatim into SQL is incorrect.
- Fail-closed zero, malformed hexadecimal, damaged/checksum-invalid and
  nonzero reserved-byte records.
- Rejecting overflow when a high-half ID is forced into 64 bits.
- Rejecting zero/negative/out-of-range worker, zone and authority epochs;
  allowing zero only for an initial expected world-state revision, and rejecting
  negative or overflowing expected revisions.

Run with:

```sh
node --test tests/core-x1-identity-wire.test.mjs
```

This is an **oracle against the currently reviewed source contracts**,
not cross-branch live Rust verification. The two unmerged implementation
modules reside on different branch stacks. Their owning departments must
import or reproduce these vectors in Rust tests when implementing the
actual conversion adapter; adjust fixtures only under reviewed versioned
contract changes, never silently change live data.

## Required 8B↔8C integration adapter

A future adapter (owned by 8B for identity, 8C for DB binding) shall:
1. Obtain a server-verified, nonzero full-width `CharacterId`, not a
   claimed ID from WebTransport or UI.
2. Deserialize existing `MYCH` little-endian records **as little-endian**,
   verify record checksum/version, then convert the numeric ID to 16-byte
   **big-endian** when binding the PostgreSQL entity key.
3. Bind entity kind explicitly and retain nonzero 128-bit operation IDs.
4. Reject nonpositive worker/zone/epoch and signed-`bigint` overflow;
   accept initial expected world revision zero, but reject negative revisions.
5. Check a **durably committed session generation** and a current,
   authoritative, fenced zone worker in the same trusted admission/mutation
   workflow. No historical mutation receipt grants fresh authority.
6. Define deterministic, collision-checked **migration of legacy 64-bit
   Magic character IDs** before binding Magic loot/progression state. Until
   the migration is reviewed, such domain state remains dormant.
7. Keep exactly one physical item ownership writer and atomic death/loot
   settlement boundary. This byte fixture alone is insufficient for
   durable multi-entity Combat/Items/Economics transactions.
8. Run real Rust↔SQL round-trip tests, authenticated reconnect, stale lease,
   restart and database failover acceptance before activating any gameplay.

**Security/release:** no production auth implementation, live DB DDL,
wallets, server restart, VPS mutation, merger, or deployment. This is a
small reviewable cross-Core contract fixture only; the Moon Games
Development Center controls final integration.

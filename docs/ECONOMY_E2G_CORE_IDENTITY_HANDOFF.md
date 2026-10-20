# Economics E2g — Core 8B/8C identity bridge, fail-closed contract

**Status: Draft; offline-only interoperability test, not a production login, player account, property purchase or database migration.** This document coordinates the existing [Economics E2d PR #385](https://github.com/tehki/myaso/pull/385) with the actual **Core-owned** identity and authority drafts. No additional character ID or server authentication authority is declared by Economics.

## 1. Verified source of truth and byte-order mismatch

Core 8B [C2a #365](https://github.com/tehki/myaso/pull/365) proposes **nonzero 128-bit** `CharacterId(u128)` with a 36-byte `MYCH` v1 durable record: `MYCH` magic at bytes 0–3; v1 at byte 4; zero-reserved bytes 5–7; numeric ID **little-endian** at 8–23; stored generation **little-endian** at 24–31; 32-bit FNV-1a record checksum **little-endian** at 32–35. The checksum detects accidental corruption, **not ownership**; valid records do not imply an active session, and generation zero is not an authorized actor.

Core 8C [C4d #393](https://github.com/tehki/myaso/pull/393) uses the **same numeric nonzero 128-bit** character/entity ID as exactly **16 big-endian bytes** in PostgreSQL `bytea`. Directly copying 8B's record bytes 8–23 to PostgreSQL corrupts identity. A signed 63-bit PostgreSQL `bigint` or SQLite `INTEGER` likewise **cannot** represent the full ID domain.

This bridge references upstream **Core X1 [PR #407](https://github.com/tehki/myaso/pull/407), head `4556088bf5a938fedf7935a594e5ac0d5242cfc5`**, and reproduces its three immutable low/full-width/high-bit byte vectors as independent Economics acceptance. If Core approves a new format or ID namespace, the Economics tests must be updated by review, never silently coerced.

## 2. Exact delivered code

- `scripts/economics_core_identity.py`: parse untrusted `MYCH` v1 records; reject unexpected lengths, checksum, magic, version, reserved fields, zero ID and invalid Python numeric types; decode/encode exact Core 8C network-order 16-byte key; retain all 128 bits.
- `scripts/test_economics_core_identity.py`: 16 fixture tests for the three Core X1 golden records and byte-order reversal; checksum corruption; invalid/zero ID; high-bit/nontruncation; signed SQL bigint/SQLite overflow; and explicit refusal to treat parsed character records as authorized economic accounts. All API names label the parsed data **untrusted**.
- The existing mandatory protected `Validate E2d SQLite settlement recovery` job uses `python -m unittest discover -s scripts -p 'test_economics_*.py' -v`, so these 16 cases are additive; no existing gameplay, Rust, Combat or browser acceptance was altered.

**Local evidence:** **138/138 Python unittest tests passed** on authorized Serj (previous E2f 122 + new E2g 16) with byte-compilation. This is local acceptance only until exact-head GitHub Actions succeeds.

## 3. Essential difference: Character vs. Account vs. Session

The fixture SQLite settlement lab currently seeds toy `accounts(id=10/20/30)` and `admitted_sessions(player_id,epoch)` as **small integers**. These IDs are *not* Core `CharacterId`, and the demo `VerifiedSession` type is freely constructible; therefore it is **not an authorization token**. In particular, the numeric Core character ID `1` must **never** be accepted as demo treasury account ID `1`, even though both integers happen to match.

`decode_untrusted_mych_v1` yields only `UntrustedCoreCharacterRecord` (numeric ID, stored session-generation field, proposed big-endian PostgreSQL bytes). `prepare_economic_account_from_character` and `prohibit_legacy_sqlite_character_owner` intentionally **fail closed** for every input. Those refusals are part of the acceptance; this code **cannot** create an economic principal from a browser string, record checksum, live connection's short-term `player_id`, or matching integer.

**The production binding does not exist yet.** Core 8B must define/approve a **durable authenticated account principal**, the authoritative proof that a stable character belongs to that account, durable compare-and-swap session generation, and revocation/ban semantics. Core 8C / World must furnish the currently owned zone/entity worker lease and epoch from a *trusted installed provider*. An economic transfer must recheck both identity and authority **inside the final durable transaction**, not only at preflight.

## 4. One atomic production boundary, not two ledgers

Recommended centrally reviewed future direction:

1. Core authenticates and resolves a durable `AccountId` with verified `CharacterId(u128)`; Economics must not invent a competing `AccountId` schema or map a character ID into a payment account.
2. Use Core's approved ID mapping/endianness; PostgreSQL `bytea(16)` is a candidate for canonical nonzero character/entity IDs, but the approved account ID format and schema have **not** yet been specified.
3. Resolve the seller's approved consent, plot/world authority and title version, buyer's economic account and ownership cap, integer spendable balances, idempotency operation ID, and zone epoch. Lock relevant source-of-truth rows under an approved transaction isolation level.
4. Inside **one production transaction** atomically debit/credit ledger postings, transfer deed/title, consume listing and consent, store an immutable receipt and append an idempotent outbox event. The Economics SQLite fixture is **not** that database or the final schema.
5. Treat the Core 8C [world mutation stack #393](https://github.com/tehki/myaso/pull/393) and Core [item+world prototype #434](https://github.com/tehki/myaso/pull/434) as owner-specific **unmerged, dormant** dependencies. Do not merge production economic SQL on top of either stack without a versioned, reviewed composite transaction contract.
6. Verify with real independent concurrent clients, process/DB crash/restart, security principal revocation, rollback and replay, exact-head Rust/PG/browser acceptance, migrations and independently protected off-host committed checkpoint. No DB operations on the 60Hz simulation tick.

## 5. Merge / activation boundary

This PR changes **no Rust gameplay runtime**, identity issuance, actual PostgreSQL database, table migration, browser packet, WebTransport handler, player funds, world property, production service, wallet or Moon Coin. Core X1 and Core C4 drafts remain separate and unmerged. The central [Development Center #360](https://github.com/tehki/myaso/issues/360) coordinates any sequence of integrations and approvals. The present result is a regression-protected **identity interoperability guard**, nothing more.

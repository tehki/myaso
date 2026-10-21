# Economics E2h — Transaction-scoped Core principal-binding fixture

**Status:** draft, offline-only; research harness **NOT** a real player authenticator, account issuer, wallet, item market, house purchase API, or Core runtime module.

## Motivation and dependency

[Core 8B C2a #365](https://github.com/tehki/myaso/pull/365), [C2c #372](https://github.com/tehki/myaso/pull/372), [Core X1 #407](https://github.com/tehki/myaso/pull/407) and [Core 8C C4d #393](https://github.com/tehki/myaso/pull/393) have independent **dormant** identity, session generation, 128-bit ID endianness, authority-fencing, and PostgreSQL world mutation work. The current live server still allocates connection-scoped `player_id: u32`; no installed trusted account↔character verifier or production economy database exists. Economics must never treat a matching ID, `MYCH` checksum, or browser-provided claim as ownership.

Existing E2d [#385](https://github.com/tehki/myaso/pull/385) has fictional SQLite accounts (`INTEGER` IDs 10, 20, 30), seeded login epoch 8 and fabricated property consent. The E2g contract checks canonical full-width `CharacterId(u128)` wire format. E2h adds a constrained **database-bound identity consistency** test to avoid a check-then-use race within the existing *fictional* purchase transaction. It does **not** add Core authentication.

## Implemented

`scripts/economics_sqlite_lab.py` adds `core_fixture_bindings` in a **fresh disposable schema**, with one-to-one nonzero **16-byte big-endian** `account_key_be` and separately nonzero **16-byte big-endian** `character_key_be`, unique per fictional ledger account, plus a positive session generation. It seeds three obvious demonstration pairs and intentionally does not identify a real account or character. The SQL keys are **not** PostgreSQL money accounts and these IDs are not adopted as production `AccountId`.

`scripts/economics_core_binding.py` defines `FixtureCoreIdentityAssertion`, which is **untrusted and publicly constructible**, and `assert_fixture_binding_in_transaction`. The latter requires an already-open SQLite writer transaction and compares exact 16-byte principal keys, legacy fixture buyer identity, the expected session generation and still-active admitted epoch against a durable fixture row. It never opens a second connection or independently commits. To exercise this guard, offline `purchase(..., _test_only_core_assertion=...)` performs the check **after its `BEGIN IMMEDIATE` and before looking up any retry receipt, ledger account, property deed, or mutable listing**. This is not a signed credential or a session-verifier implementation.

**Important:** Omitting `_test_only_core_assertion` preserves the previous offline laboratory tests and its **unauthenticated** fixture-only purchase path. The prototype therefore is **not safe to expose as an API**. Production must have a completely separate, required trusted Core-owned authorization path that cannot accept optional/bypassable client claims.

The recovery auditor additionally validates the one-to-one fixture bindings, nonzero/different keys, player ownership and a recorded admission epoch, and includes the BLOB-based mapping in the logical checkpoint using a deterministic tagged hexadecimal encoding. Existing HMAC and witness behaviors still apply to the **test-only** data.

## Verification

`scripts/test_economics_core_binding.py` adds **18** tests: positive binding, distinct account/character IDs, character swap, account swap, other buyer/seller mapping, revocation, stale/invalid generation, new generation without binding update, bad/truncated/zero byte keys, unwanted assertion types, transaction requirement, invalid/duplicate mappings, rollback before receipt, retry with same exact binding, revocation after committed receipt, high-bit 128-bit identity, and a deliberately **forgeable matching fixture claim** demonstrating that an assertion is **not login evidence**.

**156/156 Python unittest cases passed locally** on authorized Serj; code passed byte-compilation. This total includes prior 138 E2g tests plus 18 E2h cases. Exact-head required CI uses the existing `test_economics_*.py` glob and is mandatory before this change can be called CI-validated.

## Core / production integration gates

1. **Core owns real authentication**: install a durable verified account↔character mapping and committed generation fence, using an authenticated session provider, not a fake Python assertion.
2. **Authority must be rechecked at commit**: lock corresponding Core account/session generation, character/zone authority and seller deed+consent rows **in the same approved production PostgreSQL transaction** that changes balances, title, listing, receipt and outbox; preflight-only verification is insufficient.
3. **Explicit production schema**: account ID type/namespace is currently undecided; do not assume an Economics-generated 16-byte `AccountId` is official. No silent cast to the demo SQLite `accounts.id`.
4. **Real owner protections**: deny stale/forged actor identities, replays, entitlement revocation, account reassignment, session takeover, shard handoffs and time-of-check/time-of-use races across independent clients. Prove crash/commit recovery, migration and externally witnessed sequencing.
5. **Central gates**: Core 8A/8B/8C, World, Economics and Development Center [#360](https://github.com/tehki/myaso/issues/360) review; full exact-head protected GitHub Actions, including unchanged real browser/Combat checks; no automatic merge or deployment.

There is **no Rust runtime integration, real player authentication, production account, persisted estate title, property economy, real payment, network listener, wallet or Moon Coin activation**.

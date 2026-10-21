# E2i — Mandatory provider-injected settlement admission (offline reference)

**Status: DRAFT / NOT LIVE / NOT AUTHENTICATION.** This component lives only in `scripts/` and cannot bind to a myaso.io WebTransport client, access real balances or mutate the deployed game server. The Core-owned verified identity provider and economic account ownership proof are **not installed**.

## Why this handoff exists

E2h's independent `_test_only_core_assertion` is caller-constructible and optional: it correctly tests 128-bit mapping and session-generation consistency **within** a SQLite purchase but must not become an authorization endpoint. Core 8B [C2c PR #372](https://github.com/tehki/myaso/pull/372) defines an inactive `TrustedIdentityVerifier`; Core 8C [C4f PR #413](https://github.com/tehki/myaso/pull/413) defines a dormant trusted worker admission boundary. Neither provides the installed server-authenticated account↔character↔zone authority needed by Economics. Core [X1 PR #407](https://github.com/tehki/myaso/pull/407) specifies 128-bit character encoding, **not** account ownership authorization.

## Delivered

`scripts/economics_core_gateway.py` adds a **strictly separate offline entry point** `strict_purchase_fixture`. Unlike the older `purchase()` laboratory, it **requires** an explicitly injected `FixtureServerSessionProvider` and a server-held session handle. An absent provider fails *before opening a purchase*. The abstract provider exposes `resolve_server_owned_handle`, returning fictional `FixtureResolvedTransport(ledger_player_id,account_key_be,character_key_be,active_generation)` data from a server-selected handle.

For verification, the existing SQLite `purchase()` now has two additional **underscore-prefixed TEST-ONLY** parameters. When supplied together, they call `assert_fixture_server_session_in_transaction` **after `BEGIN IMMEDIATE` and before old receipt lookup or any ledger/deed/listing change**. That boundary demands a fully matching fictional server-resolved buyer identity, active generation, and exact 16-byte nonzero separately keyed account and character mapping. It also checks the already persisted admitted session under the **same writer transaction**, so changes from other SQLite writers are fenced during the purchase.

An out-of-band preflight alone is **not sufficient**: if the authoritative session was revoked before the purchase locks its source-of-truth admission row, this operation must fail, including on idempotent retries. If the backend is absent, produces a wrong identity, is unavailable, or errors, `strict_purchase_fixture` fails closed. If a simulated ACK is lost after commit, the same authorized session can recover the unique receipt without a second transfer. A revoked session may not recover a private receipt using this path.

**No new Rust runtime, network, database dependency, SQL migration for any real service, or production credential is added.** The fixture's older optional, unauthenticated `purchase()` API intentionally remains for historical tests, but that means the **whole SQLite laboratory is unsafe for direct network exposure**.

## Verification and failure model

`scripts/test_economics_core_gateway.py` adds **22 tests** covering provider-required defaults, known mock transport, provider observation under SQLite writer lock, unknown/bad handles, unavailable provider, wrong character, wrong account, different buyer, stale or client-forged generation, failed authorization atomicity, revoked session after a committed receipt, rollback before commit, lost ACK retry, conflicting operation ID, forged provider outputs, wrong method types, incompatible optional assertion, and **a deliberate public mock-provider forgery**.

The mock adapter is provided by the test harness itself and does **not** verify a real server identity. A Python caller able to instantiate `FixtureServerSessionProvider` can fabricate its output. This is tested and documented as a **security limitation**, not a validated security control. The only meaningful validated property here is *fail-closed structural dependency injection and transaction-scoped consistency*, not cryptographic trust or proof of account ownership.

Run offline with:

```sh
python -m unittest discover -s scripts -p 'test_economics_*.py' -v
```

Core/Economics must retain the **entire exact-head protected quality workflow** and must never suppress unrelated combat/browser checks.

## Production integration requirements

1. **Core 8A/8B provide real server-authenticated evidence**: durable account principal, nonzero `CharacterId(u128)`, verified account↔character assignment and committed active session generation. A client-provided handle or Python adapter instance cannot become authority.
2. **Core 8C provides an installed server-owned worker/zone/epoch fence**: derive worker identity from server-owned authenticated transport, never from a client-supplied worker ID; re-read and lock the authoritative same row under the final PostgreSQL transaction, not a stale snapshot.
3. **Economics / World/Items jointly specify a canonical durable datastore and schema**: lock buyer/seller accounts, ownership cap, seller consent, map/parcel/title versions and zone authority; commit balanced postings, deed, spent listing/consent, unique receipt, global event and outbox atomically.
4. **Security and recovery acceptance**: attack and revoke before vs after lock, conflicting requests, two independent clients competing, loss of ACK before/after COMMIT, worker handoff fencing, rollback of authority, PostgreSQL primary termination, committed sequence checkpoints and actual backup restore. Keep the 60Hz authoritative simulation loop free from blocking DB writes.
5. **Central review**: [Development Center #360](https://github.com/tehki/myaso/issues/360) plus Core/World/Economics integration approval and full exact-head protected CI. Do not merge or deploy this E2i lab merely because tests pass.

**No live player balance, property deed, seller signature, API, wallet, Moon Coin, or deployment is activated.**

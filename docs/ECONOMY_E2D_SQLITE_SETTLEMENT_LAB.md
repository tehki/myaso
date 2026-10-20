# E2d Economics — SQLite durable settlement acceptance laboratory

**Status: DRAFT / UNMERGED / UNDEPLOYED.** This is a **standalone local-file research harness**, **not** an authorization to expose housing purchases or money to myaso.io players. The server Rust dependency set is untouched, no route is registered, no real account or title is imported, no deployment script is modified, and no cryptocurrency conversion or wallet exists.

## Purpose

E2c [PR #367](https://github.com/tehki/myaso/pull/367) models a single-writer **in-memory** property purchase and deterministic journal replay. E2d independently tests what changes once the **commit is persisted in a real SQLite database file**. It is **not** a claim that SQLite is the final large-realm datastore. The future canonical storage implementation requires the architecture and interface review described in the E2c `docs/ECONOMY_INTEGRATION_CONTRACT.md` branch document.

Files:

- `scripts/economics_sqlite_lab.py`: stdlib-only Python research module, file-backed SQLite schema + purchase function + test-fixture admission.
- `scripts/test_economics_sqlite_lab.py`: fake actor + separate process failure/retry tests.
- A new **additive, mandatory** step in the existing protected `.github/workflows/ci.yml`: `Validate E2d SQLite settlement recovery`. All existing combat/browser/Rust steps remain unchanged.

### How the offline test works

Run using an ordinary disposable test directory:

```bash
python -m unittest discover -s scripts -p 'test_economics_sqlite_lab.py' -v
```

`bootstrap_fixture(path)` explicitly creates **fictional** test accounts (treasury ID 1, buyers 10 and 30, seller 20), demo parcel 42, map revision 7, an imaginary seller-approved listing 50, and 2,400 nonredeemable units. The seeded `approved_consent` string is explicitly **NOT a verified signature**. Never use this bootstrap function to mint or credit game actors. If an existing database file is present, bootstrap refuses to overwrite it.

`purchase(db_path, session, intent, trusted_tick)` checks the *provided* verified-session structure against buyer intent, prior unique operation receipts, listing active/expiry/price/fee/accepted-consent reference, seller ownership and title/map revisions, buyer balance version and spendable credits, owner holdings cap, integer/revision overflow and double-entry posting conservation. **A constructed `VerifiedSession` does NOT provide real authentication**. This entry point must not be wired into game client commands.

SQLite uses **WAL, synchronous=FULL, foreign keys enabled, an explicit `BEGIN IMMEDIATE` writer transaction and checked conditional updates**. Within one commit the model changes buyer, seller and treasury balances, increments title version and moves owner, consumes the seller's listing, inserts three balanced ledger postings, allocates one monotonically incremented operation sequence, stores a unique durable receipt and writes one outbox event. A failure before COMMIT rolls everything back. A failure **after** successful COMMIT may lose the caller's acknowledgment, but a retry of the same authenticated test request returns the persisted receipt rather than executing a second transfer.

### What has been proved

Local authorized Serj development machine (standard Python 3 and SQLite stdlib):

- **14/14 unittest cases passed** using separate real temporary SQLite files.
- A normal committed sale survives connection close/reopen with one set of postings, one deed owner and one outbox event.
- Retrying the same operation ID returns the same canonical receipt, even when the server logical tick moves forward. Reusing an ID with another buyer/payload is rejected.
- Invalid session identity, stale balance/deed versions, expired/revoked/self sale, overdraft, and title revision overflow fail without partial debits.
- Fault injection after debit, after title and before commit rolls back.
- **Actual child-process `os._exit(91)` kills** at those pre-commit checkpoints leave no torn transaction on reopening the file.
- A kill **after** successful COMMIT retains the receipt, listing consumption, deed change and postings; restarted retry performs no new debit.
- **Two distinct Python processes** racing for the same listing produce exactly one winner, without a double purchase; the loser receives no title or debit.
- Snapshot asserts `sum(accounts.balance) == issued_units`, one three-posting zero-sum group per receipt, one outbox entry per receipt, and a consistent committed sequence.

The `hard_exit_*` failure points deliberately terminate their **own Python process**. Invoke them only in this offline test harness and never from a game server or other important process.

### What this does **not** prove

- **Not a production identity/authentication system:** caller can fabricate `VerifiedSession`. No Telegram/game login, server session keys, durable player IDs, ban/ownership policy, per-account quotas across shards or seller signature/consent verification.
- **Not a production game schema:** parcel 42 is not an admitted map parcel, title transfer has no world/UI/inventory integration, no true marketplace escrow or physical-item delivery; there are no live account balances.
- **Not a distributed database:** one local SQLite database serializes writers; this does not establish multi-zone/shard atomicity, shared/network filesystem durability, HA replication, recovery-point commitments, throughput, migrations or cloud failover.
- **Not physical hardware power-loss certification:** WAL + FULL sync and process kill tests do not cover drive controller lies, corrupted sectors, host power interruption, catastrophic disk failure or backup restore. An independent, authenticated highest-committed-sequence checkpoint and reconciliation remain required.
- **Not a true resource/accounting protocol:** `issued_units` metadata and consent reference are manually fixture-seeded; no audited mint/retire API, on-chain coin, FX rate, NFT or treasury deposit/withdrawal endpoint exists.
- **Not yet a launch-approved economic policy:** default values and land caps are fixture inputs and may not govern real property, taxes, real currency sinks, maintenance, storage, dead players or PvP looting.

## Required next decisions before real integration

1. Central coordination approves **one** canonical `AccountId`, `CharacterId`, `ParcelId`, `MapRevision`, `TitleVersion`, `OperationId` and fixed integer currency unit across E1/E2/E2b/E2c/E2d and Core/World/Items.
2. Approve actual durable storage and whether the authoritative game server or isolated trusted transaction service owns the ledger, titles, consent, escrow, outbox, and data migrations.
3. Add actual authenticated admission, server-confirmed world parcel catalog and seller consent verification, idempotent listing/escrow API, per-player anti-alt ownership caps, restart/migration/backup drills and physical-item reservation/conservation.
4. Prove deterministic recovery under multi-process and multi-server races, lock contention, failed storage writes, cross-region partitions, committed receipt loss detection, idempotent outbox consumption and partial restore.
5. Pass full exact-head protected quality CI including unchanged multiplayer combat/browser acceptance; central approval is required for merge, activation and deployment independently.

Moon Coin / MOCMP stays entirely disconnected: **no wallet, blockchain, real-money instrument, staking, custody, exchangeability or automatic conversion**. Sandbox credits are not real tokens and should never be described as convertible.

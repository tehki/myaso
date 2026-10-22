# Economics B3 — Disposable SQLite Bank Atomicity and Cross-Process Recovery

**myaso.io · Department 7 Economics · P2 experimental research · Not playable · Not integrated**

**Scope:** Expand the [B0 independently operated town banks](./ECONOMICS_P2_LOCAL_TOWN_BANKS.md), [B1 fail-closed World event contract](./ECONOMICS_B1_WORLD_VAULT_BREACH_CONTRACT.md), and [B2 in-process contention tests](./ECONOMICS_B2_BANK_ROBBERY_RACE_HARDENING.md) with a real file-backed SQLite database acceptance lab. **No Core, World, NPC, Combat, Items, client, multiplayer server, deployment, production currency, wallet or player-owned public bank changes.** This is a test-only standalone Python artifact.

## What is tested

- `scripts/economics_bank_b3_sqlite_lab.py` exposes an explicitly named `FixtureSqliteTownBanks` test-only store. The constructor requires environment `MYASO_BANK_B3_TEST_ONLY=1`, a local preexisting directory and a database filename ending `.b3test.sqlite3`. This is a **misuse tripwire, not real authentication**: any Python caller can set the environment variable and forge actor/World data.
- `initialize_fixture` supplies artificial founding vault reserves, simulated physically carried gold, and fake actor locations, with initial bounded total physical supply. The database cannot be reinitialized as a fund reset after seeding.
- Deposits and withdrawals require mock local presence, physical carried gold or local claim, weight limit, and a solvent bank. No remote bank access or interbank balance transfer. The town retains an independent numbered transaction/event sequence and immutable `(town, operation)` receipt.
- Raid settlement is named **`robbery_fixture`** and accepts a **publicly forgeable** `FixtureRaidOutcome`. It uses a unique 128-bit hex World event ID; the same event may commit only once globally. This is strictly a laboratory method, **not** proof that the player opened the vault or overcame Sentinel guards.
- For every transaction, one SQLite `BEGIN IMMEDIATE` transaction, with WAL and `synchronous=FULL`, fences competing local processes. The same SQL transaction commits affected vault physical reserve, actor carried gold, customer liability claim (for deposits/withdrawals only), local event row and immutable receipt together.
- A raid transfers physically modeled gold *from* the vault *to* a robber's carried gold. It **never silently erases other players' claims**. After a sufficiently large raid, insolvency `reserve < total liabilities` freezes further ordinary deposits and withdrawals, awaiting a future town restitution policy.
- `_audit_in_transaction` checks physical supply and contiguous per-town event/receipt counts before commit; reopening the DB with `audit()` detects simple tampering, mismatched totals and missing receipts. This is **not** a tamperproof remote audit, off-host witness or secure database role.
- Failure injection `after_balances` and `after_event` must roll back all provisional writes and release event IDs. `after_commit_unknown` raises **after** durable commit to emulate a lost network acknowledgment; exact idempotent retry reopens the DB and returns the original receipt without replaying the transaction.

## Independent-process proof

`scripts/test_economics_bank_b3_sqlite_lab.py` includes **25 deterministic tests**, including **two actual independent Python processes** opening the same disposable SQLite file simultaneously. With 100 units in one Greyhaven vault, two 70-unit robbers can collectively take **only 70**, not 140. With two different operation IDs and the same purported World event, only one may consume that event, including across town banks. It also tests thread contention, restart/reopen idempotency, lost ACK after COMMIT, crash rollback after updating balances and after writing journal rows, tampering detection, insolvency/liability retention, separate-town isolation, and rejected non-test SQLite file names.

Local authorized Serj acceptance: **B3 25/25 PASS; combined B0+B1+B2+B3 87/87 PASS**. The standalone CI workflow adds B3 to the existing focused bank suite and uses the repository's mandatory full quality workflow unchanged.

## Explicit limitations / blockers

This test harness is *not an authenticated banking API*. `FixtureRaidOutcome`, `travel_fixture`, the worker epoch and all identifiers are freely forgeable, and SQL clients with direct write access can alter records. It does not use Core `AccountId` / `CharacterId`, real server session generation, the actual Core 8C zone/worker authority row, Item ownership, unique persistent world container rows, inventory weight from real items, Sentinel patrols, bank geometry, door collision, or proof of real combat/robbery. Test fixture wallets are neither real money nor Moon Coin/MOCMP.

**B1's fail-closed `require_real_atomic_breach_authority` still always denies actual settlement.** B3 must not be imported by `server/`, `web/`, `src/` or used to turn a JSON envelope directly into robbery permission. SQLite `BEGIN IMMEDIATE` is not a substitute for the cross-service, single-authority, real PostgreSQL transaction required in deployment.

Promoting bank gameplay in a later milestone requires Core 8B / 8C, World, Items and Economics to share **one authenticated, zone-fenced PostgreSQL transaction** verifying and debiting the actual vault container, crediting actual physical gold into the robber's Item/container state, retaining depositor claims, recording a unique World event, emitting bank alarms/outbox, and surviving real process crashes and unknown COMMIT. Genuine browser multiplayer must be tested on independent devices and Chrome/Firefox. Main Orchestrator controls sequencing, merging, staging, deployment and rollback.

**P0 First Playable:** remains limited to verified multiplayer world visibility, movement, physical sword pickup, combat, death/respawn and chat. This P2 laboratory is never a release dependency.

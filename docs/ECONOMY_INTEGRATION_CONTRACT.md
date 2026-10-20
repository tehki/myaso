# Economics integration contract — E1/E2/E2b/E2c → one authoritative domain

**Status:** architecture proposal, not a migration, release, enabled feature, or proof of transactional durability. All six Economics PRs currently target `main` independently; this document lives in the existing E2c draft to prevent another overlapping runtime module. The central myaso.io development orchestration decides the eventual canonical implementation, integration order and deployment.

## 1. Identity and provenance are prerequisites

Live sessions must be mapped by **Core & Multiplayer** to authenticated, durable `account_id` and `character_id`, with stale-session / incarnation handling, per-account ownership caps, deletion and recovery policy. Browser-selected integers are never trusted actors. Server-authored world zone and `parcel_id` must be revision-pinned to an approved map manifest, collision/navigation rules and safe housing geometry from World & Gameplay.

Only an actual trusted server-side registrar may create/approve a parcel; a typed `Actor::Registrar` enum constructor alone is **not** authentication. Seller-initiated listings must be bound to an independently verified, revocable consent receipt. Client-visible intent must not create its own seller authorization, grant itself credits or select treasury policy.

## 2. Decide canonical concepts before merging prototypes

| Draft | Useful idea | Harmonization needed |
|---|---|---|
| [E1 #358](https://github.com/tehki/myaso/pull/358) | Double-entry nonredeemable sandbox ledger, escrow, idempotent journal | Currency has one immutable unit scale, nonnegative balance, explicit generation/retirement rules. Use canonical ledger entry/posting IDs across all monetary actions. |
| [E2 #363](https://github.com/tehki/myaso/pull/363) | Server-authored parcels, zone/map versions, deeds with monotonic title versions | Canonical global parcel ID and map revision, separate permanent private deed versus contestable guild/zone sovereignty. |
| [E2b #364](https://github.com/tehki/myaso/pull/364) | Validated purchase proposal, seller consent reference, buyer funds, treasury fee | Future coordinator must verify actual consent and fee policy; never trust client-supplied `VerifiedBuyer`/`Listing`. |
| [E2c #367](https://github.com/tehki/myaso/pull/367) | Single-writer staged all-or-none conveyance, duplicate-op protection, journal replay | Replace in-memory `Lab` with durable serializable transaction, one committed operation receipt, backed ledger + title + listing changes; anchor committed sequence. |
| [E3 #368](https://github.com/tehki/myaso/pull/368) | Housing affordability, land concentration, bounded policy sweeps | Research-only read-side statistics; do not let simulator change live balances or plot availability. |
| [E3b #374](https://github.com/tehki/myaso/pull/374) | Professions, craft/resource conservation, toy order book | Real market requires reservation/ownership of physical inventory, authenticated orders and atomic settlement; not copy/paste toy order matching into production. |

**Proposed consolidated vocabulary:** `AccountId` (durable payment owner), `CharacterId` (active fighter, never sole monetary principal), `ParcelId`, `MapRevision`, `TitleVersion`, `ListingId`, `AcceptedConsentId`, `OperationId` (unique within an explicitly versioned transaction domain), `LedgerAccount` (player/treasury/reserved), `CurrencyUnit` (fixed integer), `Posting`, and `SettlementReceipt`. Distinguish balance from spendable balance after reservations; seller receipts must not be guessable by an unauthorized buyer.

Do not merge duplicated E1/E2b/E2c account structs into runtime as three simultaneous sources of truth. The canonical chosen IDs and names should be agreed by Core, World & Gameplay, Magic & Items, and Economics first; adapt these drafts to that source of truth.

## 3. Atomic transaction boundary (future implementation, NOT current code)

Use a supported transactional datastore or a separately reviewed protocol that provides the same atomic guarantees. The preferred single-database purchase transaction has this order:

1. Read authenticated principal in a server-owned session context and validate that buyer is not seller. Verify operation ID uniqueness/previous canonical receipt, after authorizing who may retrieve it.
2. Under serializable isolation and/or justified row locks, read seller-signed active listing, fee schedule revision, current map/parcel revision, deed ownership/version, available buyer funds, required account reservations and the buyer's current land holdings/cap.
3. Reject stale/revoked/expired listing, competing buyer, invalid title, mismatched account revisions, insufficient funds or attempted multiple-account policy circumvention.
4. Stage integer `-price` buyer posting, `price-fee` seller posting and `fee` treasury posting, and verify their sum is exactly zero (in **nonredeemable** sandbox currency). Fees collected into treasury are **not** a burn. Enforce an immutable idempotency receipt and globally consistent positive operation sequence.
5. Within the **same** datastore transaction: transfer/increment deed title, debit/credit balances, insert balanced journal postings, record irrevocable spent listing/escrow state, record outbox event and canonical operation receipt. Commit **all or none**.
6. Publish non-authoritative client/UI changes only after successful commit; outbox delivery must be idempotent and recoverable, and never create a second payment.
7. On timeout or restart, query the durable receipt before retrying; never infer that a failed response means no transaction committed.

Candidate durable data concepts, *not endorsed SQL/schema*: `accounts` with revision and nonnegative integer balances; `parcels` referencing map manifest; `titles` with unique parcel and current owner/version; `listings` with verified consent and consumed/revoked flag; `postings` grouped by transaction and checked conservation; `operation_receipts` unique by domain+operation ID; `committed_sequence` plus authenticated replay checkpoints; `outbox` with stable event IDs; audited ownership-cap principal mapping; and eventually physical inventory reservations and item handoff.

Database uniqueness, title revisions and operation idempotency are **not interchangeable**: require all three, plus read/lock isolation. A single in-memory `&mut self` is not sufficient in multi-server production.

## 4. Mandatory failure/restart acceptance

Before making purchases possible in-game, verify independent processes/sessions with a persistent database and injectable kill points:

- Two competing buyers for one listing → exactly one receives deed; no rejected buyer debit.
- Same operation retried before commit, after commit, and after process restart → exactly one journal posting group, one title transfer and one canonical receipt.
- Crash after staged debit but before commit, crash during commit acknowledgment, and crash before outbox publish → restore one coherent state, and no duplicate external notifications.
- Revoked seller consent during checkout, title/map revision change, holding-cap race, insufficient funds, fee update or account-session invalidation → no partial exchange.
- Restore a trusted backup and independent committed sequence, verify completeness; reject a valid-looking but truncated journal against authoritative anchor.
- Adversarial replay/forged receipt attempts, malicious listing consent, zero/overflow values, negative or non-spendable balances, and conservation violations → fail closed.
- Separately test full-loot corpse/ground item conservation and safe private house storage. A player's ledger balance does **not** drop into the corpse as loot by default.
- Run protected exact-head `cargo fmt --check`, Rust `cargo check`/Clippy/test and multiplayer browser CI. Do not weaken cross-department acceptance for Economics.

## 5. Strict activation boundary

There is **no live property purchase, authenticated payment API, approved property map, production database migration, real housing title, real brokerage listing, or on-chain token** in these drafts. The documented economic unit is *not redeemable*. Moon Coin / MOCMP requires a separately verified token, approvals and custody/settlement architecture; never present the sandbox balance as a wallet balance or promise a conversion.

**Next central decision:** select one canonical account/parcel schema and durable DB service boundary before implementation; only then introduce migration code, transaction/rollback tests, verified real authentication and independent two-client multiplayer housing acceptance. Keep all existing Economics PRs draft and unmerged until integration review.

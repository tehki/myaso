# Economics E2b — property purchase planning contract (non-executing)

**Status:** sandbox-only domain prototype. **Not merged / not integrated / not live.**
**Owner:** Economics. **Independent draft PR**; does not depend on merging E1 #358 or E2 #363.

## Why another milestone?

An MMO player can own a house only when the deed and price settlement cannot diverge. E1 models test-credit journal mechanics and E2 models approved parcels and deeds; both are draft, transient and non-production. E2b defines the **preflight contract** for a future *single* serializable transaction that will atomically move credits and an authorized deed.

The code in `server/src/property_purchase.rs` is **pure planning**; it does **not** provide atomicity, durable storage, cryptocurrency, authentication, signature verification, a marketplace or a house. It does not read/write either draft PR's state. No wire schema, tick, browser or deployment changes.

## Inputs that the future coordinator MUST verify, not trust from clients

1. A valid authenticated current session binding to a durable buyer ID and incarnation/epoch. A browser may choose an intent, not its verified identity.
2. An accepted and **still active** seller-authorized listing loaded from a trusted persistent marketplace, tied to exact parcel ID, seller ID, title version, approved world map revision, price, fee schedule and expiry. A nonzero `seller_consent_id` field alone is **NOT** consent proof. Seller consent must have already been independently verified and preserved in audited storage.
3. Current authoritative deed ownership, zone/map revision, no transfer freeze/dispute or other restriction, and the latest title version.
4. Buyer and seller available test-credit balances, treasury balance, and their nonzero account revisions, all read from the same transactional snapshot with row locks / serializable isolation.
5. Server-verified ownership-cap policy and fee policy. These cannot be selected by the buyer or inferred from browser art.
6. Unique durable idempotency operation ID, with a replay check **inside** the transaction. If retried, return the same previously committed receipt; refuse a conflicting payload.

## What `plan_purchase` returns

An immutable `PurchasePlan` with the expected ledger/account revisions, seller/listing/parcel IDs, map revision, fee schedule revision, new deed title version, exact balances and three integer postings. It fails closed on zero IDs, buyer impersonation, self-sale, stale deed or map, expired/revoked listing, ineligible property, owner-limit breach, too-high fee, unknown or substituted accounts, insufficient funds, title overflow or balance overflow.

Credits satisfy **debit = seller proceeds + treasury fee**. Fees are treasury circulation transfers, **not Moon Coin burns**. The upper allowed commission of 1000 basis points is a defensive cap for the prototype, not a chosen tax rate or an economic proposal. Real values must be simulation-driven and transparent.

## Production-grade atomicity is NOT implemented

The downstream coordinator must commit these actions as a **single database transaction**, or none:
- Assert listing is still active and seller-approved, title version/revision and all balance revisions still equal the validated values;
- Assert buyer has adequate available credits and hasn't exceeded the property ownership cap (with concurrent ownership locked or otherwise serializable);
- Assert operation ID has no conflicting result;
- Debit buyer, credit seller proceeds, credit treasury fee;
- Increment the deed version and transfer ownership, consume listing, record immutable auditable transaction/event/receipt, and commit;
- Crash/restart/retry must preserve one outcome. Disputed, failed, partial or duplicate operations must not steal titles or funds.

A pure function cannot guarantee these transactional properties. In-memory multi-object update, database-per-service two-phase change, or independent ledger+deed API calls are **not sufficient** unless there is a formally reviewed distributed transaction/reconciliation protocol.

### Integration gates

- Define and approve actual durable account/character ID, coin-independent credit ledger schema, serializable database and authored map manifest.
- Review handling of seller voluntary consent, listing revocation, land-policy races, market abuse and property disputes.
- Wire authoritative property map and inventory safely only after the corresponding departments' contracts are approved.
- Test duplicate requests, stale sessions, simultaneous buyers, crashes between writes, process restarts, escrow timeout/recovery, overflow, fee changes, map revision rollovers, event replay, backups and cross-zone permission enforcement.
- Full exact-head protected quality CI and separate authorization to merge/activate/deploy.
- **Never** imply sandbox credits are exchangeable for MOCMP. See `docs/MOON_COIN_AWARENESS.md`: token has no verified approved payment integration, chain/contract or live currency bridge. No mint, wallet, custody, conversion, deposit or withdrawal functionality in this PR.

## Verification

```sh
cargo fmt --manifest-path server/Cargo.toml -- --check
cargo clippy --locked --manifest-path server/Cargo.toml --all-targets -- -D warnings
cargo test --locked --manifest-path server/Cargo.toml
```

Local standalone `property_purchase.rs` validation: 11 unit tests passed, rustfmt and Clippy passed on authorized Serj development machine. This is not proof of full repository acceptance. The broader quality job includes unrelated browser-combat requirements that must not be weakened to merge Economics.

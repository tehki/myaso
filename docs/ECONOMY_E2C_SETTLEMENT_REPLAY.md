# Economics E2c — Atomic property settlement **laboratory** & journal replay

**Status:** staging-only reference implementation; **DRAFT / UNMERGED / UNDEPLOYED**. No real currency, no claims to durable ownership. Economics seventh department, central orchestrator controls integration.

## What works now (and what does not)

`server/src/property_settlement_lab.rs` is a **single-writer in-memory model** of a future atomic property sale. Its `purchase(verified, intent, trusted_server_tick)` checks the authenticated buyer *interface* before even looking at an idempotency key. It then validates an already accepted seller listing, ownership/title and map revisions, listing expiry and availability, buyer account revision, title limit, funds and checked integer arithmetic.

A successful **laboratory transition** stages all fallible calculations first, then updates buyer and seller balances, treasury fees, parcel title ownership/version, consumed listing, idempotency receipt and journal together. In this model a competing buyer cannot acquire the already-consumed listing. Duplicate operation IDs for the exact same verified buyer and request return the stored receipt without charging again; mismatching payloads and impersonation are rejected.

The resulting journal has balanced postings: `-price + (price - fee) + fee = 0`. A fee increases the *treasury balance*, not blockchain burns or destruction. No new test credits are minted on purchase. `Lab::reconstruct(seed, journal)` deterministically rebuilds a fresh state and compares every replayed receipt and strictly increasing sequence; truncated or altered payloads can be detected when externally supplied expected data is available. This is **not** a cryptographic signature, tamper-resistant storage, file I/O or production crash recovery. A valid truncated prefix is not detectable by replay alone; an independently authoritative committed sequence/checkpoint is needed.

**Nothing calls this module from production server routes, 60Hz simulation, browser clients, NPCs, housing, or cryptocurrency services.** The only interface to `VerifiedBuyer` here is a placeholder and cannot authenticate anyone. The `Seed` assumes listings were reviewed by a trusted seller-consent authority; the integer consent ID is not a signature. In-memory `&mut self` serializes calls within one process but does **not** lock multiple nodes or provide ACID database guarantees.

## Independently anchored completeness checks (E2c follow-on)

An unmodified prefix of the journal can appear perfectly consistent when replayed from genesis. Deterministic replay alone therefore **cannot** prove that the last committed events are present. The lab now has `JournalAnchor` and `reconstruct_with_anchor(seed, journal, trusted_anchor)`, checking expected final sequence, total credit supply, player-account count, owned-title count and unconsumed-listing count. `Lab::journal_anchor()` constructs test fixtures only; **it is not a durable or authenticated checkpoint**.

Three new tests confirm (a) an empty but otherwise valid journal prefix is rejected when a separately supplied committed sequence expects a purchase, (b) contradictory checkpoint metadata fails closed, and (c) duplicate purchase retries do not inflate the anchored sequence or replayed balances. Combined with the 12 existing tests, **15/15 passed locally**, with strict Clippy and rustfmt.

This is *not* a cryptographic journal commitment. A malicious or broken system that rewrites both journal and checkpoint can bypass the comparison. A production-grade design needs independently authenticated/trusted checkpoint provenance, canonical event encoding, an integrity mechanism such as an authenticated hash chain or signed checkpoint, authoritative stable storage, backup-restore validation, and careful handling of partial writes, rollbacks and schema migrations. A complete-looking suffix cannot be proven complete without a trusted external highest-committed sequence or equivalent anchored state.

## Prerequisites for genuine durability (E2d, not implemented here)

1. Approve the durable account, character, parcel and approved world-map identities; never derive authoritative parcels from graphic assets, browser pixels or user-provided polygons.
2. Select a transactional datastore and migration strategy capable of **serializable/row-locked updates** to credits, deeds, listings, ownership caps and a unique operation-id receipt in one database commit. Cross-service writes or eventual-consistency account/deed updates are not sufficient without a reviewed distributed commit protocol.
3. Persist canonical double-entry journal plus transaction receipts with a durable uniqueness constraint. Persist/verify server-authorized seller listing consent, revocation and signed/current session admission; do not trust model structs received from the client.
4. Implement retries and recovery that return one authoritative result after crashes, distinguish incomplete attempts from committed records, rebuild from checkpoint with log truncation detection and verifiable integrity roots, and reconcile total backing value with liabilities.
5. Test concurrent competing buyers, same-account multi-device sessions, title-cap races, stale balances, listing revocation during purchase, fee-policy changes, replay attempts, failed fsync/DB commits, forced kill/restart, restore drills and physical inventory/deed conservation.
6. Define store cleanup/retention rules preserving the minimal durable financial and title records actually required by game integrity and applicable controls; never log wallet secrets, sensitive personal details or raw player chat as receipts.

## Dependencies and ordering

- **E1 #358**: nonredeemable sandbox ledger journal and escrow, unmerged.
- **E2 #363**: authorized pre-authored parcel catalog and versioned deeds, unmerged.
- **E2b #364**: pure purchase proposal and fee/authorization constraints, unmerged.
- **E2c**: this new independent test model; no imports from the other draft PRs. Consolidate compatible types when central orchestration reviews the integrated design, rather than merging all duplicated prototypes as active systems.

**Moon Coin is not approved for integration.** See `docs/MOON_COIN_AWARENESS.md`: no token mainnet, wallet login, deposit/withdrawal, purchase, price, gameplay reward, ownership NFT, or automatic conversion of sandbox credits in E2c. Any future crypto integration must be separately reviewed with reserve/liability reconciliation and independent deployment authorization.

## Verification

Local isolated Rust testing on authorized Serj development machine:

- `rustfmt --edition 2021 property_settlement_lab.rs`: passed.
- `rustc --edition 2021 --test ... && ./...-tests`: **12/12 passed**.
- `clippy-driver --edition 2021 --test ... -D warnings`: passed.

On exact PR head require `cargo fmt --manifest-path server/Cargo.toml -- --check`, `cargo check --locked --manifest-path server/Cargo.toml`, `cargo clippy --locked --manifest-path server/Cargo.toml --all-targets -- -D warnings`, `cargo test --locked --manifest-path server/Cargo.toml`, and full GitHub protected **quality** CI. Prior E1/E2 jobs failed unrelated strict multiplayer combat acceptance. The Economics branch must not weaken or skip them.

**No merge/activation/deploy until central integration approves and full exact-head acceptance is green.**

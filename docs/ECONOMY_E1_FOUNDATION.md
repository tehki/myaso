# Economics E1 — sandbox ledger and future economy

**Status:** independent laboratory foundation; DRAFT / UNMERGED / UNDEPLOYED.
**Owner stream:** Economics, department seven of myaso.io.
**Branch:** `feature/e1-sandbox-economy-ledger-20261020`.

## Monetary boundary

The currency in E1 is **nonredeemable sandbox credits**, not Moon Coin or MOCMP. Moon Coin has no verified live asset identity or integration authority; see [MOON_COIN_AWARENESS.md](MOON_COIN_AWARENESS.md). This PR does not mint, transfer, sell or custody cryptocurrency, add wallets, process payments, change production operations, or issue play-to-earn rewards.

A player financial account does not drop on death. Physical coins, if later represented as lootable item instances, must be separately minted and reconciled through an atomic deposit/withdrawal conversion; no such bridge exists here.

## E1 implementation

`server/src/economy.rs` contains a **non-activated in-memory double-entry sandbox ledger**: registered player accounts, treasury, retained (retired) accounting, authorized transfers, service fees, escrow hold/settle/refund, conserved genesis supply, immutable chronological journal entries and conflicting-replay protection. Operation IDs are idempotent; authorization precedes replay lookup. Amounts use integer units, never floats. All balance updates are staged and validated before mutation.

Tests cover transfer conservation, impersonation, replay, unknown players, insufficient funds, invalid amounts, duplicate escrows, settle-versus-refund, escrow fees, credit overflow and retirement accounting.

No live network handler, authenticated session, account database, persistent journal, client balance/UI, game tick hook or money-to-item trading is implemented. The `Actor` input is **only an interface for a future trusted server admission layer**, not a present-day proof of identity. In-memory atomicity is **not** crash-safe or concurrency-safe. This module cannot hold player value.

## Housing / zones: E2 design

- Keep **deed ownership** distinct from temporary or contestable **guild territorial control**.
- Deeds reference authoritative preapproved parcel IDs and map/collider revision, not user-drawn claims or visual art coordinates.
- Housing demand balanced by attainable primary residences, progressive second-property upkeep, supply controls, inactivity warnings and safeguarded stored goods.
- Property transfers must be atomic with trade escrow, authorization, durable identity, restart-safe persistence and recoverability.
- Zones may have bounded guild taxes and infrastructure, but cannot permanently deny critical newcomer routes or resources.

## Economic circulation: E3 design

- Producers: gatherers, artisans, traders, explorers and guild builders.
- Resource sinks: consumables, spell reagents, repairs, item destruction and construction. Pure full-loot transfer is **not** item destruction.
- Currency circulation costs: NPC services, plot permits, house upgrades, transport, market fees, settlement services and optional cosmetics. A player's payment to another player does **not** reduce total currency. Treasury fees are not a burn until accounting deliberately retires credits.
- Monitor stock, monetary velocity, price index, wealth concentration, land concentration, median hours to a starter house, replay/fraud attempts, bot farming, credit supply and market liquidity. Run simulated players and shock scenarios before gameplay activation.
- Never generate an externally issued token merely because an NPC dies. Any real-token rewards would require funded treasury allocation and independent approval.

## Future MOCMP: E4 gated design

No live crypto functionality without a verified immutable token chain/contract identity and governance, separate monetary and legal/security approval, regulated custody/settlement architecture where applicable, reserves/liabilities reconciliation, audits, consumer disclosures, fraud controls, exact-head acceptance and explicit deployment authorization. Never promise a token peg, buyback, price support or automatic conversion of sandbox progress into redeemable assets.

## Hard gates

1. Authenticated **durable** player identity and session leases.
2. ACID double-entry storage, serializable settlement, rollback/restore and immutable audit integrity.
3. Atomic linkage of ledger, inventory, escrow and property deeds.
4. Backpressure/rate limits away from the 60 Hz realtime combat loop.
5. Full unit + concurrency + recovery + adversarial economic tests, protected CI and real end-to-end acceptance.
6. Cross-department integration via central orchestration only.

Validate E1 with `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`, `cargo test --locked`, and protected quality CI at exact head. A draft green CI alone does not authorize merge, activation or deployment.

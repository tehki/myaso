# E3b — Professions, Order Matching & Resource Shocks (offline laboratory)

**Status:** independent staging-only research fixture. **DRAFT, UNMERGED, UNDEPLOYED**. No player data, account balance, active world, owner-deed transfer, WebTransport endpoint, payment, wallet, Moon Coin or blockchain involvement.

## Why this model

The earlier Economics E3 [circulation simulator](ECONOMY_E3_CIRCULATION_SIM.md) was a reproducible toy model of treasury-funded rewards, broad fees, and housing constraints; it did not model physical resources, professions and inventory-side trading together. E3b supplements it with a **separate zero-dependency Rust laboratory** in `server/src/economic_market_lab.rs`.

This does **not** import the unpublished E1/E2/E2b/E2c/E3 code or imply those PRs are ready for central integration.

## Five fictional economic roles

- **Gatherer:** produces units of ore, with a deterministic seeded harvest whose multiplier can be shocked to 0–200% of baseline. Gatherers offer physically held ore on an artificial market.
- **Crafter:** buys real ore, converts 2 units of ore into 1 equipment unit, and offers finished equipment.
- **Merchant:** holds limited inventory, bids and asks in ore/equipment with a toy spread.
- **Fighter:** buys equipment and destroys it on a configurable combat-wear interval.
- **Newcomer:** bids for basic equipment; receives a treasury-funded grant when an explicit per-day budget and hard treasury reserve permit it.

All roles are fixed artificial strategies. These are **not** trained behavior models, actual game NPCs, or calibrated forecasts of player conduct. No background services, live orders or externally sourced information are ingested.

## Matching and invariants

- Deterministic asks sorted by price/time ascending and bids by price descending/time ascending; only crossing bids and asks from distinct agents match.
- Fills use the ask price, clamped by **actual** available stock, buyer credit balance and remaining order quantity. One actor cannot sell more units than owned or spend the same credits twice in the same matching pass.
- Every fill is staged with checked integer arithmetic: full buyer debit, physical good transfer, seller payout and bounded treasury fee. A failed single fill leaves those resources and credits unchanged.
- The market commission is a **transfer to treasury**, not a mint/burn or a source of real token issuance. Grants **transfer existing treasury credits** subject to policy and reserve checks.
- Ore/equipment are tracked as resource stocks, with explicit sources and sinks. `ore_now + ore_used_to_craft = initial_ore + ore_harvested`; `equipment_now + destroyed = initial_equipment + crafted`.
- Credit conservation is `sum(player_credits) + treasury = initial_supply`.
- `Report` exposes separate material and money conservation aggregates, gross traded values, volumes, fees, grants and volume-weighted average trade prices. With zero trades, VWAP is explicitly `None`.

The simulator is **not** a durable, authenticated or reserving marketplace. The matching logic does not provide fairness, real-price discovery, exchange compliance or distributed transaction safety. Illustrative price quotes are hardcoded behavioral assumptions; reported price changes must not be extrapolated to a live economy.

## Shock scenarios and tests

A trusted test fixture may specify:
- `harvest_percent`: 0 (total ore disruption), 100 (baseline), 200 (doubling).
- `equipment_decay_days`: how frequently fighters destroy an item.
- `fee_bps`: illustrative commission, never more than 1000 basis points.
- `newcomer_grant`, `daily_grant_budget`, `treasury_floor`: constrained, prefunded redistribution.

The deterministic unit suite includes:
1. Multi-agent 180-day money, ore and equipment conservation.
2. Exact same-seed replay of agent state and aggregate results.
3. Zero-yield harvest shock reducing ore throughput and crafted equipment.
4. Faster equipment decay and explicit physical resource destruction.
5. Treasury grants unable to mint credits or breach the reserve floor.
6. Distinguishing commission from actual burn and refusing buyer double-spend.
7. Failed attempted oversell changing neither party nor treasury.
8. Integer overflow, cross-account self-dealing and malformed quotes denied.
9. Sorted crossed order matching with executable price inside both limits.
10. Invalid shock parameters leaving the simulation unchanged.
11. No fabricated price metrics with zero trade volume.

Local 11/11 tests passed; `rustfmt` and strict `clippy-driver --emit metadata -D warnings` passed on authorized Serj host. **Protected exact-head repository quality CI remains mandatory**.

## Strict nonactivation boundary

The code is built into the Rust server *library* for tests but is never called by `main.rs`, live simulation, AI, NPC commerce, realtime game sessions, inventory, deed registry, WebTransport, game rewards, or deployment. It has no database and cannot load an account. No real money or financial contract should ever be deposited or linked.

No E3b parameter is an adopted economic rate. For a meaningful launch decision, actual player income distributions, resource loops, loot/durability, re-entry after death, housing hours, land allocation, anti-bot sensitivity, social inequality and regional arbitrage would need instrumented/consented testing and threshold review.

**Moon Coin / MOCMP integration is not authorized.** Do not transfer, mint, sell, convert, custody or promise exchange of sandbox credits for on-chain assets. See [MOON_COIN_AWARENESS.md](MOON_COIN_AWARENESS.md). The advertised cryptocurrency initiative is not verified as an approved live payment method.

## Central integration gates

- Preserve existing protected `quality` job, including all browser/combat acceptance. Do not alter unrelated Combat, Sound, Magic/Items or Core paths.
- Review overlapping Economic domain models with central orchestrator before selecting canonical types or moving to a persistent subsystem.
- Production E2d durable account, serializable ledger, session-authenticated order IDs and delivery/escrow must be separately reviewed. Do not elevate the example book to a real purchase endpoint.
- Merge, runtime activation and deployment remain **three different approvals**.

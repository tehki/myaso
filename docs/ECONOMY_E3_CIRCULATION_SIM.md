# Economics E3 — Deterministic circulation and housing stress simulation

**Status:** standalone laboratory model, **DRAFT / UNMERGED / UNDEPLOYED**, no real players, real balances, deployed houses or cryptocurrency. Independent of E1 #358, E2 #363, E2b #364, and E2c #367. Central myaso.io integration still owns merge and release gates.

## What this simulates

`server/src/economic_stress_lab.rs` is a deliberately modest, deterministic monetary toy model, useful for discovering broken accounting and policy interactions before designing a production economy.

- Fixed initial, **nonredeemable sandbox-credit** issuance is assigned explicitly to players and treasury. Every in-game reward **debits the pre-funded treasury**. The total supply stays constant; no monster kills create coins or crypto assets.
- A configurable daily treasury reward budget, per-player allowance and minimum treasury reserve. One opportunity per simulated actor/day, independent of bot requests (real anti-bot identity/detection **not** implemented).
- NPC service charges, house purchase prices and plot upkeep pay **into** the treasury. These are circulation withdrawals, not permanent coin destruction.
- Player-to-player trade transfers price minus marketplace commission to the recipient, with the commission separately assigned to the treasury. Gross trading volume is not treated as monetary issuance or monetary destruction.
- Land plot capacity and a progressive-ownership prerequisite: `max_plots_per_player` limits holdings, with finite plots for the simulation. Failed upkeep is counted but does not automatically evict, erase items, or affect deed rights.
- Resource gathering and consumption tracked **separately from money**. E.g. consuming reagents is a resource sink, not a currency sink.
- Per-day snapshot: active player circulation, treasury balance, total issued, plot occupancy/vacancy, top-decile wealth share (basis points), median player balance, a rough **gross reward-days** starter-price indicator, and cumulative economic counters.
- Reproducible seeded pseudorandom actor decisions across thousands of agents; safe to run without touching live game state, a database, wallet, blockchain or network.

## Limits and economic interpretation

1. This is **not** an equilibrium model, economic forecast, cryptocurrency liquidity model, real price feed, or a tuned economic policy. Player behaviors are random and highly simplified. There are no true production supply chains, dynamic prices, exchange books, treasury liabilities or behavioral responses to incentives.
2. The starter-price-to-daily-reward ratio ignores living costs, reward probability, availability, housing upkeep and market prices; do **not** call it actual affordability. To measure real affordability later, replay realistic income distributions and inventory needs, including new-player cohorts and the actual number of plots available.
3. The top-tenth balance share is a descriptive metric, not a regulatory wealth cap. We must further measure Gini, wealth by cohort, property concentration, land accessibility, net migration, trade activity, inflation and deflation once a real agent-behavior simulator exists.
4. Failed upkeep incurs **no immediate seizure**. Real ownership needs reasonable grace periods, protected contents, reclaim evidence, appeals and recoverable safekeeping; it must not depend on crypto market prices.
5. A marketplace fee is **not** a real-token burn; treasury allocation and player circulation must be reported separately. An external finite MOCMP reward would require budgeted, fully funded reserves and independent issuance/settlement approval.
6. The output has no connection to live game server, combat loop, NPC decision model, property data, wallets or cryptography. Scenario parameters and seeds are test fixtures only, **not approved in-game fees**.

## Validation

Local authorized Serj host: isolated Rust tests **8/8 passed**, `rustfmt --check` passed, strict Clippy metadata-only passed. The first Clippy binary-link attempt encountered **host disk quota** after all eight tests had already passed; rerunning lint in metadata-only mode avoids linking a second binary while retaining `-D warnings`. Exact-head protected CI remains mandatory.

Deterministic tests include:
- 1,000 agents × 365 simulated days: fixed money supply, fixed total land, treasury payouts and resource consumption.
- Pure redistribution vs treasury fees and NPC services; correct integer fee rounding.
- Plot scarcity/ownership cap; property not repossessed for missed upkeep.
- Treasury funded reward limit and preserved reserve floor, despite repeat activity.
- 2,000 agents × 180 days, seeded replay produces exactly identical outcome.
- Invalid policy/overflow refusal and descriptive snapshots.

The protected full GitHub quality workflow must also pass unrelated Combat/Core browser acceptance; do not bypass existing gates to integrate this module. The authoring module is inert and contains no runtime path.

## E3 housing-access diagnostic extension (20 October 2026)

A read-only `Economy::housing_access()` report, calculated off the live game tick, now separates **cash affordability** from **land supply**. It reports the count of players with/without a plot, multi-property holders, landless players with enough current sandbox credits for a *first* plot, landless players below the sticker price, and the subset of cash-qualified first-home purchases the remaining plots could theoretically accommodate. The latter is a **capacity bound**, not a reservation or a promise that plots are in safe locations or actually for sale.

It also calculates the share of all *owned* plots held by the highest-holding ten percent of the simulated population, returning `None` when there are no owners. That figure is **land concentration**, distinct from the separate top-ten-percent **credit wealth** measure. The simulator cannot establish beneficial ownership across alt accounts, real housing eligibility, property location desirability or actual rental affordability.

Under a 10-player / 1-plot test, all ten players have sufficient test credits but only one first home is initially possible, and nine remain supply-constrained. Under a different test, one player holds two of three claimed plots and the land-concentration statistic reflects that share. Other tests verify that twelve empty plots do not help players whose current credits are below the nominal house price, and that aggregate metrics remain internally consistent after a 1,000-agent / 90-day simulation. These are mathematical regression fixtures, **not policy calibration or player-research evidence**.

**Verified locally:** 12/12 Rust unit tests (8 original + 4 added), exact source rustfmt and strict Clippy with warnings denied, on an authorized development machine. These local checks are not a substitute for protected GitHub quality CI at the updated exact head.

## Next planned E3+ work

- Calibrate simulator with player archetypes (new adventurer, gatherer, crafter, PvP, merchant, bot), actual item durability and resource flow, and finite NPC orders.
- Add a scenario grid with explicit parameter shocks (faucet change, sink change, player growth, land concentration, crypto volatility **only as off-game valuation exposure**, no peg) and test supply invariants for each.
- Add explicit net-welfare, starter housing hours and 90/99 percentile income metrics; define acceptable thresholds before going live.
- Design a production, off-combat-tick telemetry service using only minimal metadata and reviewed retention policies.

**Never convert test balances automatically to MOCMP or real value.** Moon Coin requires an immutable verified token identity, custody/settlement and independent value-handling authorization; see `docs/MOON_COIN_AWARENESS.md`.

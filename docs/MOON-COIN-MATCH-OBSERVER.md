# Moon Coin research: genuine MatchWon observation boundary (default off)

**Design status:** disabled in the running-server constructor. No game deployment, wallet,
reward, authentication, consent, persistence, network sender, signing, MOON token movement,
or Moon Coin PR merge is part of this change.

## What actually changes

The authoritative Rust server `run_authoritative_clock` now offers the **existing**
`CombatEvent::MatchWon { winner, kills }` slice to `MatchWinObserver` immediately after
`record_combat_events`. `SharedGame::new` constructs `MatchWinObserver::disabled()`.
The disabled observer returns without creating a channel, allocating, reading game identity
or touching the kill-feed protocol. Game outcomes and the five-kill rule are unchanged.

The library exposes a separate in-process `research_channel(capacity)` for offline
tests. It uses bounded `std::sync::mpsc::sync_channel` and `try_send`:
accepted, capacity-full and disconnected deliveries have distinct atomic counters.
A full or disconnected channel **drops** the observation; counters are neither durable
receipts nor authenticated ACKs. A new channel after restart starts empty. Sender
`try_send` is nonblocking *with respect to queue space*, **not lock-free or proven
hard real-time**. The enabled research channel is never configured or started in
the production server.

## What the actual game proves

`server/tests/moon_match_observer.rs` runs the real `World` attack/respawn loop,
observes the actual five-kill MatchWon event and checks its match-local net ID,
kill count and queue counts. This is a unit/integration simulation of the real
code path, not proof about the deployed VPS or live WebTransport players.

`server/src/match_observer.rs` also covers default-off, filtering irrelevant combat
events, full-capacity drop without waiting, disconnected receiver, process-local restart,
bounded capacity and FIFO ordering. All tests run with the existing GitHub-hosted Rust
quality job. No new CI permissions, runner labels, dependencies, GitHub Secrets or network.

## Next independent acceptance

A real Moon Coin connector needs separate trusted server instance and durable match
epoch, verifiable player-account binding and consent, a reviewed authenticated envelope
with key custody, durable outbox/inbox, commit-before-ACK idempotent effects, and crash
recovery. The existing observer intentionally supplies **none** of them.

For performance, measure the **real server** `world.step_into` and mutex-hold
p50/p95/p99/worst across disabled/enabled, queue-full and disconnected cases using
preregistered thresholds and realistic load. `try_send` microbenchmarks are insufficient.

Moon Coin's 12 external legal/security/release gates remain blocked. This Draft PR
does not approve merge, production activation, Mainnet, Testnet, sale or trading.

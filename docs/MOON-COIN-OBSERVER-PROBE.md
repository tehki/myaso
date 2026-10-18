# Moon Coin observer — instrumented World-step probe (research only)

Run against **the real** `myaso-server::simulation::World::step_into` API in an
isolated GitHub-hosted Rust build:

```bash
cargo run --locked --manifest-path server/Cargo.toml --bin moon_observer_tick_probe -- --ticks=1024 --players=32
```

This is a **deterministic scenario setup, not deterministic performance**.
The Rust process deliberately runs simulation steps **without wall-clock
60Hz pacing**, browser rendering, game-server mutex contention,
WebTransport, real players, network jitter, wallet, signer, ledger or MOON
payments. Tick timings cover a real `World::step_into` call; observer
timings separately sample observer behavior. Do **not** use these numbers
as a live game performance acceptance or security attestation.

The five scenarios share identical stationary-player geometry and
256 warmup steps, each with 1024 measured steps by default:

| Mode | Actual source event passed to observer | Expected research counter |
| --- | --- | --- |
| disabled | real `World` events; default-off | 0 for every counter |
| enabled_no_win_events | real `World` events; no artificial wins | 0 |
| synthetic_win_drained | **injected, untrusted artificial** MatchWon every tick | accepted each time |
| synthetic_win_queue_full | injected artificial MatchWon every tick; capacity 1 left full | full each time |
| synthetic_win_receiver_closed | injected artificial MatchWon every tick; dropped receiver | disconnected each time |

Each output line starts with `MOON_OBSERVER_UNPACED_WORLD_STEP=` and
contains ns p50/p95/p99/worst samples for the World step and observer
observation plus accepted/full/disconnected counters. The program does
not infer a pass/fail performance target from fluctuating CI CPU
samples. It does not test actual matched opponents winning.

**Remaining independent acceptance:** preregister game-owner
thresholds and measure a production-equivalent dedicated server
under 60Hz interval scheduling and state-mutex contention with
realistic input/snapshot/WebTransport load; compare disabled against
separate owner-approved enabled observer, full/disconnected cases
and crash recovery. Record p50/p95/p99/worst tick and lock durations,
input latency, dropped events, environment, confidence and rollback.

No local runners, server deployment, crypto transactions, Moon Coin
signatures/identity/consent or any of its 12 launch approval gates are
changed. This is an additive Draft PR research tool only.

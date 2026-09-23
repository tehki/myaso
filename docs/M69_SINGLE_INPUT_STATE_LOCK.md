# M69 - Single Input State Lock

## Objective

Remove one redundant authoritative game-state mutex acquisition from every accepted input datagram.

## Change

The input receive path now coalesces accepted redundant samples before entering the shared game-state critical section, then performs these operations under one mutex acquisition:

- apply the coalesced input to the player's authoritative fighter;
- record the processed-input acknowledgement at the same authoritative server tick;
- read the server tick used by stale-ack diagnostics.

Previously an accepted datagram locked `game.state` once to apply input and record the acknowledgement, released it, then immediately locked the same state again to read `world.tick`.

## Behavioral contract

Unchanged behavior:

- input deduplication and coalescing happen before the game-state lock;
- accepted inputs are applied with the same authoritative `World::set_input` path;
- processed-input acknowledgements keep the exact tick at which the input is applied;
- datagrams with no newly accepted input still read the current server tick for stale-ack diagnostics;
- protocol bytes, simulation cadence, combat behavior, snapshots and persistence are unchanged.

## Validation

The M69 unit regression verifies that the combined state-access helper applies the input, records its acknowledgement at the returned authoritative tick, returns that same server tick, and leaves the acknowledgement queue unchanged when no new input is accepted.

The inherited Rust, browser, input-loss and capacity suites remain required.

## Base / rollback

Base is M68 exact green head `f01594f1545b7dd729d3b382fb6e93d5e4d58f16`, quality run `35859235801` PASS.

Rollback is to close/discard the M69 branch/PR. M68 remains unchanged.

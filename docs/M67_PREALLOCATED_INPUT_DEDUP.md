# M67 - Preallocated Input Dedup Window

## Objective

Remove HashSet growth/reallocation from the authoritative input replay/dedup hot path while preserving the existing tick-history and wraparound semantics.

## Why this matters

M64 removed accepted-batch allocation and M66 removed decoded-sample allocation, but each session's replay/dedup HashSet still began empty and could grow while live datagrams were being processed.

The replay window is already strictly bounded by `history_ticks`, and a single protocol datagram can contribute at most `3` samples.

M67 allocates enough dedup capacity once when the session ingress window is created:

- every tick in the inclusive replay window;
- plus one full three-sample ingress batch before stale entries are retained away.

## Behavioral contract

The dedup algorithm itself is unchanged:

- the newest observed tick remains authoritative;
- samples older than the configured history window are rejected;
- already-seen ticks are rejected;
- accepted samples are returned oldest-to-newest;
- 32-bit tick wraparound handling is unchanged.

## Validation

The M67 regression drives 400 rolling valid input packets through a small configured history window and asserts that the HashSet capacity never grows after construction.

The inherited Rust, browser, input-loss, and capacity suites remain required.

## Unchanged

No protocol bytes/version, sample redundancy, history length, combat rules/constants, simulation cadence, snapshot/reliable formats, prediction/interpolation, persistence, deployment, or runtime activation changes.

## Base / rollback

Base is M66 exact head `33143eb52ebae90faa492d47eed426ac6d8786f2`, validated by quality run `35707824010` PASS.

Rollback is to close/discard the M67 branch/PR. M66 remains unchanged.

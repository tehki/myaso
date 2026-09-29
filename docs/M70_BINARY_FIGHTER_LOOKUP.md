# M70 - Binary Fighter Identity Lookup

## Objective

Remove linear fighter-ID scans from authoritative input handling while preserving the world's existing sorted fighter order and gameplay behavior.

## Change

`World` now centralizes fighter identity resolution through `binary_search_by_key` over the already sorted fighter vector.

The same binary lookup now drives:

- `fighter(net_id)` reads;
- `set_input(net_id, ...)` writes on the accepted-input hot path;
- duplicate detection and insertion position for `add_player_at`;
- exact-index removal for `remove_player`.

New fighters are inserted directly at the binary-search insertion point instead of push-then-sort.

## Performance effect

Accepted input application changes from a linear scan over up to the full fighter set to logarithmic identity lookup. Join and leave operations also avoid full duplicate scans or retain passes, while preserving the same sorted authoritative storage.

## Behavioral contract

Unchanged behavior:

- fighter storage remains ascending by authoritative network ID;
- duplicate and zero IDs remain rejected;
- missing-fighter input/removal operations still return false;
- input normalization, combat, movement, simulation cadence, snapshots, protocol bytes and persistence are unchanged.

## Validation

The M70 regression inserts fighters out of order, proves authoritative sorted storage, duplicate rejection, hit/miss lookup behavior, exact input routing, and removal while retaining the sorted invariant.

The inherited Rust, browser, input-loss and 512-player capacity suites remain required.

## Base / rollback

Base is M69 exact green head `c2eb3e35370075b72b562bec1fc2713246d9b44b`, quality run `35863839113` PASS.

Rollback is to close/discard the M70 branch/PR. M69 remains unchanged.

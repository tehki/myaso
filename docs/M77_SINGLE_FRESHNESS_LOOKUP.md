# M77 - Single Snapshot Freshness Lookup

## Objective

Remove a redundant ordered-map lookup from the per-visible-entity snapshot planning path while preserving replication cadence and freshness accounting.

## Change

For each visible entity, the planner now reads `last_sent_tick` once and derives both:

- `sent_age`, where a missing entry remains `u32::MAX` so an unsent entity is immediately eligible; and
- `freshness_age`, where a missing entry remains `0` so freshness diagnostics do not report artificial starvation.

Previously those two ages performed two identical `BTreeMap::get` operations for the same network ID.

## Performance effect

The visible-entity planning loop performs one `last_sent_tick` tree lookup per entity instead of two. This reduces ordered-map traversal work on every snapshot build without changing storage, ordering, or wire output.

## Behavioral contract

Unchanged behavior:

- unseen entities are immediately eligible for replication;
- missing last-sent timestamps report zero freshness age;
- present timestamps use the same wrapping tick subtraction;
- owner/combat/near/mid/far cadence and priority buckets;
- starvation handling and freshness deadline accounting;
- snapshot bytes/version, ACK/baseline semantics, interest filtering, combat, movement, input handling and persistence.

## Validation

The focused M77 regression builds a real session baseline, changes the owner state, and verifies:

- a present last-sent timestamp produces the same due/sent freshness age;
- removing the timestamp still makes the changed state eligible immediately;
- missing timestamp freshness age remains zero.

The inherited Rust, focused M64-M76, browser, FFA, input-loss and 512-player capacity suites remain required.

## Base / rollback

Base is M76 exact green head `fa33d7983a3fe7a70a6318abd9af2e7dbb97a3cd`, quality run `35895113560` PASS.

Rollback is to close/discard the M77 branch/PR. M76 remains unchanged.

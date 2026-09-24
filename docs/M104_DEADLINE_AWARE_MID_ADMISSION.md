# M104 — Deadline-Aware Mid Admission

## Objective

Reduce the remaining 512-player mid-tier freshness deadline misses by admitting deadline-due mid records before fresh mid records under the same datagram budget, without weakening combat/near priority or allocating/sorting another buffer.

## Base

M103 exact green head `9bf12535c3314569eb1709c6a07e801424e23dfb`, quality run `36072841881` PASS on bounded unchanged-head rerun job `107878801892`.

At 512 players M103 measured:

- average records/snapshot: `75.21`;
- omission ratio: `0.080639`;
- mid freshness deadline misses: `213`;
- mid max due age: `39` ticks;
- mid max omitted age: `36` ticks;
- combat deadline misses: `0`;
- near deadline misses: `0`.

M101–M103 materially reduced byte pressure. The remaining freshness signal is now concentrated in ordinary mid-tier admission order.

## Existing order

The planner uses priority buckets:

0. owner;
1. combat;
2. near;
3. urgent remote state;
4. removals;
5. unseen state;
6. starvation recovery;
7. ordinary mid;
8. far.

Combat and near buckets already use age-first deadline ordering. Ordinary mid uses a deterministic rotating offset to preserve fairness and spatial locality.

M104 changes only bucket 7.

## Change

The existing rotated mid order is scanned twice:

### Pass 1 — deadline due

Admit records whose current age is at or above the mid freshness budget.

The mid freshness budget remains:

`INTEREST_MID_INTERVAL_TICKS * 5 = 30 ticks`.

Using `>= 30` rather than only `> 30` gives a record its final scheduled opportunity before it would become a deadline miss on a later snapshot.

### Pass 2 — fresh mid

Then scan the remaining records below the freshness budget.

Within each pass, records retain the exact same deterministic rotated order that M103 used.

## Allocation and byte-budget behavior

No new vector, sort, map, or heap allocation is added.

Both passes read the existing mid bucket in place.

Every candidate still goes through the established stateful composition function at its actual admission point. Therefore:

- M102 local-cell position context remains exact;
- M103 action/flag byte sizing remains exact;
- omitted records do not advance position context;
- the 1100-byte datagram budget remains exact.

Each mid record is considered by exactly one pass, so freshness omission accounting is not duplicated.

## Priority guarantees

Unchanged higher-priority buckets are processed before mid:

- owner;
- combat;
- near;
- urgent;
- removals;
- unseen;
- starvation.

M104 cannot crowd out combat or near freshness.

Far remains after mid.

## Focused validation

`deadline_due_mid_records_precede_rotating_fresh_mid_under_budget` creates four ordinary mid records with ages:

- 6 ticks;
- 30 ticks;
- 33 ticks;
- 12 ticks.

It verifies:

1. all four remain in ordinary mid bucket 7;
2. full-budget output equals the existing rotated order filtered first by age >= 30, then by age < 30;
3. relative rotated order is preserved inside both classes;
4. under a one-record byte budget, the admitted record comes from the deadline-due class;
5. exact due/sent/omitted accounting remains 4/1/3.

All inherited Rust, snapshot, browser, combat, FFA, reliable-delta and 512-player capacity gates remain required.

## Acceptance signal

M104 is intended to reduce the M103 baseline of `213` mid deadline misses.

A bandwidth or CPU speedup is not required: M104 changes scheduling order rather than wire size.

The key acceptance requirements are:

- combat misses remain zero;
- near misses remain zero;
- mid deadline misses decrease;
- omission ratio does not materially regress;
- exact snapshot budgeting and all real-time target booleans remain true.

## Unchanged

No wire encoding/version, snapshot bytes for a fixed record order, interest radii, cadence thresholds, freshness budgets, bucket priority above mid, ACK/baseline/history semantics, combat, movement, input, persistence, deployment, or runtime activation changes.

## Rollback

Close/discard M104; M103 remains the exact green base.

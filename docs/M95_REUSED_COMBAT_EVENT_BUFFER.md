# M95 — Reused Combat Event Buffer

## Objective

Remove the per-tick combat-event vector allocation from the 60 Hz authoritative server clock while preserving the existing public simulation API and exact combat semantics.

## Base

M94 exact green head `184419ab058c3bf91e1f75829ca7b8aecf1edba0`, quality run `36022409594` PASS after one unchanged-head rerun.

## Change

`World` now exposes allocation-reusing stepping helpers:

- `step_into(&mut Vec<CombatEvent>)` for one authoritative server tick;
- `step_by_into(dt_ms, &mut Vec<CombatEvent>)` for deterministic substep callers.

The existing allocating APIs remain intact:

- `step() -> Vec<CombatEvent>`
- `step_by(dt_ms) -> Vec<CombatEvent>`

Those wrappers allocate once and delegate to the reusable path, preserving their behavior for tests and callers that prefer owned results.

The authoritative clock now owns one combat-event vector outside the 60 Hz loop and refills it in place every tick before recording death/kill events.

## Why it matters

The old authoritative clock created a new `Vec<CombatEvent>` every simulation tick. At 60 Hz this produces avoidable allocator churn even on ticks that emit no combat events.

M95 moves that allocation outside the hot loop while preserving event ordering and ownership boundaries.

## Focused validation

`reusable_combat_event_buffer_matches_allocating_step_semantics`:

1. clones one deterministic two-fighter world into allocating and reusable paths;
2. drives both through the same 5 ms combat substeps;
3. compares emitted event sequences every step;
4. compares authoritative tick/time/winner/fighter state every step;
5. verifies a real combat event is observed;
6. verifies the reusable vector's allocation pointer and capacity remain unchanged throughout.

## Unchanged

No combat timings, damage, movement, collision, event ordering, kill accounting, snapshot cadence, networking protocol, reliable queue, persistence, deployment, or runtime activation changes.

## Rollback

Close/discard M95; M94 remains unchanged.

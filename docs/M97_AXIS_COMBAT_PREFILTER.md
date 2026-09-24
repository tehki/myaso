# M97 — Axis Combat Prefilter

## Objective

Reject obviously distant fighter pairs before squared-distance arithmetic in the authoritative 60 Hz combat hot paths, while preserving the exact circular collision and attack ranges introduced through M96.

## Base

M96 exact green head `bf4e097d2a15bc28e4fc7925886abd7c767d1778`, quality run `36025716662` PASS after one unchanged-head rerun.

## Change

### Fighter separation

Before computing squared distance, M97 now rejects a pair immediately when either axis separation is already at least the 36-unit body diameter.

Only pairs inside that 36×36 axis-aligned envelope proceed to the exact circular squared-distance check.

The squared-distance check remains authoritative; the prefilter cannot turn circular collision into box collision.

### Attack reach

Before squared-distance attack reach, M97 rejects a target immediately when either axis separation exceeds the 94-unit maximum center distance.

Pairs inside the axis envelope still pass through the exact circular 94-unit reach check and then the unchanged angular attack-arc check.

## Why it matters

At 512 fighters, the unchanged pairwise collision loop considers roughly 130,000 fighter pairs per simulation tick. Most are far apart.

A pair whose x or y separation alone already exceeds collision range can now be discarded using two absolute-value comparisons, avoiding multiplication/addition and the later square-root path.

Attack candidate scans receive the same cheap rejection before exact range/arc work.

## Focused validation

`axis_prefilter_preserves_diagonal_collision_and_attack_ranges` verifies cases that cannot be decided by one axis alone:

- collision at (+30,+30), outside the 36-unit circle, remains non-overlapping;
- collision at (+25,+25), inside the 36-unit circle, is separated correctly;
- attack at (+90,+20), inside the 94-unit circle and forward arc, still hits;
- attack at (+90,+30), outside the 94-unit circle despite both axes being individually in range, still misses.

The M96 exact 36/94 boundary regression remains required as an inherited gate.

## Unchanged

No fighter pair ordering, circular distance thresholds, collision shift math, attack arc, damage, movement, block/parry/dodge behavior, event ordering, snapshot cadence, networking protocol, persistence, deployment, or runtime activation changes.

## Rollback

Close/discard M97; M96 remains unchanged.

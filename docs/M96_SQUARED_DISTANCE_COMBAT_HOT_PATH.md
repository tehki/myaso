# M96 — Squared-Distance Combat Hot Path

## Objective

Reduce expensive square-root work in the authoritative 60 Hz combat loop without changing fighter pair ordering, collision resolution, attack range, or gameplay semantics.

## Base

M95 exact green head `5a2dabf7fe2181ad5840447c2f5ca0629fb3f108`, quality run `36024261228` PASS.

## Change

Two existing pairwise hot paths now reject distant pairs using squared distance:

- fighter-body separation;
- attack-reach testing.

### Fighter separation

Before M96 every live fighter pair called `hypot` before discovering that most pairs were farther apart than the 36-unit body diameter.

M96 computes:

`distance_sq = dx * dx + dy * dy`

and compares it against the squared minimum distance. Only an actually overlapping pair takes the square root needed to normalize the separation vector.

### Attack reach

Before M96 every active-attacker/target pair called `hypot` before the 94-unit reach rejection.

M96 compares squared center distance against squared maximum reach. No square root is needed for rejected attack candidates; angular filtering and all hit/block/parry/dodge behavior remain unchanged.

## Complexity and ordering

This milestone does **not** change the O(N²) pair iteration structure. That is intentional.

Keeping the same nested-loop pair order preserves collision resolution and deterministic combat semantics while removing avoidable expensive math from the overwhelmingly common rejection path. A spatial broadphase can be evaluated separately with its own deterministic equivalence evidence.

## Focused validation

`squared_distance_rejection_preserves_collision_and_attack_boundaries` verifies:

- fighters exactly 36 units apart are not displaced;
- fighters at 35 units are separated back to at least 36 units;
- a forward attack at exactly 94 units still connects;
- the same attack at 94.25 units still misses.

The full authoritative Rust, inherited focused gates, browser combat/FFA/input-loss suite, and 512-occupant capacity evidence remain required.

## Unchanged

No pair ordering, collision shift formula, movement, attack arc, reach constants, damage, block/parry/dodge behavior, event ordering, snapshot cadence, protocol, persistence, deployment, or runtime activation changes.

## Rollback

Close/discard M96; M95 remains unchanged.

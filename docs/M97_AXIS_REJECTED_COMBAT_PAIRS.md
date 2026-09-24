# M97 — Axis-Rejected Combat Pairs

## Objective

Reduce arithmetic in the overwhelmingly common distant-pair path of the authoritative 60 Hz combat loop while preserving the exact pair order and distance boundaries established by M96.

## Base

M96 exact green head `bf4e097d2a15bc28e4fc7925886abd7c767d1778`, quality run `36025716662` PASS on bounded unchanged-head rerun job `107724063118`.

## Change

M97 adds cheap axis-aligned rejection before squared-distance work.

### Fighter separation

For each live fighter pair:

1. compute `dx`;
2. reject immediately when `abs(dx) >= 36`;
3. compute `dy`;
4. reject immediately when `abs(dy) >= 36`;
5. only then compute squared distance;
6. only actual overlaps take a square root for separation normalization.

At 512 fighters, the existing deterministic nested loop still examines the same pair order, but widely separated pairs avoid two multiplications and an addition after the first or second axis comparison.

### Attack reach

For active-attacker candidates, M97 rejects when either axis exceeds the 94-unit maximum center reach before calculating squared distance. Exact 94-unit axis reach remains valid because attack reach uses a strict `>` boundary.

## Focused validation

`axis_rejection_preserves_diagonal_collision_and_attack_candidates` proves that the cheap axis checks do not incorrectly discard diagonal candidates:

- fighters offset by 25/25 units still resolve their real radial overlap;
- a 66/66-unit diagonal target (about 93.34 units away) remains hittable when the attacker faces 45 degrees.

M96's exact 36-unit collision and 94/94.25-unit attack boundary regression remains in the inherited gate chain.

## Unchanged

No pair ordering, O(N²) structure, collision shift formula, attack arc, distance constants, damage, action timing, event ordering, networking, snapshots, persistence, deployment, or runtime activation changes.

## Rollback

Close/discard M97; M96 remains unchanged.

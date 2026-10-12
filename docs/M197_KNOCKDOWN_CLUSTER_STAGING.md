# M197 — Staging genuine simultaneous knockdowns with tick margin

## Evidence

M196 PR #223 initially failed the strict M159 real four-client test at
the knockdown overlap boundary in quality #1025. Firefox's first roll
knockdown ended at the same authoritative tick that Chrome's genuine
single LMB punish became attack-active. In one pair of trials the first
knockdown began 85-90ms ahead of the second, leaving little or no
remaining shared knockdown time after the 135ms light windup.
A fresh unchanged rerun and the M196 post-merge quality both passed,
showing the sensitivity is intermittent.

## M197 acceptance-only correction

Before the roll, use **read-only authoritative fighter positions**
from the punisher's browser to align the second victim around 18px
farther along the roller's directional x path than the first victim,
allowing a bounded 8px tolerance. Only genuine W3C A/D key-down/up
gestures move the second victim during setup; movement is bounded to
175ms per adjustment, at most three adjustments. Staging must be
confirmed from fresh authoritative snapshots before the one genuine
roll wheel and the one genuine punisher LMB are attempted. Detailed
M197_GENUINE_CLUSTER_STAGING telemetry exposes actual snapshots and
movements for debugging.

The original unmodified outcome gate must still prove:
- Exactly one actual roller wheel and one punisher LMB down/up.
- Server-authoritative ordered two-victim knockdown from the same roll.
- Real punisher attack-active after both knockdowns, *strictly before*
  the first fighter's authoritative recovery tick.
- Exactly one selected-target 34HP light hit, zero guard loss and no
  collateral fighter damage; authoritative focus/punish cues.
- No retries within any resolved exchange, forged browser events,
  relaxed comparison, synthetic combat inputs, or server rule changes.

## Qualification

Unit tests cover forward/backward projection, bounded movement,
staging within tolerance, invalid data and immutability. Full original
Rust, Node, real Chrome/Firefox W3C, FFA and 512-player capacity CI
must pass on the exact PR head, with independent post-merge main CI.
The playable build remains closed and production deployment disabled.

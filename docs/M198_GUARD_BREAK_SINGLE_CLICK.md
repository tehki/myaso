# M198 — Genuine one-click guard-break acceptance

## Post-merge failure

M197 merged after a completely green PR CI, but the independent main
quality #38219864770 failed its first M194 block-only guard-break
exchange. Firefox's actual wheel-back was recorded; Chrome's first
pointer-down in a three-click W3C burst then remained held for about
187ms despite a requested 10ms pause, and the attack did not become
authoritative until about 240ms after that first pointer-down. The
hit landed outside Firefox's unchanged 240ms short block and caused
34HP damage. This was correctly rejected.

## Acceptance-only correction

Each exchange now sends one genuine Firefox wheel-back paired with
**one genuine Chrome LMB click**, not a three-click batch that can
starve browser input processing. A guaranteed wheel-first W3C sequence, with zero additional Chrome pointer
pause, lets the real cross-browser driver delay place the 135ms light windup
between the existing 125ms parry and 240ms short-block expiry.
Independent exchanges continue until the defender's guard breaks;
at least three actual attacker clicks and three actual Firefox
wheels are required. Any parry, HP loss, wrong guard-break state,
incorrect directions, or incomplete input provenance still fails.

M198 records first-click hold duration in the CI exchange telemetry
to distinguish renderer delay from a genuine game state bug. A
deterministic planner derives the single-click and nominal timing
from combat constants, with unit tests for the block-only interval
and required minimum guard-break exchanges.

No gameplay constants or Rust/server/network code change. Full
exact-head Rust, JavaScript, genuine Chrome/Firefox W3C, FFA and
512-player capacity CI plus a separate post-merge main CI must pass.
The playable build stays closed and production remains undeployed.


## Qualification revision

PR #227 quality #1029 passed two complete guard-break repetitions but failed a third because the independent parallel wheel/click calls produced a genuine parry. Revision 2 explicitly awaits the real Firefox W3C wheel acknowledgement before issuing one Chrome W3C click and removes the previously simultaneous 45ms pause. All real-HP/guard and no-parry assertions remain unchanged.

# R2 — Restore heavy charge and grounded forward leap

User feedback (19 October 2026): current 130-unit heavy radius hits too far
compared with normal 76-unit strike; the R2 80ms LMB-to-heavy upgrade made the
previous 320ms loading feel instant. A heavy should be threatening because the
fighter makes a short **forward lunge**, not because the weapon reaches across
a large area.

## Contract

- Normal light **76** logical reach; heavy **82** logical reach (original R1
  differential +6), same client-painted arc and authoritative Rust hit profile.
- Heavy active advances the fighter along mouse facing at **240 units/sec**
  for a bounded **100ms**, no additional strike radius; at most about **24
  units** of grounded forward movement. World bounds and real fighter collision
  separation apply to the movement, with no teleport or invulnerability.
- Restore **320ms LMB hold threshold** from R1 (formerly 80ms in R2). A short
  tap commits exactly one light **on actual release**, while holding >=320ms
  commits exclusively heavy on release; no premature light or double hit. The
  server retains its existing **320ms** authoritative heavy windup, 100ms
  active, 420ms recovery and unchanged stamina/guard/damage.
- Existing instant Space+LMB jump chord and direct E heavy remain separate.
  RMB kick/run, wheel roll/block, directional dash, feint windows remain
  unchanged.
- Native feint regression must use **real W3C pointerUP before wheel-back**:
  the old same-tick gesture from M324 assumed a light was emitted on
  pointerDOWN, which is no longer correct. Preserve 70ms server window and
  strict no-HP-damage acceptance.
- Production R2 remains pinned until full real Chrome/Firefox/Rust quality,
  accepted PR merge, merged-main validation, new package, and separate
  rollback-safe rollout.

## Acceptance

Unit tests prove near-light hit range, 24-unit forward lunge, a distant target
stays undamaged and a nearby target takes one 46HP strike; server Rust tests
guard matching reach/forward velocity. LMB gesture tests prove 319ms light,
320ms heavy, no strike before release, jump-chord behavior and cancellation.
Native tests still require real WebDriver input, an actual server windup and
the unchanged fail-closed victim health checks.

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
- **Instant normal light on actual LMB pointerDOWN**, with no release-time
  wait or charge indicator on a quick tap. Keeping light 135ms windup preserves
  combat readability, parries and the 70ms feint window. Long LMB holds are
  recognized internally after **80ms**, before the light can hit; the server
  upgrades the still-unlanded light into a heavy with its genuine **320ms**
  authoritative heavy windup, followed by 100ms active / 420ms recovery. The
  80ms classification is *not* a shortened heavy loading time and cannot deal
  an extra light hit. Charge HUD appears only on recognized heavy and runs
  across the real 320ms heavy loading period.
- Existing instant Space+LMB jump chord and direct E heavy remain separate.
  RMB kick/run, wheel roll/block, directional dash, feint windows remain
  unchanged.
- Native feint regression keeps the previously qualified **authentic M324
  same-tick pointerUP and wheel-back** sequence because normal light once
  again starts at pointerDOWN. Preserve the 70ms server window and strict
  zero-damage acceptance.
- Production R2 remains pinned until full real Chrome/Firefox/Rust quality,
  accepted PR merge, merged-main validation, new package, and separate
  rollback-safe rollout.

## Acceptance

Unit tests prove near-light hit range, 24-unit forward lunge, a distant target
stays undamaged and a nearby target takes one 46HP strike; server Rust tests
guard matching reach/forward velocity. LMB tests prove the light starts on pointerDOWN, no charging indicator appears
for ordinary clicks, 80ms internal upgrade precedes light contact, the heavy
loading indicator lasts 320ms, and jump-chord/cancellation stay safe.
Native tests still require real WebDriver input, an actual server windup and
the unchanged fail-closed victim health checks.

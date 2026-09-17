# M38 Spatial FFA Recovery Tell

## Objective

Make punishable recovery readable on each remote fighter in the arena so the cue scales beyond the two-fighter HUD case into free-for-all play.

## Product behavior

Every remote fighter whose replicated authoritative action is `AttackRecovery` or `DodgeRecovery` renders an amber recovery ring around the fighter body. Local recovery never renders that remote-opponent ring.

The existing M37 two-player HUD badge remains unchanged and remains suppressed for ambiguous multi-fighter HUD attribution. M38 adds spatial attribution at the fighter itself, so each remote recovery state is readable independently.

The ring is presentation-only. It consumes existing replicated authoritative action state and does not predict recovery or grant client combat authority.

## Acceptance

The dedicated `uirecoverytell` Chrome+Firefox flight reuses the production `index.html` authoritative hit choreography. A passive external canvas probe polls a bounded 320x320 combat envelope around the local fighter and records the exact amber recovery-ring pixels while the remote attacker is authoritatively recovering. The bound safely contains a just-hit opponent plus knockback and the 29-pixel ring, while avoiding a synchronous full-canvas read inside the render callback. The observing defender must paint the ring; the attacker must not paint a ring around the non-recovering defender.

Existing deterministic M37 coverage already proves both `AttackRecovery` and `DodgeRecovery` map to visible recovery presentation while idle remains hidden. The renderer applies that same presentation predicate independently to every remote entity in the normal FFA render loop.

## Local evidence

- Coding-agent policy sentinel: PASS.
- Repository governance sentinel: PASS.
- Focused readability tests: 21/21 PASS.
- Browser/runtime suite: 39/39 PASS.
- Combat model: 9/9 PASS.
- Networking/compact snapshot suite: 24/24 PASS.
- Browser hot-path probe: replacement entity objects = 0.
- JavaScript syntax and `git diff --check`: PASS.
- Local real-browser M38 flight is unavailable on this Windows host because the Rust/browser-driver toolchain is not on PATH; GitHub FULL CI provides the required Chrome+Firefox acceptance.
## Risk / rollback

Base is frozen M37 exact head `24245fb3109aa0dfecf40a0a28c620d8e3b9888d`.

No server simulation, combat constants, attack/dodge recovery duration, damage, guard, parry/dodge windows, wire protocol, persistence, networking, public bind, deployment, or production activation changes.

Rollback is to close/discard M38; frozen M37 remains unchanged. FULL CI, including the real Chrome+Firefox M38 flight, is required before M38 acceptance.

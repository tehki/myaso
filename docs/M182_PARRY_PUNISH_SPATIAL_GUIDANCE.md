# M182 — Parry Punish Spatial Guidance

## Goal
After a successful authoritative parry, make a displayed punish target's current
reach/facing relationship readable without claiming a guaranteed future hit.

## Contract
- Preserve the existing `PARRY PUNISH #id` focus target and `Parry stun` panel
  text to maintain M147/M150 real-browser acceptance semantics.
- Add a separate context cue using replicated player/target positions and facing:
  `IN LIGHT ARC`, `FACE TARGET`, or `CLOSE FOR LIGHT`.
- Only expose the cue for a valid parry-stunned target (stunned, positive guard)
  with finite replicated positions; hide when stun ends, focus changes, or
  positional evidence is missing.
- Use the existing light-attack geometry (76 reach + 18 fighter radius, centered
  0.78π arc), with no change to authoritative simulation, stamina, stun duration,
  networking payloads or damage.
- Guidance indicates current geometry, not a guarantee the target remains
  stunned when a new 135ms light windup finishes.

## Acceptance
- JavaScript combat-readability regression tests cover reach boundary, out of
  reach, wrong-facing, valid aim, invalid state, recovered target, guard-break
  exclusion, and missing target.
- Full Rust + Chrome/Firefox quality gate is required before merge.
- Playable build remains closed.

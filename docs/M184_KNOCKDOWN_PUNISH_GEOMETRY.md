# M184 — Knockdown Punish Geometry

## Goal
Reuse parry/guard-break light-attack spatial guidance during authoritative knockdown so players can better punish shove and roll collisions.

## Contract
- Only show a position cue for a currently replicated opponent in `knockdown` action.
- Preserve the existing `KNOCKDOWN #id` focus and `PUNISH` recovery presentation.
- Use existing light hit geometry for `IN LIGHT ARC`, `FACE TARGET`, `CLOSE FOR LIGHT`, or `AIM FOR LIGHT`.
- Suppress hints while the local fighter is committed or unable to act, or once the target recovers.
- Parry, guard-break and knockdown cues remain mutually exclusive.
- These cues are advisory, not guaranteed hit predictions. No authority, damage, stun, stamina, movement, protocol or timing changes.

## Validation
- Local tests: range boundary, aim, exclusivity, recovery, disabled player, missing target.
- Full CI required after M182 and M183 merge. Playable build stays closed.

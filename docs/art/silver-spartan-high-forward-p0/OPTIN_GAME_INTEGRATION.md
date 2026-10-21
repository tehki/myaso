# Graphics 3A — authenticated-source Spartan kick multiplayer **opt-in preview** (draft)

**Parent:** original owner-approved Silver Knight art [PR #611](https://github.com/tehki/myaso/pull/611). This is a separate **integration/QA candidate**, not a release-ready game feature.

## Enable only in a manual staging browser

Default: unchanged prototype Combat renderer, which draws an honest kick telegraph and uses existing fallback for all unsupported authoritative actions. No new atlas fetch unless the operator loads the existing manual Silver Knight opt-in **and** an additional explicit source-kick opt-in:

`?knights=1&knightKickSource=1`

To roll back, remove the source-kick query flag, or remove both; no server or client persisted changes. No production toggle, no automatic rollout.

The live client already feeds the renderer the local player after ACK reconciliation with authoritative `own.action`, and the remote human from the snapshot interpolator; the existing roster distinguishes all authenticated players from future server-verified NPCs. The new source sprite only enters for action enums `kickWindup(12)`, `kickActive(13)`, `kickRecovery(14)`, and only when both staged flags are supplied. Every fighter uses the **same original Silver Knight** source asset; no Sentinel conversion or adult-body replacement.

Frame limits are hard tied to observed server-reported *phase enum*, not raw input: windup permits only authentic frames 0–2; active permits only frames 3–4; recovery permits only 5–7. Within an observed phase, bounded visual interpolation starts at the first received phase sample. It **never advances to contact without server-confirmed `kickActive`**; rejected stamina/input results do not create local ghost kicks. This is **not an exact subframe synchronization protocol**: there are 20Hz snapshots, no independently validated server action-start timestamp in the renderer contract, and phase start is observed late by variable network delay. No fabricated impact/knockback/hit confirmation, change to damaged health, hitbox, input, movement or authority.

The atlas is the original approved, source-authored **160px 8×8** PR #611 Silver Knight high-forward kick, now uniformly presentation-aligned within the same 160px tile (1.30× per frame with no clipping; original approved source remains unmodified and SHA-pinned), not a generated illustration or new Blender scene. All normal Knight assets and 120% / 100% fallback presentation are retained.

## Status and strict remaining gates

The opt-in preview does **not** prove real Greyhaven city integration, physical sole contact or actual two/four-person multiplayer phase synchronization. Genuine Chrome/Firefox multiplayer sessions with the 0.84 camera, all eight facing rotations, kick rejection, local/remote independent identities, repeated actives and recovery, server-declared opponent hit receipts and regression on normal controls are mandatory before removing opt-in. Parent protected CI, this exact-head quality and Main Orchestrator release signoff must all pass; inherited Combat M41/M33 failures are not suppressed. Graphics may not merge or deploy independently. Keep [owner issue #542](https://github.com/tehki/myaso/issues/542), [Art Director #344](https://github.com/tehki/myaso/issues/344) and [Main Orchestrator #360](https://github.com/tehki/myaso/issues/360) informed.

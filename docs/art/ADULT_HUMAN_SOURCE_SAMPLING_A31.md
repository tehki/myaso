# Graphics 3A — A3.1 reusable human source-time motion player

**Status:** source-only / review / not activated / no Silver Knight port.

## Actual result

The shared original 22-bone adult-human rig A3 source has two adult body presentations and eight authored facing directions. This small addition builds a reusable, pure visual source-frame resolver on its existing immutable A0/A1 and A2/R4 references:

- Idle, Walk and Run: use the **existing authored A0/A1 source frame indexes** 1,5,9,13 at the recorded source 60fps; loop at the derived 266.667 ms frame cycle. This is an atlas timing interpretation, not a new animation or an endorsed locomotion speed.
- Roll: selection **requires** explicit `a2` or `r4`, with existing original nonuniform source frames 1,3,5,7,9,11,15,22 and original 350ms period. Frame selection stays continuous across the 170ms contact and 180ms recovery presentation boundary.
- All directions use the same explicit `adult-human-22-v1` animation contract; the output always records original source frame, elapsed source time, atlas path, presentation, and honest source status.
- Jump/Fall/Landing, Start/Stop/Turn, Attack, Hit, Knockdown, Death, Pickup and any absent action remain **NULL**. Not replaced with Idle, not activated, not silently inferred from the existing Roll animation.
- `productionActive=false` and `footContactQualified=false` remain unchanged and are surfaced in sampled frames.

## Art A4 — still to be authored

Create genuine editable original Blender 22-bone Jump/Fall/Landing actions for both adult body presentations, with visible weight transfer, grounded toe/heel contact and coherent 8-direction projections. Retain original Source GLB, action/atlas hashes, original animation phase timestamps, and native Blender pose evidence. Do not invent source clip metadata or mark those actions available until the source files and visual quality exist. Do not apply A0/A1 procedural atlases to R3 anatomical mesh.

**Owner direction:** reusable human animations FIRST; Silver Knight remains parked. No Silver source files, Combat4 timing, server, WebTransport, Chat or World Authority modified. No PR merge/deploy without Main approval.

**Verification:** four new focused source-time tests covering original 60fps 4-frame loop, explicit 350ms Roll R4/A2, all 8 directions and no fallback for missing animation actions. Report local and CI results per exact commit; no fabricated art/Blender screenshots.

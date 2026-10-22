# Graphics 3A P0 — Full original Silver roll source-frame progression, native multiplayer

**QA-only child of the already-passed PR #731 genuine Chrome/Firefox connected jump/roll**. It changes no production source, server combat, original approved Blender rigs, assets, damage, hitboxes, frames, physics, 350ms authored roll duration, default input or identity behavior.

## Why another acceptance is necessary

The original independent native Rust-server+Chrome/Firefox [run #39722657835](https://github.com/tehki/myaso/actions/runs/39722657835) established real network-connected two-player Silver source rendering, authoritative distinct player IDs, genuine W3C Space jump and wheel-forward roll visible to both clients. **However, in that exact run, each browser observed only source roll frame 0** because the browser receipt returned upon the earliest painted cell. It did not prove any sustained roll presentation.

## Strict new test

The existing live WebDriver flow now initiates the same real W3C wheel-forward gesture in Firefox, insists that an original roll frame appears in **both native Chrome and Firefox**, then continues observing the untouched real browser sprite renderer for **490ms** after that first sample. Only real `CanvasRenderingContext2D.drawImage` calls backed by immutable first-party `silver_roll.webp` are captured. The pure validator requires for **each** browser:

- Original sprite-only 160px crop cells belonging to the authentic 8×8 roll atlas and eight approved facing directions.
- **At least five distinct roll source frame indices** across observed actual rendered samples.
- A first frame no later than index 1, and a late roll frame of index **6 or 7**.
- **At least 200ms** between actual rendered source frame samples, with browser timestamps and finite Canvas transform coordinates.

This proves **substantial authored roll-frame advancement and tail visibility** in both separately connected browsers. It does **not** verify exact server action-start tick or full 350ms authoritative action duration. Explicit receipt fields `originalSilverRollLateFramesBothBrowsers:true` and `server350msActionTimingValidated:false` preserve that distinction. The test does not synthesize any actor action states or rerender source frames artificially.

Unit negative tests reject two-frame-only, partial-early-frame, too-short-time-span and frozen-frame reports. Combined **20/20** focused original Silver source/native-visual evidence + new roll receipt unit tests pass locally. Node syntax/diff hygiene pass. The independent graphics CI sibling remains separate from the unchanged full `quality` job. Genuine connected acceptance **MUST NOT be called passed** until the new exact-head independent Rust-server browser job succeeds with the late-frame proof; a failed result is a real visual/gameplay integration blocker, not grounds for weakening tests.

## Release boundary

Prior parent #731's separate `graphics3a-real-silver-2p` job was green, but the full protected `quality` failed **inherited M173 jump-attack chord denial**; this independent Combat/Core/UI gate remains red. Real four-human arena, exact server-action-tick correlation, complete roll ground trajectory, authoritative knockdown/hit, instant pointerDOWN light/held-release heavy #696, death/respawn/reconnect, human-operated smoke and Pre-Alpha Main Orchestrator GO remain unverified. Owner-approved separate Silver Spartan Kick #611/#617 is OUT of minimal Pre-Alpha 0.1. No merge/deploy.

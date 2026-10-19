# Knight sprite presentation — v1.1 staging

This directory contains compressed WebP atlases generated from owner-supplied
**Silver Knight** and **T1 Sentinel** GLB models.

- Source pages: https://www.autosprite.io/free-3d-models/silver-knight
  and https://www.autosprite.io/free-3d-models/t1-sentinel
- Source assets were supplied by the project owner and are **not** committed.
- Source pages advertised CC0 at collection time. Confirm license provenance
  and preserve source records before public release.
- Export method: GLB skeletal animation -> RGBA PNG at 8 directions ->
  Lanczos resampling to 160 x 160 per frame -> WebP (quality 83).
- Atlas layout: each *row* is a direction ordered
  south, southwest, west, northwest, north, northeast, east, southeast.
  Each *column* is an animation phase. All assets share a single texture per clip.
- Silver: idle (4), walk (8), sprint (8), jump (6).
- Sentinel: walk (8), sword attack (8), sword block (4).

**Integration**: multiplayer-only, opt in with `&knights=1`. To revert,
remove the flag or use `&knights=0`. If a texture fails to load the renderer
falls back to the existing circles and weapon cues.

Silver is the local presentation and Sentinel the remote presentation for the
first visual experiment. This does **not** add server-side cosmetic selection,
class mechanics, animations for every combat action, or capacity evidence.

The existing world coordinates, hitboxes, combat state, authoritative simulation,
prediction/reconciliation and network protocol remain unchanged.

Renderer tests: `node --test tests/knight-sprites.test.mjs`.

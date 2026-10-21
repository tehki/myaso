# Graphics 3A — Original Silver Spartan Kick, staging atlas visual-size alignment

**Source-only visual packaging correction**, stacked on approved art PR #611 and staged game-client PR #617. This is **not** a new leg animation, character model, camera zoom, collision shape or player speed.

The first genuine native browser render of the game sprite renderer with two independent **simulated** local/remote actor state inputs revealed that the approved 160px source atlas made the in-game figure appear noticeably smaller than the existing idle Knight. The original source is not rejected: its motion is already owner approved. Instead, re-pack all source frames into the same existing 160px tile size using **one uniform 1.30× scale and one constant source-to-presentation pivot** for every frame and facing. Preserve the real 22-bone geometry and action keys in the source `.blend`, source WebP and original bake report byte-for-byte.

## Grounded comparison — alpha silhouette occupancy

All measures use authentic rendered WebP transparency at alpha threshold 16, not imagined 3D objects:

- Approved source Kick V2: **82.14px** average height inside 160px source frames.
- Existing idle Knight (same tile convention): **116.91px** average.
- Game-aligned kick: **107.69px** average, within **9.22px** of existing idle.
- Uniform scale exactly **1.30**, old atlas pivot `(80,120)` to new source-cell presentation pivot `(80,136)`. Single translation `(-24,-20)`, identical for all **64** original frames.
- Full original alpha geometry fits in each aligned 160px tile with at least 6px safety margin; **no alpha silhouette clipped**. Same eight directions and authoritative 380ms kick phases, no pose timing change.

The original staging copy was byte-identical to the source art, but visually undersized in the game. The corrected staged game `web/assets/knights/silver_kick.webp` is **derived from**, not byte-identical to, the still-unmodified authentic owner-approved source. Full SHA-256 provenance and every measured bounding box appear in [game_scale_alignment.json](game_scale_alignment.json). Reproduce from the real source with `tools/art/pack_silver_spartan_game_scale.py` using original high-forward source WebP, existing idle atlas, output `web/assets/knights/silver_kick.webp`, and report path.

All rendering remains behind `?knights=1&knightKickSource=1`; default game never loads the kick atlas. Camera and 120% presentation-scale toggle unchanged, only transparent source packing changed. This does not certify authentic Greyhaven boot sole-ground, server-started action timestamps, real 2–4 player sessions, confirmed hit effects or production acceptance. No independent merge/deploy.

## Honest browser acceptance

`web/silver-spartan-optin-game-render-review.html` is an isolated native browser *actual game sprite renderer* test with two separate local/remote **mock actor identities** and controlled synthetic action-state inputs. It renders actual approved Silver art with no imaginary Knight models. The strict Puppeteer runner verifies 5 state combinations × 8 facings = **40** checks per browser, including one actor active while the other windups, both recovery, and death/idle where **zero kick** frames can appear. It captures real browser screenshot evidence and explicitly reports `realServer:false`, `realPvP:false`, `realGreyhaven:false`. This is not 2-player network authentication or exact 20Hz server-tick proof.

Separate actual game-server Chrome/Firefox same-world combat flight is still required by Main Orchestrator with Combat/Core. Release remains HOLD.

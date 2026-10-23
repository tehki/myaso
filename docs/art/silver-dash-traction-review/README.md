# Silver Knight 140ms Dash — original Blender traction review

DRAFT ART REVIEW ONLY. Genuine 22-bone original Silver GLB posed in Blender 5.2.2. No live game, world, server, input, authority, Combat, UI or Physics changes. Original P0 dash untouched.

The new eight-phase motion conveys:
0ms ready; 10ms low compression; 26ms push-off; 45ms controlled forward drive; 72ms opposing-leg catch; 96ms brake; 119ms recovery; 140ms neutral. Uses real fractional Blender key times and eight camera directions. Correct source studio lighting and 1.29 ortho, not CSS brightness or sprint relabeling. No root displacement; actual authoritative dash movement remains Core/Combat owned.

Open silver_dash_traction_review_offline.html locally for original vs new WebP comparison (eight directions, pause, scrub, 0.25x/0.5x/1x speed). Eight-direction new GIF also provided.

Reproduce from private authorized GLB only, never check the GLB or mesh into Git:
1. blender -b -t 2 --python tools/art/author_silver_dash_traction_review.py -- --source <private-original-silver.glb> --output <temporary-frames> --samples 1 --engine CYCLES
2. python tools/art/pack_silver_dash_traction_review.py --frames <temporary-frames> --out docs/art/silver-dash-traction-review --baseline docs/art/silver-kick-dash-p0/silver_dash_p0.webp
3. Copy action-only BLEND and Blender render JSON from temporary frames into docs/art/silver-dash-traction-review.
4. node --test tests/graphics3a-dash-traction-review.test.mjs

The source-only 64 frames are nonstatic and crop-checked, but Blender's toe and ground do NOT prove physics/world traction or real in-game view. Human visual review and real server movement timing with independent clients remain mandatory before integration. Main Orchestrator alone approves merge/deploy. Dash art is not a Pre-Alpha 0.1 blocker.
# Blood & Iron — A2.3 layered alpha/WebP look-dev export

**NOT game-ready.** This review-only experiment separates A2.2 Greyhaven into an orthographic world-base pass and a roof-alpha pass, exports lossless RGBA WebP and records round-trip size/alpha measurements. It does not change the browser renderer or server.

## Reproduce from tracked A2.2 scene

Using the original Blender 4.5 LTS environment and Python with Pillow/WebP support:

    blender --background --factory-startup --python tools/art/render_greyhaven_a23_layers.py -- --base /path/blood_iron_greyhaven_a22.blend --out-dir /local/a23 --samples 4

    python tools/art/encode_greyhaven_a23_webp.py --in-dir /local/a23 --reference /path/blood_iron_greyhaven_street_a22.png

Blender renders greyhaven_a23_base.png and greyhaven_a23_roof.png at 1120 × 720 RGBA; Python converts them losslessly to matching WebP files and makes a simple compositing PNG for A/B inspection. Two JSON reports include layer classification, alpha bboxes, transparency fraction, byte counts, SHA-256, WebP visible-pixel round-trip checks and mean absolute RGB difference from A2.2 full render. This difference is informative, **not** a certification of correct depth, shadows or runtime behavior.

## Critical roof classification correction

The first A2 batch metadata used a loose gable substring. That could classify **every Gable Merchant wall and door** as roofing. This new offline export deliberately ignores that legacy tag and uses exact roof source prefixes/suffixes for the A1, A2.1 and A2.2 meshes; gable walls remain in the ground/base layer. Hidden obsolete roof courses stay hidden. Neither the old Blender scene nor its artwork/game metadata is mutated.

## Acceptance boundaries

- Opt-in A3 knights are **not** in these two exports; no assumption about sprite/game camera scale or foot-pivots.
- Projection is a frozen **review** orthographic camera; actual browser projection remains unverified. No depth-sorted dynamic roof fade.
- Shadows rendered in independent passes may differ from original full-scene lighting; ordering of independent pixels may differ at close objects. Do not present the composite as a final visual integration.
- Browser FPS, VRAM use, network responsiveness and WebP decode times remain **unmeasured**.
- No production activation, merge or authoritative world, roll timing, combat, network or door changes. Required CI must be green at the exact PR head; the separate M51 three-player combat failure must not be bypassed.

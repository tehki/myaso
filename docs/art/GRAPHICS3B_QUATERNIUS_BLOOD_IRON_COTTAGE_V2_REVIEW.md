# Graphics 3B — Blood & Iron Quaternius cottage visual review, V2

**Owner-approved source:** Quaternius Medieval Village MegaKit free Standard, CC0-1.0. Parent source integration is [draft #1042](https://github.com/tehki/myaso/pull/1042), with its dedicated Blender source CI SUCCESS at exact `0d17b588108b2c08462d19c18b37e12ef91b3dc2`. This separate child preserves that immutable green source/render evidence.

## Actual review of parent's original Blender artifact

Inspected the original 640×640 first-party `greyhaven-quaternius-cottage-day.png` and `greyhaven-quaternius-cottage-dusk.png` from original-artifact [#12595293226](https://github.com/tehki/myaso/actions/runs/40185229203/artifacts/12595293226), not a promotional render or synthetic image.

Visual strengths: original glTF geometry genuinely forms a coherent small cottage with stone, textured plaster, arch/door/window, ceramic roof, wooden crate and chimney; orthographic perspective useful for future 2.5D baking.

Issues: rich orange roof draws too much attention compared to a weathered/grounded Blood & Iron settlement; original dusk differs too subtly from day; coarse wall expanse and no immediate Silver Knight comparative image mean **no final art signoff**.

## Narrow proposed review-only correction

- Grading is applied **only inside the newly generated Blender scene**, after importing original Quaternius glTF, as named HueSaturation nodes upstream of each imported `MI_RoundTiles*` material's Principled BSDF Base Color input. Saturation=0.62, value=0.72. Preserve existing original PBR texture color and normal/roughness links, original files and pinned third-party glTF commit. Enforce nonzero genuine roof-material matches to prevent fake result.
- Keep original mesh positions, roof size, model source, original 3B Red Lion and frozen roof untouched. No game runtime, World9/3C, Rust authority, physics, Combat, HUD, network, UI, item/door/portal code changed.
- Day remains neutral full-key and sky fill. Dusk uses a stronger amber key with subdued cool-blue fill and darker world strength; Cycles CPU samples increased from 12 to 24 for reduced visible grain without unavailable OIDN.
- Require real Blender day/dusk PNGs, editable source `.blend`, source pin and all original 176 glTF validation in dedicated native CI. Inspect generated source images before any recommendation to ship.

## Acceptance

This revision is **candidate styling**, not a new licensed source or a guaranteed improvement. Compare the real generated images in context with original Greyhaven/Silver Knight art; if too dark or inconsistent, revise this isolated child, not parent or game. Full protected CI may still be blocked by unrelated original Combat/Firefox timing failures. No merges/deployments without Main0 and owner signoff.

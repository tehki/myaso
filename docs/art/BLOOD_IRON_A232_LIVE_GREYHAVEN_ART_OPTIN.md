# Graphics 3B A2.32 — opt-in Red Lion detailed facade in actual Greyhaven client (draft)

Date: 22 October 2026. Stacked on Graphics 3C #648 / World #571, **not** Combat Pre-Alpha 0.1.

## Genuine source, immutable authority

The original Red Lion Blender scene was edited by Graphics 3B in #810 (exact head 39e9ab8d23109727906cb18b4cc7cac86e425aa7): lower iron hinge strap/barrel/three rivets raised 24cm to source world Z=.96m, upper hinge unchanged Z=1.88m. Its source original full facade/roof have the same dimensions and alpha as prior art. No rewritten raster, stock imagery or magic swords.

This draft copies ONLY its actual verified day/dusk/roof WebPs into assets/environment/greyhaven/a232-review. The new src/browser/red-lion-live-art.mjs validates the exact SHA256 bytes of ALL THREE first-party source images and their dimensions, then uses the World9 canonical replacement validator to build a separate version of Graphics 3C's approved authored tile renderer which suppresses ONLY the existing Red Lion placeholder. Failure of an image HTTP fetch, hash, decode, renderer creation or offscreen paint leaves the original default unmodified world renderer selected. No fake actor, item ID or world-geometry change.

The original facades now share the exact same SINGLE camera scale as World9 tiles and fighter sprites, including when the actual view moves in X/Y: the offscreen source positions remain unzoomed until the game-world Canvas transform projects them once. Explicit camera-pan regression checks and genuine native Chrome/Firefox 100×40 world-unit camera-pan screenshots prevent drift.\n\nThe opt-in display is available only when an authenticated game's original opt-in world is already enabled: `?world=1&redlion=1`. Without both flags, the original renderer and exact existing combat/arena UI remain unchanged. `?world=1` without redlion still paints every original World placeholder.

## Real render order, source World depth

The new opt-in render loop stages the original World replacement and original facade/roof on separate detached Canvases BEFORE the live frame uses them. With World-owned footprint and visual Y4075 threshold, any genuine client-replicated actor behind the facade is drawn first, the original Red Lion art is painted next, then the unaffected foreground fighters. World9, not this client, owns the building identity, footprint and depth threshold. Actual game actors remain identical original network state and interpolation; only which original draw pass renders their existing sprite changes.

The real game still has original authoritative physics, packet validation, collision, old portal/entrance, item state and Sound/Combat model. There is no attempt to activate entry transitions or signed swords. This source is ART-SCOPED, not promoted or advertised as a finished four-machine First Playable. Even though offscreen source frames are staged, the final visible destination drawImage can still fail, and this draft does not claim device-loss transactional recovery.

## Test scope & future acceptance

- Source SHA256-pinned directly from original Blender #810, includes frozen byte-identical roof
- Fail-closed no synthetic art if original image unavailable/byte-mismatch/decode-failure
- World9 canonical identity/actor behind-vs-front placement; safe actor fallback away from Red Lion
- Source default opt-out, no Pre-Alpha change, no Item/Combat/Physics/packet changes
- Local Node source tests must be green
- Native Chrome/Firefox with real first-party WebPs, actual World #571/3C #648 cache, and camera-panned page screenshots are mandatory in the dedicated CI; genuine multi-Rust-client actor depth and source alpha gesture parity STILL PENDING (separate acceptance; do not claim it without the real run).
- Protected full quality exact combined head must be green
- Main orchestrator #360 alone owns merge/release. No deployment or production flag.

**Exact current development worktree:** art/graphics3b-a232-world3c-live-optin-20261022, based on 3C P44 #648 source `d4f05394f6d45af59ef9cc24f8487d6b5db55f8f`, not merged.

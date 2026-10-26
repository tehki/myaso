# Graphics 3B — Greyhaven cottage vs Silver Knight game-scale review

**Review basis:** exact original World9 browser screenshot and current source-authored Silver Knight idle atlas from canonical integration `12e217d24a383a22e9d8f89fde0205dfd23efbba`, compared with genuine Quaternius Blender output from Graphics 3B head `4b958a19e13bf3908a55ef4522161dcac2d24316`.

## Measured relative scale

- Quaternius source render: transparent `640×640` PNG/WebP. The real Blender alpha bounds for the day candidate are `[156,93,483,536]` — visible content `327×443` pixels.
- The local review inset crops only transparent margins for comparison, then fits the **visible building** within `230×249` pixels. This preserves the source PNG/WebP pixels; it does not crop, stretch or alter the actual game sprite.
- The original Red Lion occupies approximately the same `~250px` vertical span in the captured `960×540` World9 review view. That makes the cottage a like-for-like building-size candidate rather than a miniature or oversized prop.
- The authored Silver Knight atlas uses `160×160` frames and the approved `1.20×` visual presentation scale, producing a `96×96px` frame. The opaque character itself occupies roughly `67px` of height in the sampled south-facing idle frame; the cottage is about `3.7×` the knight's visible height. This is a plausible house-to-player proportion for an isometric/top-down settlement.

## Style finding

The Knight's steel remains cool blue-gray, while the cottage's roof is muted weathered terracotta and the facade is wood/plaster. That warm/cool separation is compatible with the existing muted olive/stone Greyhaven ground palette, without tinting the character art or the canonical Red Lion. The 49° elevated orthographic view keeps the roof readable and the front door visible; neutral daylight fill avoids a strong blue cast. The roof's review-only Hue/Saturation node is `0.50 / 0.78 / 0.70`; original Quaternius PBR image maps, mesh data, and door transform remain untouched.

The Quaternius building still has richer 3D texture detail than the original hand-painted Red Lion and the sprite-rendered Knight. **Do not silently replace the canonical Red Lion with it.** If accepted, this should be introduced as a distinct architectural variant after a game-size in-context art review, with all other first-party assets and the original Red Lion preserved.

## Scope and acceptance

This is a visual scale/palette assessment only. It grants no building ID, World9 placement, collision/occupancy, door interaction, portal, server authority or release permission. Silver Knight sources were read for scale comparison only and were not edited. Main 0 and the owner retain final visual approval; exact-head protected quality and canonical integration retest are required before any release.

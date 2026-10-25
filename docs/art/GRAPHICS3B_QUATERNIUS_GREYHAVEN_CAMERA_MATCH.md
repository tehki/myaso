# Graphics 3B — Quaternius cottage camera and visual-scale review

**Continuation after verified door fix:** stacked on [draft #1046](https://github.com/tehki/myaso/pull/1046), exact door geometry fix at `f51d207e3bbeb6bc714c54bb03affcf867f4a149`.

## Visual review finding

The actual previous Chrome/Firefox native review screenshots showed a scale and perspective mismatch: the cottage preview had a strongly visible right side wall and looked substantially smaller inside the comparison card than the canonical Red Lion facade. This was partly caused by the square 640×640 transparent sprite being scaled to the inset as a square without cropping its alpha margins. It was not a World9 bug.

## Isolated artist-only changes

- Set the **Blender bake camera only** to orthographic position `(3,-12,17)`, target `(0,0,2.8)`, ortho scale `12.8`. This raises the view to roughly 49° elevation and uses only a slight side angle: the roof becomes more prominent, the front gable is foreshortened, and the facade remains readable—closer to the original hand-painted Red Lion composition than the initial front-on test. These camera values are explicit in the manifest and are validated by the Blender runner and sprite baker. No runtime camera, player view, world map or existing Red Lion sprite changes.
- Keep the muted weathered-clay roof grade, original PBR maps, door alignment transform, mesh geometry, source selection, render resolution and transparent 640×640 canvas unchanged. Day fill is now neutral cool-gray at 420 energy rather than blue at 550. The review-only roof node is shifted slightly warmer (Hue 0.50, Saturation 0.78, Value 0.70) to preserve source hue while strengthening the warm red-clay saturation and retaining a slightly weathered value; all source PBR images and links remain unchanged. Dusk retains its deliberate cool-blue fill. Re-render original CC0 meshes from real Blender and re-bake true source WebPs.
- In the **localhost-only editorial comparison**, crop transparent margins using the verified sprite alpha bounding box and scale the *visible building* to a comparable height (up to 230×249 pixels) to the original Red Lion at the same 0.84 review zoom. The output sprite file itself is not cropped or stretched. This makes the side-by-side comparison meaningful while preserving the existing pixel-isolation assertion (zero pixels changed outside the review inset).

## Gates

Native Blender actual source import and world-space door geometry, day/dusk PNGs, alpha-preserving compact WebP, original Quaternius creator archive provenance, and native Chrome+Firefox review all need to pass on the same exact head. Human review still required for final palette/lighting and Silver Knight consistency. No actual placement in World9, new building ID, physics/collision, interactive doors/portals, server ownership, combat or production behavior is included. Main0 must separately verify protected quality. Draft only; no merge/deployment.

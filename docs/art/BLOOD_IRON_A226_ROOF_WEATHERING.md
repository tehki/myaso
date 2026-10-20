# Blood & Iron A2.26 — Red Lion clay roof weathering

**Status: source-derived architectural art review, not a production building.**

The original A2.22 Blender-derived Red Lion was baked into lossless facade/roof WebPs and received A2.24 facade relief. A2.26 makes one further narrowly scoped **appearance-only** improvement to its original baked medieval clay roof: gentle earthy variation across tiles, worn ridge lighting and a subtle eave darkening. This is intentionally restrained at the 640×640 game review scale.

## Reproducible outputs

\`tools/art/paint_greyhaven_a226_roof.py\` consumes the checked-in A2.24 raster hashes and camera/door contract from A2.25. It writes only to \`assets/environment/greyhaven/a226-review/\`:

- \`red_lion_a226_roof.webp\` — separate **lossless RGBA** refined roof; input/source remains intact.
- \`red_lion_a226_base.webp\` — **byte-for-byte copy** of the A2.24 facade. No facial, doorway or window rework.
- \`greyhaven_a226_roof_weathering_comparison.png\` — original source art comparison at the real original 640×640 review scale, not a live client screenshot.
- \`greyhaven_a226_weathering_report.json\` — pinned input/output SHA-256 hashes and direct image/alpha measurements.

On the authorized Windows workstation with Pillow 12.3, **39,133 visible roof RGB pixels changed**, with **4.0007 average absolute RGB channel difference**, **16 maximum channel difference**, and **0 alpha pixel differences**. The roofing silhouette, canvas crop and original world-XY visual door pivot do not move. The **facade WebP remains binary-identical**, and the original source .blend is neither opened nor saved by this painter.

Run:
\`\`\`sh
python tools/art/paint_greyhaven_a226_roof.py
node --test tests/art-direction-a226-roof-weathering.test.mjs
\`\`\`

A2.26 is a material/look-development pass, **not** a substitute for the needed roof/gable silhouette review or true front-to-back actor/wall occlusion tests. The PNG is a Pillow composition, not a Chrome or multiplayer screenshot. The original Chrome A2.24 regression evidence remains authoritative only for its own original assets. A2.26 must undergo separate real-browser and performance acceptance before runtime integration.

**Integration boundaries:** art placement in unmerged World PR #336 remains a proposed visual anchor; server portal, collision and interior authority belong to Core 8C. A2.26 has no runtime imports, game interactions, multiplayer authority, automatic roof fade or production activation. Keep draft parent Graphics PR #350 and stacked #411 guarded by exact-head CI, rebase/current-main gate and visual review before merging.

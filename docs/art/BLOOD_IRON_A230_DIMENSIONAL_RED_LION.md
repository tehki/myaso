# Blood & Iron A2.30 — Original Blender dimensional facade craftsmanship

**Graphics 3B · October 21, 2026 · DRAFT art source and review only.**

Owner / Graphics Orchestrator priority: **architectural DETAILS, realistic LIGHTING response, coherent visual QUALITY — not roof polishing**. A2.30 replaces another painted-detail iteration with actually editable, original-space **Blender 5.2 source meshes** along the Red Lion entrance facade.

## Source-authored, editable additions

The separate derived scene \`assets/environment/greyhaven/a230-review/blood_iron_red_lion_a230_joinery.blend\` is created from unchanged A2.22 \`blood_iron_greyhaven_a22.blend\` using \`tools/art/build_red_lion_a230_joinery.py\`.

- 35 new hand-placed and beveled **oak and limestone 3D mesh objects**: projecting door jambs, lintel / carved edge, threshold stone, hand-forged pins, mullions, upper/lower rails, limestone sills and individual staggered corner quoins.
- Original Red Lion's **17 meshes, 4,318 vertices and their material assignments/world XYZ values preserved**: independent \`verify_red_lion_a230_source.py\` reopened source and derivative and confirmed vertex coordinates + material signatures are identical. Original source \`.blend\` SHA-256 pinned; no source overwrites.
- No changes to any roof mesh, texture or art-only World/door proposal. All added geometry is **decorative, not collision**.
- New derivative saves original physical 3D geometry first; only subsequent non-saved Cycles reviewer renders shear mesh height into the original A2.22 2.5D elevation, keeping **+X right, +Y down**, real zoom 0.84, 0.025m/world unit and visual door pivot (320,320).

This is not a production-ready 3D building or real lighting simulator. Blender 5.2 Cycles 4-sample desktop rendering was used for art QA; this is not game performance data.

## Quantitative facade change / source comparison

Reproducible \`validate_red_lion_a230_material.py\` decodes the **same-source Blender-rendered** old/new 640×640 transparent facades, flips Blender's source Y into the actual game positive-Y-down bitmap, restores the exact original 228×297 crop and (-114,-269) original door-relative drawing offset, emits independent original/dimensional lossless WebPs, and compares source to result.

- Real source-scene render changed **15,192 RGB pixels**, **69 alpha pixels**, of which 51 newly visible outside the old alpha; importantly the overall facade alpha bounds remain **[209,54,431,345]** in the game canvas.
- The **roof WebP remains copied byte-for-byte** from the existing historical A2.26 material. The roof is not a current graphics priority and receives no new design work.
- Real Blender Cycles source-to-dimension comparison is at \`greyhaven_a230_blender_dimensional_compare.png\`, with \`greyhaven_a230_geometry_proof.json\`, \`greyhaven_a230_original_source_integrity.json\` and \`greyhaven_a230_material_validation.json\` recording source/pipeline SHAs.

## Native Chrome and Firefox source-art presentation

\`web/greyhaven-a230-dimensional-browser.html\` is a standalone opt-in **local** reviewer with source and new dimensional facades, original unchanged roof, and independently pinned authentic Silver Knight PR #326 at 120% (96px idle). Uses the checked-in \`src/browser/arena-viewport.mjs\` projection, not a hand-faked camera.

Repro harness \`tools/art/verify_greyhaven_a230_browser.mjs\` runs actual Chrome 154.0.8037.99 + Firefox 153.4.0 and captures one at the visual art door and one at (+80,-10) world offsets for each browser: **4 real native screenshots, zero browser/network errors**. The viewport-composited street variant changes ~13.5k RGB pixels with exact game XY placement and no new onscreen alpha differences after opaque background draw.

**Limits:** these are original source-asset review canvases, not the actual shared-world runtime. Automatic roof occlusion, real multiplayer camera/depth order, interiors, 3C ambient lighting, Combat readability, mobile GPU budget and production FPS remain unvalidated.

## How to reproduce on the authorized workstation

\`\`\`powershell
$repo = 'D:\myaso-graphics3b-a228-20261021'
Set-Location $repo
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' -b 'assets\environment\greyhaven\a22-review\blood_iron_greyhaven_a22.blend' -t 2 --python-exit-code 7 --python 'tools\art\build_red_lion_a230_joinery.py' -- --source 'assets\environment\greyhaven\a22-review\blood_iron_greyhaven_a22.blend' --outdir 'assets\environment\greyhaven\a230-review' --manifest 'assets\environment\greyhaven\art-manifest.v1.json'
python tools/art/validate_red_lion_a230_material.py
node --test tests/art-direction-a230-dimensional.test.mjs
\`\`\`

Then set the local Puppeteer module and Chrome/Firefox binary paths and run the native browser harness with an **independent exact-head Knight PR #326 checkout**.

The parent Graphics #350, its stacked #411 and A2.28–A2.30 draft #443 remain subject to independent current-base compatibility review and strict CI, owner/Graphics Orchestrator art signoff, Graphics 3C lighting coordination and central #360 integration approval. A2.29 exact-head quality failed unrelated protected **M145 spatial recovery handoff**; do not misstate green or weaken it. **No merge/deploy.**

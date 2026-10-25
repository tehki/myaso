# Graphics 3B — Quaternius Medieval Village MegaKit (CC0, FREE Standard)

**Owner approval:** 25 Oct 2026, use *Quaternius — Medieval Village MegaKit* for myaso.io. **Scope:** isolated Graphics 3B artist review for the P1 Greyhaven architectural environment. Not a Pre-Alpha Combat dependency; no public alpha, no deployment, no protected-main merge.

## Provenance, exact edition and legal

- **Creator:** Quaternius.
- **Creator's original product:** https://quaternius.com/packs/medievalvillagemegakit.html
- **Creator-uploaded free Standard edition:** https://opengameart.org/content/medieval-village-megakit (176 of the advertised 304 modular models).
- **License:** Creative Commons Zero 1.0 Universal (CC0-1.0), permits commercial use, modification and redistribution; attribution not legally required. https://creativecommons.org/publicdomain/zero/1.0/
- **Actual source checkout for artist review:** read-only, glTF-only community mirror https://github.com/J-Ponzo/gltf-medieval-village-megakit pinned in a Git submodule at exact commit `21104b4045261c28fc312360841ed1a7b0ac8782` (dated 24 Apr 2025). This **is not the creator's canonical download**; no assertion of byte-identical equivalence with the creator-uploaded zip has yet been verified.
- The free Standard edition comes in **OBJ/FBX/glTF** from the creator. The paid Source edition additionally includes .blend and engine projects, not acquired. The review-only .blend artifact here is produced independently by importing the original free Standard glTF, not copied from the paid pack.

Keep this page and the submodule's own `LICENSE` file with the source. **Before moving derivative sprites into a release branch**, independently download the creator's Standard archive, compare selected model/material byte hashes or rendered parity against this pinned mirror, and record the comparison. No payments or paid tier assumptions.

## Real source use in Greyhaven

This draft uses actual modular glTF meshes and original companion .bin buffers and original shared PBR textures. The current artist prototype is a small timber/plaster/stone cottage using 14 genuine modular placements from 11 Standard source models, detailed in `assets/environment/greyhaven/quaternius-standard-preview/manifest.json`. It has a rounded doorway, shuttered window, masonry back wall, timber-framed sides, tiled roof and chimney.

**Blood & Iron direction:** muted plaster, rough stone, dark timbers, aged roof and restrained warm day/dusk lighting. Reuse, do not overwrite, original creator PBR maps. Blender renders day/dusk PNGs and an editable source .blend for artist review. The direct 3D source is NOT sent to game clients or integrated as a full 3D world; after visual approval, Graphics 3B may bake optimized 2.5D material-aligned views to a separate opt-in original World9+Graphics3C renderer.

Run the exact GitHub art-source checkout (or use the creator's archive once byte-equivalent provenance is approved):

```bash
git submodule update --init third_party/quaternius/medieval-village-megakit-standard
node tools/art/verify_quaternius_standard_source.mjs
blender --background --threads 2 --python tools/art/render_quaternius_greyhaven_preview.py -- \
  --manifest assets/environment/greyhaven/quaternius-standard-preview/manifest.json \
  --source third_party/quaternius/medieval-village-megakit-standard/glTF \
  --output .artifacts/quaternius-greyhaven
```

The dedicated Graphics 3B native-independent art workflow checks source identity, all 176 glTF files, real .bin lengths and texture files, then renders an actual editable cottage in Blender and preserves real day/dusk PNG + Blender source artifacts. CI failing must NOT be silently passed.

## Safety and authority contract

- **DO NOT change** the signed-off Red Lion A2.32 day/dusk facade, original A2.26 frozen roof, World9 existing town and Blacksmith placements, canonical Red Lion occlusion depth, Core8C real Rust World or collisions.
- No client-owned buildings, unapproved map replacement, player housing deed, interactable door/portal, inventory/sword state, NPC navigation or actor collision changes. The scene is an independent **review artifact**, not a game object. World9/Core8C/Physics6 must approve legal dimensions, portal interaction and collision before any live Greyhaven building integration.
- Avoid a new engine/framework or always-on 3D dependency. P0 Combat Pre-Alpha remains unchanged.
- Keep original model source as a pinned external submodule to avoid inflating the normal game checkout; `actions/checkout` for normal builds does not initialize it. Browser clients do not download it.
- **Artist acceptance not yet obtained:** judge full visuals including roof scale, original Knights lighting and Blood & Iron tone from native artifact screenshots, and compare day/dusk and performance before releasing.

**Current verdict: P1 ART SOURCE INTEGRATION DRAFT / HOLD.** Permission to use these CC0 assets is not authorization to merge, change original Red Lion or deploy.

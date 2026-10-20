# Blood & Iron A2 — Silver Knight / T1 Sentinel against Red Lion

**Art-QA only; no world runtime, no server, no combat changes.**

## Why this comparison is necessary

The approved A1 tavern source is 6.25 × 4.25 authoring meters, with an ~2.2 m oak entrance door. The actual game uses a two-dimensional camera at zoom 0.84, so neither an arbitrary Blender orthographic export nor a Blender character origin can be assumed to match player hitboxes/pivots in the browser. This task evaluates a fixed **provisional visual height** of 1.80 m (Silver Knight) and 1.84 m (T1 Sentinel), while deliberately leaving game unit scale unchanged (0.025 m per world unit only in art authoring).

The owner-supplied A3 GLBs had a misleading untextured 42-vertex **Icosphere** proxy with a 2 m diameter. A first pass measured this sphere and rendered both humanoids much too small. The QA script now explicitly hides the proxy and measures the skinned mesh only. Actual original mesh heights were **0.99289 m** (Silver) and **0.97944 m** (T1). To reach the provisional 1.80/1.84 m presentation height, uniform scene-only scales are **1.81289** and **1.87862**, respectively.

## Reproduce (Blender 4.5.14 LTS, CPU renderer)

Build A2 base environment first as documented in [BLOOD_IRON_A2_GREYHAVEN.md](BLOOD_IRON_A2_GREYHAVEN.md). Run:

    blender --background --factory-startup --python tools/art/compare_a3_knights_to_greyhaven.py -- --scene /path/to/blood_iron_greyhaven_a2.blend --silver /owner/path/silver-knight-roll-A3.glb --sentinel /owner/path/t1-sentinel-roll-A3.glb --out-dir /local/art-review --render --samples 4

Output is deliberately local:
- blood_iron_knights_local_review.blend (owner's source assets inside: **DO NOT COMMIT** until provenance permits).
- blood_iron_knights_scale_a2.png (actual skinned knight bodies in idle pose next to Red Lion).
- blood_iron_silver_roll_a2.png (Silver Knight original A3 roll at imported clip frame 5, T1 hidden from this render).
- blood_iron_sentinel_roll_a2.png (T1 Sentinel original A3 roll at imported clip frame 5, Silver hidden from this render).
- The two roll poses are deliberately separated in stills: two simultaneous imports converged/visually overlapped in the first comparison, making shoulder contact unreadable. This is composition-only isolation, not an animation modification.
- blood_iron_knights_scale_report.json (rig count, source/target scale, feet alignment, clip provenance).

Both rigs have 22 bones. Imported glTF action range for A3 roll is **0.4–8.8 frames** (Blender import), so QA uses frame 5. All imported NLA tracks are muted for explicit pose selection; **source GLBs and A3 approved 350 ms pose timeline remain untouched**. Gameplay roll remains 170 ms plus 180 ms recovery.

## Remaining gates

- Visually inspect both actual PNG renders and confirm relative knight/door proportions, no clipping through door or barrels. Review stills are *not* proof of sprite/game alignment.
- Compare the same exact view against the optional knights and world online branches after their independent approvals.
- Lock camera orthographic angle only after examining actual browser screenshots with both characters and walls; bake roof and wall layers separately with stable feet pivots and verified pixel budgets.
- Visual improvements to A3 roll articulation remain separate from this non-invasive review. Do not replace approved A3 without A/B owner sign-off.
- Production, merge and authoritative world/collision/net changes are completely out of scope.

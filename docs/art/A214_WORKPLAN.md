# Blood & Iron A2.14 — Minimum foot-vertex anchor stability study

**Result: Do not anchor live knight sprites to the lowest skin-weighted foot vertex.**

A2.13 sampled original, unchanged Silver Knight and T1 Sentinel A3 GLB rigging and the evaluated, deformed foot-weighted meshes in Blender 4.5.14. The independent A2.14 Node analysis consumes those committed source-provenance reports; it does not re-export models, move sprites, alter collision or change networking. A2.14 checks whether the *identity* of the lowest weighted mesh vertex is consistent across the original eight sampled A3 roll phases.

## Results (original 60 fps source frames 1,3,5,7,9,11,15,22)

| Source rig | Unique minimum vertex IDs, left / right | Changes between adjacent sampled frames, L / R | Frame-7 min weighted-region lift above frame-1 reference, L / R |
|---|---:|---:|---:|
| Silver Knight | 5 / 5 | 5 / 5 | 0.51808 / 0.52461 |
| T1 Sentinel | 6 / 7 | 6 / 7 | 0.31607 / 0.40672 |

These are *source model units*, not calibrated game-world meters. The minimum vertex changes identity as the skinned character rotates and tumbles. Both feet on both models return to their **original minimum vertex ID** in the last frame, but the intermediate index hops disqualify use as a stable, fixed visual foot-pivot anchor.

Importantly, even a single stable vertex ID would not by itself establish sole contact. The A2.13 skin-weight selection (sum of Foot/ToeBase weights ≥0.35) can include armor, cloth and other geometry. It does not separately identify the shoe's actual underside. The frame-1 minimum weighted-foot Z is only a relative reference, **not an independently measured arena floor**. During a forward roll, ground may contact the shoulder or arms rather than the feet.

## Art-only browser visualization

The opt-in page at `/web/knight-ground-a214-preview.html` plots the **measured lowest skinned foot-region Z proxy** for both models, with markers when the minimum vertex ID changes. Its data comes from `web/assets/knights/a214-review/knight_a214_anchor_stability.json`, produced by:

```bash
node tools/art/analyze_knight_a214_anchor_stability.mjs
```

To inspect locally, from a checkout of the knight PR branch (not the production deployment), run:

```bash
python -m http.server 8080
```

Then visit `http://localhost:8080/web/knight-ground-a214-preview.html`. The page has no game imports, source GLBs, live actors, network authority, collision or model modifications. If another server is already bound to port 8080, stop it or use a different port.

## Acceptance boundary

- Current [knight PR #326](https://github.com/tehki/myaso/pull/326) remains unmerged. The last known A2.13 CI was still in progress when this analysis began; newer commits require fresh exact-head checks.
- Preserve 120% opt-in renderer dimensions (96 px standing / 134 px rolling), reversible 100% flag, 350ms A3 animation, original source sprites and source rigs.
- Do not interpret the proxy clearance numbers as ground collision penetration or authoritative foot-contact statistics.
- True contact calibration requires anatomical outsole geometry (separated from weighted armor), a verified floor plane and contact for feet, shoulder and arms across the original roll timing, plus multiplayer player/door XY calibration. Greyhaven's 3/4 Red Lion art in separate PR #350 is not world-XY aligned.
- No production deploy or merge without all current-base exact-head quality checks and separately explicit deployment authorization.

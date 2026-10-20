# World & Gameplay D12 — Sampled-Clear Rejoin on the Moonvale Sketch

**Status:** independent draft preview milestone, stacked on D11 #422 → D10 #410 → D9 #400 → D8 #398 → D7 #394 → D6 #389 → D5 #384 → D4 #380 → D3 #371 → D2 #366 → D1 #359 → World Foundation #336. No merge, server authority, economy changes, deployment or live navigation.

## Player improvement

D11 already supplied a textual "sampled-clear direct approach" hint for nearby off-trail positions, limited to one static authored-world collision sample. D12 makes that **same chosen rejoin point** visible on the existing optional M-map. When M is open and D11 has a current rejoin hint:

- An **aqua/cyan dashed line** connects the player's current preview position to the sampled-clear corridor point.
- A **hollow cyan circle** marks that point on the certified amber milestone trail. Existing map conventions remain unchanged: amber marks expedition destination and milestone corridor; white marks the player.
- A short legend distinguishes the sampled-clear cue from the existing certified milestone path, and reminds the user that this is **static preview geometry, not authoritative movement or collision safety**.
- If D11 rejects the approach, map shows no dashed return or marker (including blocked map positions, wrong interior, idle/finished quests, incomplete initial stage, near-trail players or positions more than 256 world units from the trail).
- Pressing M again hides map and legend. Reload or switching to an initial route without a D9 corridor clears the guidance, with no data saved.

## Architecture

- `src/world/local-rejoin-sketch.mjs`: a simple, pure Canvas2D overlay renderer `drawLocalRejoinSketch(ctx,mapId,playerX,playerY,hint,size)`, anchored to D8's 248px existing map scale and authored fixed world bounds. It validates finite input, consistent player/hint distance, map and reasonable size; it draws only a dashed cyan segment and one ring, restoring Canvas2D state through `save`/`restore`. It neither computes paths nor calls D11's sampled collision routine.
- `web/world-preview.html`: passes the exact D11 hint already used by the textual status to the renderer **within the same 250ms refresh**, only after the existing D8 map has been drawn and only while the optional sketch is visible. No second sampled-clear search, extra server request, new Canvas element, animation loop, steering or runtime A*.
- `tests/world-rejoin-sketch.test.mjs`: six focused tests for pixel-coordinate scaling, valid rejoin and line, safe Canvas save/restore/dash reset, wrong-map, nonfinite, stale and forged inputs, absent/near/distant hints, no network/authority wiring and single-hint browser composition.
- `.github/workflows/ci.yml`: additive D12 gate. No quality check, Combat test, Rust gate or live network assertion is relaxed.

This is visualization only, *not an independent geometry certifier*. D11's discrete 4-unit sampling against D2's static preview occupancy is retained. Its returned hint is not proof of continuous collision, dynamic-door/actor access or a safe rejoin under real server tick physics. A forged object could paint a false marker but cannot authorize player movement; the preview only passes D11-produced hints and validates their positions.

## Verification

```
node --test tests/world-rejoin-sketch.test.mjs tests/world-safe-rejoin.test.mjs
node --check src/world/local-rejoin-sketch.mjs
# full JavaScript suite + exact-head GitHub quality
```

Manual Chrome: Open `/web/world-preview.html`; choose Fallen Watch at the Red Lion, press M. Starting near the certified path should show amber milestone route with **no cyan rejoin marker**. Walk south until D11 shows `Off trail by N units` and `Sampled-clear direct approach N`. Without reopening the map, within the normal 250ms refresh the cyan line and hollow return circle appear. Close the map, and the legend disappears; choosing an expedition with no completed first stage clears the cyan cue; a reload resets all session-only map state. Browser exceptions must remain zero.

## Integration & release

Central Development Center owns stack rebasing, strict CI repair, merges and releases. The existing strict ancestor Combat blockers were M151 (#336), M144 (#380), M171 (#394), M194 (#389/#398/#400). D10 #410 exact-head CI passed. D11 #422 exact-head CI was still running when D12 development began; recheck it before integration. Nothing in D12 is live multiplayer or persistent game state.

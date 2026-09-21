# M62 - Spatial FFA Threat Markers

## Objective

Move the completed M54-M61 incoming-threat model from text-only HUD awareness into the combat space itself.

M62 paints compact primary and secondary directional chevrons around the local fighter while genuine authoritative attacks threaten that fighter. The markers make simultaneous FFA pressure readable without requiring the player to look away from the fight.

This is presentation only. It does not choose a response, turn the fighter, block, parry, dodge, or change combat resolution.

## Authority source

M62 reuses the exact threat state already computed by the M54-M61 HUD path:

- M54-selected primary attacker;
- M56-selected secondary attacker;
- M57/M58 primary and secondary bearings;
- M55 threat count.

No additional entity scan is introduced.

The marker draw happens after the existing HUD update in the same render frame and reads the cached threat cue state.

## Presentation

The local fighter remains centered by the online camera.

Primary threat:
- radius: 62 canvas pixels from the local fighter;
- heavier warm chevron.

Secondary threat:
- radius: 78 canvas pixels;
- lighter smaller chevron.

Bearing maps directly to screen placement:
- `FROM LEFT` -> marker left of the local fighter, pointing inward;
- `FROM RIGHT` -> marker right, pointing inward;
- `FROM ABOVE` -> marker above, pointing inward;
- `FROM BELOW` -> marker below, pointing inward.

The secondary marker is painted only when the existing simultaneous-threat count is greater than one and a valid M56 secondary identity/bearing exists.

## Real-browser acceptance

Scenario: `uithreatmarkers`.

It reuses the stabilized three-browser authoritative FFA choreography:

- Chrome #1 attacks from the left using genuine pointer input;
- Firefox #2 is the center observer;
- Chrome2 #3 attacks from the right using genuine pointer input.

The M62 gate preserves all M55-M61 semantic requirements and adds passive rendered-canvas proof.

A requestAnimationFrame sampler reads actual canvas pixels around the local fighter while the authoritative threat window is live.

Required evidence:
- the center observer paints the primary marker color;
- the center observer paints the secondary marker color;
- each marker reaches at least 8 exact-color pixels;
- neither attacking client paints either threat-marker color;
- two genuine pointer commits and authoritative simultaneous-threat evidence remain mandatory.

The sampler does not inject state or alter timing, combat, facing, positions, or browser inputs.

## Performance boundary

M62 adds no entity iteration and no per-frame object allocation in the render path.

Marker placement is a four-way scalar branch over the already-cached bearing plus a small canvas path.

It adds:
- no protocol field;
- no snapshot bytes;
- no server work;
- no new DOM mutation;
- no combat-model mutation.

## Unchanged behavior

M62 does not change:
- attack, block, parry, dodge, guard, stun, death, respawn, or scoring rules;
- threat eligibility or priority;
- primary/secondary identity selection;
- bearing or guard-arc semantics;
- server simulation;
- network encoding;
- persistence;
- deployment/runtime configuration.

## Base / rollback

Base is frozen M61 exact head `2c51cf621501d72defb56b18f5ce064535b0772b`, validated by quality #253 / run `35627658396` FULL PASS.

Rollback is to close/discard the M62 branch/PR. M61 remains unchanged.

# M45 - Spatial FFA Hit Tell

## Objective

Make a non-lethal authoritative hit unmistakably attributable to the correct remote fighter in free-for-all combat.

## Player presentation

- A remote fighter gains a brief orange impact ring only when replicated authoritative HP decreases and remains above zero.
- The local damaged fighter never paints this remote-only marker around itself.
- Guard-only loss does not trigger the marker.
- Lethal damage defers to the M44 defeat tell instead of stacking both markers.
- Respawn HP restoration does not trigger the marker.
- The tell expires after a bounded 280 ms presentation window.
- No damage, hit detection, combat timing, or authority moves client-side.

## Real-browser acceptance

The dedicated `uihittell` Chrome+Firefox flight reuses the proven M32 production-page hit exchange with genuine movement and LMB input. Passive requestAnimationFrame samplers are armed before combat.

The flight passes only when the attacker observes at least 24 exact-color M45 pixels around the damaged remote fighter, the damaged local browser observes zero remote-only hit pixels, the existing authoritative 34 HP hit feedback remains intact, and the marker clears after its bounded presentation window.

## Scope / risk

Base is frozen M44 exact head `7f8361a5ff1b9a6ce7653549fe53aa88447876da`.

M45 changes presentation, deterministic readability tests, real-browser acceptance, CI, and documentation only. It does not change server simulation, attack timing, damage, guard, death/respawn, combat geometry, wire protocol, networking, persistence, public bind, deployment, or runtime activation.

Rollback is to close/discard M45; frozen M44 remains unchanged.

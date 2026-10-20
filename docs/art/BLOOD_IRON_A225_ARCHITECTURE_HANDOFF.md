# Blood & Iron A2.25 — Red Lion architectural visual handoff

**Scope:** a machine-readable and SHA-verified architectural contract for Graphics 3B → Graphics Orchestrator, World & Gameplay and Core 8C. This is **not a playable building release**.

The file `assets/environment/greyhaven/red-lion-a225-architecture-handoff.json` binds the original A2.22 Blender-derived geometry and A2.24 facade/roof rasters into one review package. Unlike a loose screenshot, its tests verify the actual checked-in WebP SHA-256 bytes, crop sizes, visual drawing offsets, camera zoom, source ground basis and the proposed placement in the World PR #336 art manifest.

The proposed exterior is **250×170 world units**, centered at **x=4365**. Its proposed visual door is **(4365,4075)**, **25 world units (0.625 authored meters)** south of the exterior rectangle's south edge. This offset is reported explicitly rather than silently relocating the door or inventing a collision footprint. The visual door canvas pivot remains **(320,320)**. Full facade and roof original image silhouettes and alpha are unchanged.

**Review-only art package:** facade WebP **228×297** at offset **(-114,-269)**, roof WebP **238×197** at **(-119,-283)**. SHA references and alpha bounds are checked against A2.24. The independent Silver/T1 knight sprites from PR #326 are not copied.

**Deliberate release boundary:** no runtime imports, player teleport, roof depth sorting, automatic fading, collision, server-validated entrance, multiplayer interior or production deployment. Visual geometry is not gameplay authority. World & Gameplay must approve the map placement/door contract, and Core 8C must supply and validate actual portal, zone, collision and multiplayer semantics before activation.

Run the isolated validation with:

```sh
node --test tests/art-direction-a225-architecture-handoff.test.mjs
```

This A2.25 handoff can be reviewed as a stacked draft after Graphics PR #350; it cannot make the parent current-base or CI-clean.

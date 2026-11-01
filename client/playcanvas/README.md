# MYASO.IO — PlayCanvas Client Alpha 0.1 Spike

**Status:** isolated source-only feasibility prototype. This is not the live client and is not connected to production.

## Pinned stack

- PlayCanvas Engine: `2.23.3`
- Vite: `8.3.5`
- Node.js: `22.18+` (the current X230i development node is `26.8.1`)
- Renderer: request WebGPU first; PlayCanvas falls back to WebGL 2 when WebGPU is unavailable.
- Resource handlers are explicitly registered for GLTF containers and textures.

## Run

```bash
npm ci
npm test
npm run build
npm run smoke:browser
npm run dev
```

The dev server binds to `127.0.0.1:4174` only. The production preview binds to `127.0.0.1:4175` only. Linux CI runs the headless Chrome smoke and uploads its screenshot. On Windows, the CLI smoke explicitly skips because the installed Chrome headless `--dump-dom` command emits no DOM; Windows acceptance is checked separately with Playwright-driven Chrome and Firefox.

Use `http://127.0.0.1:4174/?view=red-lion` to inspect the close-up Red Lion asset assembly.

## What this slice proves

- PlayCanvas Engine V2 bootstraps in a browser.
- WebGPU is preferred and WebGL 2 fallback is delegated to the engine's supported graphics-device creation path.
- The isometric visualization consumes the designer-authored World9 map source from [World9 PR #1148](https://github.com/tehki/myaso/pull/1148), exact donor commit `0843946d308bc3f88bb147d910deff450393c475`.
- Greyhaven city, all 15 authored building footprints, roads, river, fields, groves, bridges, Red Lion entrance reference and map spawn reference are visualized using the source coordinates.
- **The Red Lion now uses a real modular Quaternius GLTF assembly:** ten plaster/timber wall segments, two timber-framed gable ends, arched entrance wall and door, glazed arched windows, open shutters, round-tile gabled roof and masonry chimney.
- An original heraldic signboard texture labels the building **THE RED LION — TAVERN • GREYHAVEN**.
- Building placement is derived from the exact authored World9 footprint (6.25 × 4.25 presentation units) and entrance reference (4365, 4060); the presentation scale does not define physical meters or movement authority.
- Quaternius Medieval Village MegaKit is distributed under **CC0 1.0**. Original creator and exact source mirror revision are recorded in `public/assets/quaternius/medieval-village-megakit/NOTICE.md`; the complete license text is retained beside the assets.
- Source 2048×2048 material textures are resized to 1024×1024 for this browser prototype. Original source files remain in the external staging archive; upstream files are unchanged.
- The PlayCanvas client exposes a lazy import of the already-qualified MYASO browser `connectAuthoritativeClient` and `connectGameTransport`; the protocol adapter is not loaded during initial scene boot.

## Explicitly not implemented

- The Red Lion is a first-pass modular assembly, not a final bespoke Blender rebuild; facade alignment, roof fit, sign proportions, lighting and art direction still need review.
- The other 14 buildings remain diagnostic proxies; the Blacksmith has not yet been rebuilt from modular art.
- No actual player actors are rendered; the spawn is a static map reference marker.
- The World9 source map is read-only visual data. Its portal helpers are not invoked, and it does not authorize movement, collision, portals, items or server transitions.
- No Rust connection is attempted. No production URL, certificate pin, credential or server configuration is included.
- No movement, combat, HP, identity, respawn or chat is client-authoritative.
- The existing `web/` client and `server/` sources are unchanged.

## Next gates

1. Complete close-up visual review of the Red Lion in Chrome and Firefox; correct only measured placement issues.
2. Rebuild the Blacksmith from the same licensed modular source where suitable.
3. Connect the authenticated PlayCanvas Editor to the official Editor MCP server and verify real tool calls.
4. Import the reusable human animation source and approved Blender exports without altering provenance.
5. Reuse the exact current Rust wire contract through the existing browser client modules.
6. Qualify two independent clients on a non-production test server, including Combat, respawn, Chat C1, reconnect and tab suspension.
7. Compare WebGPU and WebGL 2 on actual supported browsers/devices; record load size, p50/p95 frame time and memory where available.

Current initial JavaScript bundle baseline: 2.52 MB minified / 650.45 KB gzip, with the Rust adapter split into a separate 41.76 KB / 13.02 KB gzip chunk. The new GLTF assets and textures are tracked separately from the JavaScript bundle; optimize texture and container loading before any release.

See [Main0 PlayCanvas spike #1151](https://github.com/tehki/myaso/issues/1151).


## Graphics 3 PlayCanvas architecture/atmosphere review (November 1, 2026)

**Draft source work, not a live update.** The stand-alone PlayCanvas client now attempts to load the previously editor-reviewed genuine Blender Blacksmith R4 GLB alongside its existing source Quaternius Red Lion assembly. The Blacksmith remains `smith` in the immutable read-only World9 map: X3710,Y3850,size182×162; its visual-only origin is (-8.475,0,-4.35), current scale 0.72. It is *not* a server-authorized collision mesh, item rack, shop, door, or portal. Failure to load either model retains that building's World9 diagnostic proxy.

Use local Vite to compare:
- `/?view=red-lion&greyhavenTime=day`: Red Lion close-up with daylight and no chimney smoke.
- `/?view=red-lion&greyhavenTime=dusk`: original sign, warm Red Lion windows, dusk shading and small bounded smoke wisps.
- `/?view=blacksmith&greyhavenTime=dusk`: original Blacksmith R4 geometry, forge-window practical light, and chimney plume.

The time override is **presentation only**; the Rust server never receives it. Dusk adds at most 4 short-range no-shadow practical lights and 12 pooled translucent wisps (6 per successfully loaded building); daytime creates none. Reuse one smoke material, cap scene sun shadow resolution at 1024 and distance at 65, and cap preview DPR at 1.5 to protect fill rate. The real 3D depth buffer keeps geometry/roof and translucent smoke occlusion subject to subsequent native Chrome/Firefox confirmation.

**Not yet qualified:** source SHA tests, browser screenshots, performance p50/p95, source-visual chimney anchor inspection, Chat/combat readability or authorized 2/4-player World9 travel. GLB meshes retain source geometry/texture; original Blender editables remain on the authorized owner computer. PlayCanvas Editor's separately verified particle-system smoke remains an independent editor-only implementation, not proof of this Vite smoke pool. Silver Knight animation files are **unchanged**: reusable adult-human animation work precedes any Silver retargeting. Production HOLD; no merge, deployment or gameplay-authoritative changes.


## Firefox graphics-device first-RED and WebGL2 verification — 2026-11-01

**Original first-RED is preserved, not overwritten or waived.** On Serj, the original Core8C PlayCanvas read-only Firefox harness against source `6d45ba5c71f33e57d8c7d92bbec184083fb404ef` logged `PlayCanvas bootstrap failed: Failed to create a graphics device`, `data-engine-booted=false`, `data-renderer=failed`, and no Rust session. The retry with `gfx.webrender.software=true` and `LIBGL_ALWAYS_SOFTWARE=1` was still RED, so this was **not** a QUIC or actor-authority failure. Untouched first-RED evidence remains on the Serj host:

- `/home/serj/Work/.myaso-combat4d-qa-playcanvas-evidence/firefox-run-2.log` (real headless Firefox device failure)
- `/home/serj/Work/.myaso-combat4d-qa-playcanvas-evidence/firefox-run-3-softwaregl.log` (independent software GL first-RED)
- the preexisting `firefox-repro/`, `firefox-softwaregl/` and original Core8C QA reports.

**Scoped graphics-only correction:** Firefox requests actual PlayCanvas `DEVICETYPE_WEBGL2` first and exclusively; other browsers keep WebGPU-first then explicit WebGL2 fallback. Selection is pure graphics presentation, and a failed/unsupported native graphics device remains a visible fatal error rather than a fake renderer. It does not promise WebGL2 will work on a host where the browser is denied all graphics devices. Do not recategorize the original headless failure as PASS simply because the source selector is corrected.

**Manual native acceptance:** open loopback Vite on a host with working Chrome/Firefox installations and repeat `view=red-lion/blacksmith` × `greyhavenTime=day/dusk`. For each session record actual `WebGL2RenderingContext`, DOM device type, original model loaded flags, 0 or 12 dusk smoke wisps, real browser screenshot, graphics driver `WEBGL_debug_renderer_info` where available, and comparable 120-frame RAF p50/p95 (RAF is **not** GPU-present FPS). A genuine GPU host must be distinguished from SwiftShader/llvmpipe or WARP; report hardware identity and actual renderer. Protected CI, genuine native screenshots, original first-RED, and gameplay-independent release checks remain separate gates.

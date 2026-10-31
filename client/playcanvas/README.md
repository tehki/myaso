# MYASO.IO — PlayCanvas Client Alpha 0.1 Spike

**Status:** isolated source-only feasibility prototype. This is not the live client and is not connected to production.

## Pinned stack

- PlayCanvas Engine: `2.23.3`
- Vite: `8.3.5`
- Node.js: `22.18+` (the current X230i development node is `26.8.1`)
- Renderer: request WebGPU first; PlayCanvas falls back to WebGL 2 when WebGPU is unavailable.

## Run

```bash
npm ci
npm test
npm run build
npm run smoke:browser
npm run dev
```

The dev server binds to `127.0.0.1:4174` only. The production preview binds to `127.0.0.1:4175` only. The browser smoke supports `CHROME_BIN` overrides and saves a diagnostic screenshot under `.artifacts/`.

## What this slice proves

- PlayCanvas Engine V2 bootstraps in a browser.
- WebGPU is preferred and WebGL 2 fallback is delegated to the engine's supported graphics-device creation path.
- The isometric visualization consumes the designer-authored World9 map source from [World9 PR #1148](https://github.com/tehki/myaso/pull/1148), exact donor commit `0843946d308bc3f88bb147d910deff450393c475`.
- Greyhaven city, all 15 authored building footprints, roads, river, fields, groves, bridges, Red Lion entrance reference and map spawn reference are visualized using the source coordinates.
- The map-to-engine scale is a presentation transform only. It does not define physical meters, collision or movement authority.
- The PlayCanvas client exposes a lazy import of the already-qualified MYASO browser `connectAuthoritativeClient` and `connectGameTransport`; the protocol adapter is not loaded until a future non-production session explicitly requests it.

## Explicitly not implemented

- Building meshes remain diagnostic proxies; approved Blender/GLB art is not yet imported.
- No actual player actors are rendered; the spawn is a static map reference marker.
- The World9 source map is read-only visual data. Its portal helpers are not invoked, and it does not authorize movement, collision, portals, items or server transitions.
- No Rust connection is attempted. No production URL, certificate pin, credential or server configuration is included.
- No movement, combat, HP, identity, respawn or chat is client-authoritative.
- The existing `web/` client and `server/` sources are unchanged.

## Next gates

1. Connect the authenticated PlayCanvas Editor to the official Editor MCP server and verify real tool calls.
2. Import approved GLB/Blender exports and the existing human animation source without altering provenance.
3. Reuse the exact current Rust wire contract through the existing browser client modules.
4. Qualify two independent clients on a non-production test server, including Combat, respawn, Chat C1, reconnect and tab suspension.
5. Compare WebGPU and WebGL 2 on actual supported browsers/devices; record load size, p50/p95 frame time and memory where available.

Current initial bundle baseline: 2.50 MB minified / 646 KB gzip for the engine entry, with the Rust adapter split into a separate 41.8 KB / 13 KB gzip chunk. This is a measured prototype baseline, not an optimized release target.

See [Main0 PlayCanvas spike #1151](https://github.com/tehki/myaso/issues/1151).

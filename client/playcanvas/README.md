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
npm run dev
```

The dev server binds to `127.0.0.1:4174` only. The production preview binds to `127.0.0.1:4175` only.

## What this first slice proves

- PlayCanvas Engine V2 bootstraps in a browser.
- WebGPU is preferred and WebGL 2 fallback is delegated to the engine's supported graphics-device creation path.
- A small isometric diagnostic scene renders with lighting and shadow support.
- The PlayCanvas client re-exports the already-qualified MYASO browser `connectAuthoritativeClient` and `connectGameTransport`; it does not fork the protocol.

## Explicitly not implemented

- The blockout is not the canonical World9 map, not approved art, not final building geometry and not a gameplay scene.
- The two visible player markers are static presentation proxies, not network actors.
- No Rust connection is attempted. No production URL, certificate pin, credential or server configuration is included.
- No movement, combat, HP, identity, respawn or chat is client-authoritative.
- The existing `web/` client and `server/` sources are unchanged.

## Next gates

1. Connect the authenticated PlayCanvas Editor to the official Editor MCP server and verify real tool calls.
2. Import approved GLB/Blender exports and the existing human animation source without altering provenance.
3. Reuse the exact current Rust wire contract through the existing browser client modules.
4. Qualify two independent clients on a non-production test server, including Combat, respawn, Chat C1, reconnect and tab suspension.
5. Compare WebGPU and WebGL 2 on actual supported browsers/devices; record load size, p50/p95 frame time and memory where available.

See [Main0 PlayCanvas spike #1151](https://github.com/tehki/myaso/issues/1151).

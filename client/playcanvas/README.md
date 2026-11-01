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
- No production character mesh/animation is integrated; the opt-in Rust debug bridge renders read-only diagnostic actor silhouettes.
- The World9 source map is read-only visual data. Its portal helpers are not invoked, and it does not authorize movement, collision, portals, items or server transitions.
- Default startup never attempts a Rust connection. No production URL, certificate pin, credential or server configuration is included. Only explicit loopback-pinned developer mode or the separately invoked local-only smoke can connect.
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


## Isolated real Rust QUIC / PlayCanvas acceptance (opt-in)

This test is **not** part of the normal renderer smoke or production runtime. It starts a
fresh original Rust server on `127.0.0.1:0` (ephemeral UDP port and self-signed
development certificate), a private loopback Vite server, ChromeDriver and **two
real Chromium PlayCanvas pages**. It dynamically loads the **existing**
`web/authoritative-client.mjs` and `web/network-transport.mjs` through the
unchanged PlayCanvas adapter. No WebSocket fallback, alternate wire codec,
credentials, public bind, or production URL are accepted. The harness removes any inherited `MYASO_*` server environment variables before applying only its own loopback bind and four-player cap.

Build the Rust server from the checked-out source, keeping temporary build
artifacts away from constrained shared `/tmp` volumes when necessary:

```bash
cargo build --locked --manifest-path server/Cargo.toml --bin myaso-server
cd client/playcanvas
npm ci
MYASO_PLAYCANVAS_RUST_BIN="$(realpath ../../server/target/debug/myaso-server)" npm run smoke:quic
```

The binary path must explicitly point to a local `myaso-server` executable.
The test requires `chromedriver` and Chromium (override `CHROME_BIN` if needed),
validates the opt-in PlayCanvas read-only Rust actor bridge (genuine snapshot-driven silhouettes with **zero inputs**), as well as two real server-assigned distinct actors, datagram snapshots, reliable
snapshot baselines, processed input ACKs and World position/HP, then closes one
QUIC root. The surviving client must observe the actor removal. Reconnecting
must acquire a fresh server-issued actor and fresh snapshots without reusing
the retired connection. All child processes are terminated in a `finally`
block, including on first-RED. The output is
`PLAYCANVAS_REAL_RUST_QUIC_PASS` or a preserved
`PLAYCANVAS_REAL_RUST_QUIC_FIRST_RED` with the reason.

This verifies basic snapshot/identity/lifecycle/reconnection only. It is **not**
the independent Combat 4D, three-respawn, Chat C1 or production-release gate.

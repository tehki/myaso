# MYASO.IO — PlayCanvas ↔ original Rust World (source-only, read-only dev bridge)

**Status:** integration scaffold with source tests, not qualified real Rust multiplayer. No live production connection, merge, deployment or public PlayCanvas publishing is authorized.

## Why this bridge exists

The existing original browser module `web/authoritative-client.mjs` already implements the real Rust QUIC/WebTransport packet handling, processed input ACKs, snapshot merge, stale-sequence handling, interpolation and Combat authority boundaries. The PlayCanvas slice must reuse it rather than creating an alternative packet codec or locally authoritative player movement.

The new `src/network/dev-rust-session.js` imports that original client through `src/rust-authoritative-client.js` and subscribes to real `onSnapshot` and `onReliableSnapshot` callbacks. It sends **no inputs**: there is no `sendInput`, no client-side movement reconciliation, no Combat or Chat replica. The debug actor layer simply displays the server's x/y/facing, server tick and own NetID when that identity is available. It deletes actors removed from the authoritative state Map. Invalid positions are not drawn. Cylinder silhouettes are deliberately diagnostic placeholders, not reusable human animations.

The actor presentation transform is derived from authored World9 source: visual origin (4140,4105) and scale 0.025, using `projectAuthoritativePosition`. **Important limitation:** the current protocol's snapshot records do not include a World9 map/zone authorization token. World coordinates and a matching 8192×8192 bounds constant do **not** prove that the authoritative Rust World is running Greyhaven. Until Core8C and World9 verify the actual server-side map/zone mapping, these silhouettes are debug projections only. No portal, collision, item, map transition or player spawn authority is inferred.

## Explicit local development activation (never production)

The original default browser scene is disconnected. To try the bridge against a *separate authorized local-only non-production Rust QUIC server*, create `client/playcanvas/.env.local` (gitignored):

```dotenv
VITE_MYASO_DEV_QUIC_URL=https://127.0.0.1:8443/game
VITE_MYASO_DEV_QUIC_SHA256=<the 64 hex digits of your local test server certificate SHA-256>
```

From `client/playcanvas/`, run:

```sh
npm ci
npm test
npm run dev
```

Open `http://127.0.0.1:4174/?rust=1`. The code path requires **both** Vite's development mode and explicit `?rust=1`. The URL validator requires HTTPS, exact `/game` path, explicit port, local loopback hostname (`localhost`, `127.0.0.1`, or `[::1]`), and a 32-byte pinned SHA-256 hash. No WebSocket fallback. Public game domains, credentials, query tokens and production endpoints are rejected. `npm run build` compiles the normal release preview with the live integration disabled.

If the test server is remote, connect to it **only through a separately authorized loopback QUIC forward**; plain SSH TCP forwarding cannot itself forward WebTransport's underlying UDP/QUIC transport. Do not repurpose the existing production certificate pin or connect to the live Pre-Alpha.

When connected, the debug status reports the server tick and count of server-authoritative actors, and the renderer shows only authoritative snapshot positions. It does not generate input ticks, input packets or typed Combat events. Closing the browser releases the QUIC client and all debug render entities.

## Validation required before calling this multiplayer-qualified

- Core8C provides an isolated Rust server with known map authority, QUIC test endpoint and independently documented test certificate pin; never the production release.
- Verify the original Rust World has actually activated the Greyhaven map. If not, expect arena/other world actors to project to unrelated locations and do not claim Greyhaven gameplay.
- Capture two physically independent clients with real WebTransport connections and authoritative snapshot/ACK evidence, plus authoritative Combat HIT/HP and Chat C1 continuity. The read-only adapter alone cannot prove those features.
- Do not bypass historical Combat M140 first-RED, strict physical LMB timings or Firefox Space+LMB Idle recovery.
- Verify browser default `/` and opt-in `/?rust=1` without credentials: both must render without a production connection, and the latter must report a clear missing-local-configuration error.
- Check Chrome/Firefox and WebGPU/WebGL2 on supported hardware; performance and 4-player gameplay remain separate gates.

**No changes** to original `web/` or Rust server code. Existing production Pre-Alpha remains untouched.

# MYASO.IO — PlayCanvas ↔ original Rust World (source-only, read-only dev bridge)

**Status:** integration scaffold with source tests, not qualified real Rust multiplayer. No live production connection, merge, deployment or public PlayCanvas publishing is authorized.

## Why this bridge exists

The existing original browser module `web/authoritative-client.mjs` already implements the real Rust QUIC/WebTransport packet handling, processed input ACKs, snapshot merge, stale-sequence handling, interpolation and Combat authority boundaries. The PlayCanvas slice must reuse it rather than creating an alternative packet codec or locally authoritative player movement.

The new `src/network/dev-rust-session.js` imports that original client through `src/rust-authoritative-client.js` and subscribes to real `onSnapshot` and `onReliableSnapshot` callbacks. By default it sends **no inputs**; the separately gated Combat4/UI10 adapter below uses the original client's `sendInput` only after trusted physical events. Neither mode has client-side movement reconciliation, Combat authority or a Chat replica. The debug actor layer simply displays the server's x/y/facing, server tick and own NetID when that identity is available. It deletes actors removed from the authoritative state Map. Invalid positions are not drawn. Cylinder silhouettes are deliberately diagnostic placeholders, not reusable human animations.

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

When connected, the debug status reports the server tick and count of server-authoritative actors, and the renderer shows only authoritative snapshot positions. In the default read-only mode it does not generate input ticks, packets or typed Combat events. Closing the browser releases the QUIC client and all debug render entities.

## Validation required before calling this multiplayer-qualified

- Core8C provides an isolated Rust server with known map authority, QUIC test endpoint and independently documented test certificate pin; never the production release.
- Verify the original Rust World has actually activated the Greyhaven map. If not, expect arena/other world actors to project to unrelated locations and do not claim Greyhaven gameplay.
- Capture two physically independent clients with real WebTransport connections and authoritative snapshot/ACK evidence, plus authoritative Combat HIT/HP and Chat C1 continuity. The read-only adapter alone cannot prove those features.
- Do not bypass historical Combat M140 first-RED, strict physical LMB timings or Firefox Space+LMB Idle recovery.
- Verify browser default `/` and opt-in `/?rust=1` without credentials: both must render without a production connection, and the latter must report a clear missing-local-configuration error.
- Check Chrome/Firefox and WebGPU/WebGL2 on supported hardware; performance and 4-player gameplay remain separate gates.

**No changes** to original `web/` or Rust server code. Existing production Pre-Alpha remains untouched.

## Combat 4 and UI 10 — strictly optional local original-input mode

The default `?rust=1` path above is **still read-only**. The *same*
development-only page can opt into original Rust input by adding
`&combatInput=1`:

```
http://127.0.0.1:4174/?rust=1&combatInput=1
```

This attaches one UI10 physical owner to the existing authoritative client:
W/A/S/D movement, Space Jump, RMB tap Kick / hold Run, wheel forward Dodge
and wheel back Block/Parry through original v1 `sendInput`. Source0 LMB
never enters v1. It binds to the unchanged original
`web/prealpha-gesture-live-lab.mjs` negotiated typed physical LMB owner,
which owns Light34, Heavy46's accepted-PRESS 85ms intent and typed
Space+LMB JumpAttack42. The Rust World alone owns damage, stamina, hit
arbitration, 135ms Light and 320ms Heavy. M140's strict 180ms recovery
punish is measured in genuine native browser tests, not imposed by a new
client-side clock. UI10 Chat focus, blur, visibility loss and pagehide cancel original held inputs;
Enter/Escape and actual Chat C1 message delivery remain owned by UI10 and
are not implemented by this source-only Combat adapter; there is no competing local Combat implementation.

A *real* mouse/key/wheel sample first produces a genuine processed ACK and
matching original World actor snapshot. **No neutral packet is fabricated**
to manufacture authentication. Only then is a single original server-bound
typed LMB grant negotiated; rejected grants fail closed, not to v1 LMB.

Only when the isolated original Rust test server supports the additional
private M147 server-bound HIT receipt laboratory may the operator also pass
`&privateHit=1`. That receipt is authenticated to the same original QUIC
actor, and its presentation only changes UI text. HP display always comes
from Rust snapshots and is never locally decremented. Without the private
HIT grant, no HIT confirmation is shown.

**Not production-qualified:** this source wiring and isolated tests do not
prove actual Chrome/Firefox genuine source0/World HIT, PlayCanvas renderer
frame latency, connection continuity, Source11 respawn renewal or Chat C1
message delivery. Those still need separate real-browser, same-session
authority, security and UI10 signoff. Never run the opt-in test against
production or publish PlayCanvas publicly.

Source11 same-root typed lease renewal is the existing original preview path:
`?rust=1&combatInput=1&source11Renewal=1`. Do not infer a renewed lease
from a respawn UI event: the original Rust bidi channel must explicitly
grant the new generation. Test three genuine respawns and stale-generation
rejection before claiming PlayCanvas session continuity.

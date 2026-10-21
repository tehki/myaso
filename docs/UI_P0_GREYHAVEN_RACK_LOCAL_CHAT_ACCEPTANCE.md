# UI 10 — Original Blacksmith rack + Core Chat C1 in same real four-client Greyhaven room

Status: P0 isolated DRAFT integration / visual and local-chat receipt only.
Exact joined sources: Graphics 3B original empty-rack Greyhaven #603,
original Core 8A/Core 8C rendered city, and local server-authoritative
Chat C1 #580. No PR here is main-merged or production enabled.

## Required first combined real-browser evidence

Run scripts/alpha_p0_four_native_greyhaven_rack_chat.mjs with the built
original Rust myaso-server and real Chrome/Firefox W3C drivers (not mocks).
Four independent browser processes connect to one temporary loopback QUIC
WebTransport server with ephemeral TLS pin, server-owned actual Greyhaven
four-spawn positions, reviewed 23 static solids and explicit preview flags
world=1, armoryart=1, chatC1Preview=1, uiLivenessProbe=1. Core Chat
radius 100: 96-unit orthogonal neighbors hear each other; 135.76-unit
diagonals do not.

For the SAME four live authenticated sessions:
- Real authored-city canvas and original Graphics3B wood/iron Blacksmith
  rack are painted in the actual game canvas, not a separate rendered image.
- Rack stays EMPTY: drawnSwords=0, canonicalItems=false,
  serverTryPickup=false, productionApproved=false. No fabricated items.
- True roster IDs 1,2,3,4, genuine HUD tick, received authoritative
  snapshot and ACK counters progress for every player after chat.
- A to B/C receives authentic Player #1, A to D excluded.
  C to A/D receives authentic Player #3, C to B excluded.
- Hostile HTML remains inert; 240-byte UTF-8 accepted, 242-byte rejected;
  native W/E/Space are owned by composer; Escape restores arena input.

Hard limits: one local host with four genuine browsers, not four separate
human-owned computers. Empty rack remains empty until authenticated
Items2B/Core8B GroundEntityId/ItemId/revision authority exists. No live
MainHand, click pickup or sword/fist acceptance here. No deployment or
public chat activation; Main Orchestrator #360 owns merge/release.
Full protected Combat suite remains separately mandatory.

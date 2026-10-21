# Graphics 3B P0 — exact original World #493 + 3B Blender #508 + UI #503 alpha gesture acceptance

21 October 2026 · Moon Games First Playable #480 and mandatory physical-sword pickup #488.

**Draft experimental cross-branch compatibility proof, not live multiplayer.** This follow-up stacks on Graphics #508 → #500. It imports the original unmerged World #493 head 07060f981b8a1dac89184b621b6893dd970a08ae and the independently pinned **hardened UI #503 head** 8d500d8ddeb4058f15dbc704bf78d685d1ca31ef. It uses the same existing Graphics authored Blender source and original sprites unchanged.

## Original-owned source boundaries

- World #493 is the sole author of the one-zone open-front smith layout and the four sword anchors (3740,4038), (3780,4038), (3820,4038), (3860,4038). Its original authored map and actual chunk renderer are browser-imported directly from a separate Git checkout.
- Graphics #508 paints a separate Blender rack plus four independently alpha-decoded lossless sword WebPs at those World anchors. Its pure bridge reads the World module but does not create new World sockets or canonical item IDs.
- UI #503 owns the one gesture reservation policy (native pointer down/up, cancellation, actual alpha re-sampling and final-painted source-pixel validation). UI #496 owns canvas client-coordinate conversion. Neither is copied/reimplemented or modified by Graphics. Real Combat handler is not called in this art fixture.
- Core 8B / Items 2B, Core 8C / Physics 6 must still authoritatively own canonical 128-bit item identities and commit/ACK, true player proximity/LOS, complete signed/fenced geometry and server inventory. Graphics never authorizes TryPickup, weapon-equipped state, server-visible attack suppression or token-value transfer.

## Verified genuine browsers, source provenance and gesture matrix

`tools/art/verify_armory_world493_ui503.mjs` checks the external World/UI exact Git heads, the original Graphics parent ancestry and byte-level SHA-256 of original WebPs, Graphics helpers and all imported unmodified World/UI modules before accepting results. It serves a localhost allowlist only. Actual browser JavaScript imports **original UI functions** `createAlphaSwordGestureGate` and `swordPointerCanvasPoint`, original World renderer and original 3B source-alpha hit test.

True native Chrome 154.0.8037.99 and Firefox 153.4.0 trusted mouse pointer events, six original cached World tiles:

| Genuine pointer test | Chrome | Firefox |
| --- | --- | --- |
| Click first sword at true decoded (20,13) opaque source pixel | Visual intent only | Visual intent only |
| Click source (0,0) alpha-transparent inside sword rectangle | One *simulated* ordinary Combat fallback | Same |
| Mouse down on opaque pixel, drag to transparent, release | Cancel; zero added attack | Same |
| Item revision changes during pending down/up | Cancel; zero added attack | Same |
| Sword removed from painted item list mid-gesture | Cancel; zero added attack | Same |
| CSS viewport shrunk to 390px, DPR2, real pointer conversion to 640px backing pixels | Same original sword recognized | Same |
| Fake callback returns wrong source pixel, opaque hit at transparent image pixel, outside bounding box or stale last-presented frame | Rejected | Rejected |

Each engine produced **2 visual-only intents, 1 simulated ordinary attack fallback, 3 reserved cancelations and 12 genuine pointer down/up events**, with **0 page/network errors** and 2 native screenshots (full-size and high-DPI/mobile layout). A Firefox WebDriver BiDi transport may collapse duplicate references to the same frozen NO_HIT object when transferring a composite test result; our harness serializes that diagnostic object inside the page before passing it over BiDi. This changes neither UI candidate decisions nor any source behavior.

## Explicit limitations and integration handoff

ALL browser item IDs are `ART-ONLY-NO-SERVER` demonstration strings; the 4 visual swords do not come from an authoritative game server. No actual online-game.mjs, WebSocket/QUIC, four independent connected players, Combat command stream, simultaneous pickup competition, item equip, death/drop/reconnect or hardened stale event ACK is run. The `combatFallback` field is a **test-only counter, not a real game attack**. This is **IMPLEMENTED + cross-branch TESTED**, NOT integration-ready, integrated or playable.

UI #503 must remain sole gesture-gate owner. UI #489 rectangular helper currently constrains item ID to 64 ASCII, while 3B/UI alpha handles opaque strings up to 160 characters: **Core 8B/Items 2B must decide the one canonical item wire encoding**; do not run two pointer gates in parallel or remint/truncate IDs. World #493/#509, Core/Physics geometry, Core/Items canonical single-writer, Graphics 3A Silver Knight MainHand display and cross-browser real 4-player city → Blacksmith → sword pickup → fists-vs-swords PvP remain the owner integration gates.

Graphics parent #500 exact-head full CI #39576776102 **FAILED** protected real Combat M194; child #508 protected CI must independently pass, and this new follow-up requires its own exact-head CI. No weakening of protected browser input tests, no merges, no production/deployment changes, no change to original Blender assets, World sources, UI/Combat or server.

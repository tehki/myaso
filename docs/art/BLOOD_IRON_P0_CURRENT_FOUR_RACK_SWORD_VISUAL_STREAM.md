# 🌕⚡️🚀 Graphics 3B P0 — current four physical rack sword presentation, one proposed journal head

**Moon Games First Playable #480, actual four physical sword pickup #488 · 2026-10-21.**

## The missing graphics contract

World #521 / #493 approved four stable Blacksmith rack socket IDs, original anchored sword sprites, and original 3B modeled wood/iron rack. Graphics #529 already painted four individually clickable sword pixels and proved UI #503's hardened physical-source input. Core 8B [draft #577](https://github.com/tehki/myaso/pull/577) *now proposes* a **READ-ONLY** Rust `CurrentFourRackCandidates` local-journal view: all four `Option<CurrentRackCandidate>` slots share one local `journal_sequence`; `None` means item no longer at exact Ground position; `CurrentRackCandidate` has socket ID, separate proposed canonical ground entity, separate canonical ItemId, ground and item mutation sequence. It does not provide signed source origin, network schema, real client receipt, approved map epoch, or a live writer. Rendering an obsolete art sword after proposed pickup, or locally auto-restoring an item from an old browser state, would be a misleading visual bug.

## Small new Graphics-owned read-only source adapter

`src/browser/armory-current-rack-visual-stream.mjs` exports `createProposedCurrentRackVisualStream({worldArmory,authoredMap,layoutVersion,camera,scopeKey})`. It accepts an **explicitly normalized externally supplied proposal** `{scopeKey, journalSequence: decimal u64 string, slots: [null | {socketId,itemId,groundEntityId,itemMutationSequence:decimal u64 string} ×4]}`. **This is NOT the Rust serialization or a protocol.** It never calls Core, Items or a network API and cannot verify that any caller's slot data originated from the canonical item writer.

The adapter asks the existing original 3B World #493/521 visual bridge to validate the *source-authored* four Blacksmith sockets. It requires four slots in their exact authored order, separate nonempty unique item/ground entity IDs, exact socket identity, and original zone. `None` yields ZERO sword sprites for that slot; the rack remains visible. The only mutations are its own local read-only presentation cursor. It does not mint a replacement sword, infer a weapon from the nearest rack coordinate, equip a Silver Knight or suppress Combat.

Sequencing is **local to the current externally declared stream scope only**. It compares `journalSequence` using lossless BigInt parsing of decimal u64 strings, not potentially rounded JS numbers, rejects negative/ambiguous/out-of-range values, and prevents an older snapshot from reintroducing a sword after pickup. Equal head with equal candidate rows is a no-op; equal head with inconsistent occupancy fails closed. When a previously seen item is absent and later returns to the rack, its mutation version must be newer than its last observed revision (otherwise fail closed). Existing original UI #503 only accepts *numeric safe-integer* source revision, so any mutation exceeding `Number.MAX_SAFE_INTEGER` fails closed rather than silently truncating. Future real client contract must decide how to carry full u64 revisions, signed writer lineage, epoch and reconnect rebase; this adapter intentionally cannot do that.

## Real original-source Native Chrome + Firefox

Extended the **existing** original World #521 / Graphics 3B original Blender/WebPs / original UI #503 W3C pointer browser fixture, keeping its earlier four distinct clickable swords, high-DPI, spoofed source alpha and drag/revision cancellation tests intact. Both native **Chrome 154.0.8037.99 and Firefox 153.4.0** additionally executed the following **test-only locally proposed candidate snapshots**:

| Proposed local journal head | Candidate rack occupancy | Actual separately drawn Blender swords | Meaning |
| --- | --- | ---: | --- |
| `1` | four distinct items | **4** | all original sword pixels visible |
| `2` | first exact socket absent | **3** | UI's held pointer reservation on removed sword cancels rather than a Combat attack |
| old `1` | stale replay | **3 unchanged**, no new frame | old snapshot cannot visually resurrect first sword |
| `3` | all slots absent | **0**, wooden rack still visible | clicking former sword yields test-only transparent fallback, no hidden pickup |
| `4` | four exact items returned, all with newer mutation `4` | **4** | original first sword again visually clickable only at actual source-alpha pixels |

Each engine produced **four genuine additional screenshots** for 4/3/0/4, while preserving its two previous full original World/browser pointer captures. Browser report `assets/environment/greyhaven/armory-p0/current-rack-review/armory_p0_world521_ui503_native_report.json` records 4 source-state frames per engine, stale rejection, real W3C pointer-down/up cancellation, one test-only fallback after emptying the rack, distinct 3B source sprites, zero JS/HTTP browser errors, zero real network packets or pickup/equip actions. `tests/armory-p0-current-rack-source-browser.test.mjs` checks these exact source results and PNG provenance.

Unit test `tests/armory-p0-current-rack-visual-stream.test.mjs` additionally covers new snapshot acceptance, old/duplicate/inconsistent journal head, same-item ghost return without newer mutation, wrong/repeated socket or ground/item ID, unauthorized scope, invalid u64 strings, >safe-integer UI version refusal and authoritative-no-claims. **58/58 cumulative focused P0 Graphics Node tests pass**, **9 new**.

## Important authority boundaries

Core 8B's source #577 is **dormant read-only proposal**, with no current authenticated writer or browser message. Its journal may be trustworthy only *within* a verified canonical writer session, and a browser cannot prove cryptographic origin by seeing a number. `scopeKey` is caller-supplied and not a signed writer identifier. On disconnect/reconnect/new zone/epoch, the officially approved client must reset/replace that presentation scope under a signed/authorized reconnect protocol; the present fixture cannot certify cross-writer ordering, server time, proximity, camera-depth/actor occlusion, ownership, Rust `u128`/legacy `u64` identity or QUIC wire.

**No changes** to original World, source Blender WebPs, original UI gesture handler, Combat, Physics, network, actual `web/online-game.mjs`, Core/Items Rust or server code. Parent Graphics #575 full [protected CI #39621161409](https://github.com/tehki/myaso/actions/runs/39621161409) **PASSED 165/165**; this NEW head needs its OWN protected exact-head quality. Historical #570 M107 failure remains recorded, not waved away. Only Main Orchestrator may merge/rebase/deploy after Core/Items one-writer, World/Physics authoritative current LOS/epoch, 8A protocol receipt, 3A Silver MainHand/kick/roll art and actual independent-host four-player City→Armory→pickup→fists/armed PvP→respawn acceptance.

**IMPLEMENTED / original source-browser TESTED; INTEGRATION-READY BLOCKED; NOT INTEGRATED/PLAYABLE.**

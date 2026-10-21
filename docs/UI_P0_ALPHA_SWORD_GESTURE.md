# Department 10 P0 — Graphics alpha-mask sword click arbitration

Parents: UI [#496](https://github.com/tehki/myaso/pull/496) →
integration pointer gate [#489](https://github.com/tehki/myaso/pull/489).
Graphics 3B proposed [#500](https://github.com/tehki/myaso/pull/500) with
`hitTestVisibleSwordAlpha(plan,point,sampleAlpha)`. Tracked in [#488](https://github.com/tehki/myaso/issues/488).
**DRAFT / UNWIRED** — no actual rack, server pickup, equip, Combat or production effects.

## Actual alpha, not the bounding rectangle

Use the *last actually presented* final-frame Graphics 3B plan, a decoded
actual transparent sword sprite alpha sampler, a monotonic frame number,
and the matching last-painted frame number. UI first calls
`swordPointerCanvasPoint(pointerEvent, arenaCanvas)` for correct canvas
backing-pixel coordinates. Then use
`createAlphaSwordGestureGate(hitTestVisibleSwordAlpha)` to reserve only a
left gesture that begins on an opaque *rendered sword* pixel. A
`visualCandidateOnly` result is **not** authority to mutate equipment.

The adapter checks the server-committed **presentation** item matches the
plan by opaque item ID, socket ID and item revision. It also independently
validates the pointer is inside the actual painted sword sprite, its
source-image pixel matches the Graphics hit witness, and the decoded
source WebP alpha is opaque enough. This prevents stale or incorrectly
reported visual hit callbacks from reserving a Combat gesture in air. A release is valid only
if the same item, socket, revision, rack version and zone are still
presented and the release pixel is opaque. Otherwise `handled:true` with
`itemId:null` instructs Combat to **suppress the reserved LMB**, not
convert it into a light/heavy attack. It never sends a pickup packet.
Unreserved LMB events remain owned by Combat; RMB, Space, wheel, knockdown,
or input submission are unchanged. On pointercancel, blur, lost capture,
zone change, reconnect or scene unload, call `cancel`/`reset` in the
future approved Combat/Graphics integration. Repeated down for one
pointer ID cannot swap targets; synthetic chord ID -1 remains supported.

## Required integrator contract

- Graphics must provide the **actual rendered frame**, not merely a plan
  generated offscreen: `{plan, sampleAlpha, frameId, lastPresentedFrameId}`
  with matching numeric IDs. `sampleAlpha` resolves **decoded sword WebP**
  source-pixel alpha. Frame IDs are presentation witnesses, never server
  item revisions.
- `plan` comes from Graphics 3B and contains `rackVersion`,
  `zoneId`, and `swords` with unique opaque `id`, `socketId`,
  `revision`. A socket/item list changing between mouse down/up
  cancels the gesture. The source alpha test controls coverage; rack/menu
  bounding rectangles are not interaction targets.
- The previously implemented rectangular `createSwordPointerGate`
  from #489 must **not be run in parallel** on the same native LMB.
  The Main Orchestrator / UI + Combat should select a single active
  resolver (alpha if Graphics #500 is accepted); no competing event handler.
- **Interface mismatch requiring central resolution:** Graphics #500
  permits opaque IDs up to 160 UTF-16 code units; #489's rectangle gate
  currently restricts IDs to 64 ASCII `[A-Za-z0-9_-]`. This alpha
  adapter preserves the Graphics opaque ID but does **not** prove its
  correctness as an authenticated Core/Items canonical identifier.
  Core 8A/8B + Items 2B must publish exact normalized ID/request wire
  before runtime wiring; reject rather than truncate/remint IDs.
- Only Core/Items authorize actual `TryPickup(itemId,requestId)`,
  range/LOS, unique owner, ACK/rejection, persistence, one MainHand
  equipment state and four-client replication. No authoritative feedback
  is fabricated by this UI primitive.

## Acceptance and rollback

Targeted R0 Node tests exercise alpha transparency, CSS coordinate
conversion, stale/unpresented frame rejection, changed zone/IDs/revisions,
cancel/reset, RMB/middle and repeated/chorded LMB. Real Chrome/Firefox on
the **actual WebP alpha** are required before claiming exact visual
integration. Four independent live players, sword pickup contention and
armed/unarmed server-confirmed fighting are still mandatory and unproven.

Rollback removes `alpha-sword-gesture.mjs`, its test and R0 import. No
changes to Combat, network, game runtime, server, or production.

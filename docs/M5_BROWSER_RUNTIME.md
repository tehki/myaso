# M5 Browser Runtime Optimization

## Objective

Keep myaso.io browser-first while the authoritative server architecture grows. M5 removes avoidable client hot-path work before authoritative reconciliation is wired into the visible game loop.

This is a performance engineering boundary, not a claim that every browser/device class is already capacity-qualified.

## Browser hot-path rules

1. **Rendering follows `requestAnimationFrame`.** Simulation catch-up is bounded; stale simulation debt is dropped instead of freezing the tab in an unbounded catch-up loop.
2. **Hidden tabs do not render or simulate the local demo.** Input state is released on blur/visibility loss and the frame clock is reset before resuming.
3. **Static art is cached.** The arena background/grid/border is rendered once to a backing canvas and copied into the visible canvas each frame.
4. **DOM writes are value-gated.** HP, guard and event text are only written when their displayed value changes.
5. **Realtime snapshot state is mutated in place.** Existing entity objects keep identity across delta snapshots so render systems can retain references and the client does not clone the entity map every network update.
6. **Full snapshots clear stale render entities.** Delta removals delete only the named entity; a full snapshot resets absent browser-side state.
7. **Realtime transport stays latest-wins.** `sendRealtime()` keeps its copy-safe contract. `sendRealtimeOwned()` allows a caller to transfer a fresh packet to WebTransport without the extra defensive copy.
8. **No framework/runtime dependency is added.** The optimized path remains standard browser JavaScript + Canvas 2D + WebTransport/WebSocket fallback.

## Deterministic evidence

`tests/browser-runtime.test.mjs` verifies:

- catch-up work is capped per animation frame;
- excess stale frame debt is dropped deterministically;
- full snapshots clear stale browser entities;
- delta snapshots update the existing entity object rather than replacing it;
- removed entities are deleted cleanly;
- hundreds of repeated snapshot updates preserve entity object identity.

`scripts/browser_hotpath_probe.mjs` performs an informational hot-path probe over 2,000 snapshots × 64 entity records. It fails if entity references are replaced or entities are lost, and reports record applications per millisecond without imposing a hardware-dependent timing threshold.

## Budget policy

These are engineering targets for later real-browser profiling, not claims from Node CI:

- target 60 FPS presentation where the display permits it;
- no unbounded simulation catch-up after a long frame or tab stall;
- no full entity-map clone per realtime snapshot;
- no replacement object allocation for ordinary updates to already-known entities;
- static scene work should not be rebuilt every frame;
- high-frequency UI values should not trigger redundant DOM writes;
- realtime sends should coalesce to latest-wins under backpressure.

## Remaining M5/M6 browser work

The visible demo still uses the local M1 JavaScript combat model. The next integration boundary is to connect the browser client to M4 authoritative snapshots, add an explicit last-processed-input acknowledgement for reconciliation, and then measure the real browser path with DevTools/Performance APIs under representative player counts and network impairment.

Production browser support, mobile thermal behavior, memory pressure, high-DPI fill-rate limits, WebTransport availability/fallback quality, and hundreds-client internet-path capacity are not yet claimed.

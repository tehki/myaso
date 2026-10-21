# P0 First Playable — rendered sword pointer intent (DRAFT)

Integration-only helper for [#488](https://github.com/tehki/myaso/issues/488), [#460](https://github.com/tehki/myaso/issues/460) and [#480](https://github.com/tehki/myaso/issues/480).

This PR **does not connect to online-game, modify LMB controls, manufacture swords, issue a pickup, mutate a server-owned item, or prove gameplay.** It supplies a fail-closed UI/Graphics event-arbitration primitive and Node regressions for specialists to integrate after Core approves item wire schema.

- Graphics supplies sprites **actually rendered** in the same final canvas frame: {kind:"sword",itemId: opaque canonical ID,rendered:true,occluded:false,paintOrder,bounds:{x,y,width,height}}. Bounds are *per sword* and canvas pixel coordinates, not a whole rack nor uncorrected CSS coordinates. UI must handle CSS→canvas transform, camera/zoom/alpha-mask collision and real overlapping sprites. The returned ID is an untrusted UI intent; server still validates everything.
- UI calls gate.down **before Combat's LMB charge press** and, if handled, skips charge. Calls gate.up **before Combat LMB release**, emits a single **pending-only** item intent if itemId exists, otherwise suppresses attack. Right-button chorded LMB must use the existing synthetic pointer ID consistently. All pointercancel, lost capture, blur, reconnect and scene transitions cancel/reserve safely.
- Core validates request ID/session, actor/zone, range/LOS, valid exact live world item, single-writer durable item transfer and ACK/reject; client only equips visually after committed authoritative replication. No client minted state.
- Combat retains original release-to-strike, heavy/roll/parry/jump input when not targeting an actual sword. Real browser W3C Chrome/Firefox click, simultaneous pickup race and 4-client acceptance **remain REQUIRED and unimplemented**.
- Node-only focused tests assert no rack/occluded hits; stable painted ordering; bounds validation; exactly-once intent; Combat fallback; drag, pointercancel and reset.

**Classification:** isolated IMPLEMENTED/TESTED helper only. Not INTEGRATED or PLAYABLE. Do not merge until main protected quality is healthy and UI/Core/Combat/Graphics contract owners approve.

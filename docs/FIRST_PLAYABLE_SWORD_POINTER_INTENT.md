# P0 First Playable — rendered sword pointer intent (DRAFT)

Integration-only helper for [#488](https://github.com/tehki/myaso/issues/488), [#460](https://github.com/tehki/myaso/issues/460) and [#480](https://github.com/tehki/myaso/issues/480).

This PR **does not connect to online-game, modify LMB controls, manufacture swords, issue a pickup, mutate a server-owned item, or prove gameplay.** It supplies a fail-closed UI/Graphics event-arbitration primitive and Node regressions for specialists to integrate after Core approves item wire schema.

- Graphics supplies sprites **actually rendered** in the same final canvas frame: {kind:"sword",itemId: opaque canonical ID,rendered:true,occluded:false,paintOrder,bounds:{x,y,width,height}}. Bounds are *per sword* and canvas pixel coordinates, not a whole rack nor uncorrected CSS coordinates. UI must handle CSS→canvas transform, camera/zoom/alpha-mask collision and real overlapping sprites. The returned ID is an untrusted UI intent; server still validates everything.
- UI calls gate.down **before Combat's LMB charge press** and, if handled, skips charge. Calls gate.up **before Combat LMB release**, emits a single **pending-only** item intent if itemId exists, otherwise suppresses attack. Right-button chorded LMB must use the existing synthetic pointer ID consistently. All pointercancel, lost capture, blur, reconnect and scene transitions cancel/reserve safely.
- Core validates request ID/session, actor/zone, range/LOS, valid exact live world item, single-writer durable item transfer and ACK/reject; client only equips visually after committed authoritative replication. No client minted state.
- Combat retains original release-to-strike, heavy/roll/parry/jump input when not targeting an actual sword. Real browser W3C Chrome/Firefox click, simultaneous pickup race and 4-client acceptance **remain REQUIRED and unimplemented**.
- Node-only focused tests assert no rack/occluded hits; stable painted ordering; bounds validation; exactly-once intent; Combat fallback; drag, pointercancel and reset.

**Classification:** isolated IMPLEMENTED/TESTED helper only. Not INTEGRATED or PLAYABLE. Do not merge until main protected quality is healthy and UI/Core/Combat/Graphics contract owners approve.

## UI / Graphics integration update (October 21)

The fallback rectangle helper accepts **opaque nonempty string IDs up to 160 characters**, matching Graphics #500 and the specialist UI alpha gesture #503, without truncation or local ASCII-only remapping. A repeated pointer-down on an already reserved pointer ID cannot retarget the action. Node regression tests exercise these cases.

**Single gate only:** UI #503's stricter source-WebP-alpha resolver is the planned sole runtime classifier; do not install both the rectangle helper and alpha resolver as competing native LMB handlers. All helpers remain unconnected to live `web/online-game.mjs` and cannot mint/equip swords.

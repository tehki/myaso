# UI10 original Pre-Alpha 0.1 — game-first short desktop viewport

This **DRAFT** is a presentation-only child of [Main Pre-Alpha original Silver + opt-in Chat C1 #708](https://github.com/tehki/myaso/pull/708), exact source `ed48ef74e4f88a8f92b1998574140e58d4655f74`. It surgically transplants the source-tested original HTML/CSS short-viewport solution from [Graphics3B UI review #702](https://github.com/tehki/myaso/pull/702), previously [native Chrome/Firefox #39670082478](https://github.com/tehki/myaso/actions/runs/39670082478) and [full protected #39670082619](https://github.com/tehki/myaso/actions/runs/39670082619) SUCCESS on their **different** source. We require fresh exact-head Pre-Alpha validation.

## User experience

At short desktop browser viewports (1280×720 and 1366×682), show the **entire original Combat arena Canvas** without vertical clipping or forced page scroll. The 14 original documented Combat controls stay available within real keyboard/mouse-operable native HTML `details/summary`, not deleted or hidden forever. Original R4 audio/music controls remain accessible. Only the small-height CSS rule compacts header and HUD and uniformly scales the `arena-wrap` 16:9 Canvas box. The game's pixel-buffer remains untouched (960×540); pointer mapping still uses the actual `getBoundingClientRect()`. The fallback full desktop/mobile layout is not changed in scope.

## Boundaries

Changes limited to `web/index.html` and `web/styles.css` plus reviewed layout QA modules, Node source tests and dedicated native workflow. No changes to Combat hitboxes, event phase, original Silver assets, authenticated WebTransport, existing Chat C1 bridge, core, server, screen-space aim transformation, Sound, World or package contents. This **does not** mean actual 4 players fit or play during chat; it is genuine offline browser HTML/CSS geometry acceptance only. Verify eventual joined 4-player/native Silver+Chat at the final source SHA separately. No camera or player teleports, synthetic item IDs or fake screenshots.

The dedicated CI tests same **actual native inner CSS viewport** in Chrome and Firefox through W3C `/window/rect`, the full displayed 16:9 original game Canvas in-page, zero artificial vertical scroll, original 14 instructions still available after genuine browser click open/close; locally serves original page and records screenshots and numeric geometry only on CI host. Layout tests do not replace full protected game quality.

Original Combo Pre-Alpha instant mouseDOWN light and 320ms held READY heavy remain owner-blocked [#696](https://github.com/tehki/myaso/issues/696); public Chat C1 default OFF; independent-host humans, immutable package/hash, staged rollback and Main/owner GO still required. **DRAFT / NO MAIN MERGE / NO DEPLOY / NO RESTART.**

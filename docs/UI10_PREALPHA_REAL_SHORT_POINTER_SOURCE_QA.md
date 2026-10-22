# UI10 Pre-Alpha — Native pointer-coordinate QA on the real scaled arena

**DRAFT / test-only descendant of [#729](https://github.com/tehki/myaso/pull/729) exact `a7735668a2365e285be8401c489d1f934016d5d3`.** This branch changes only the preexisting browser acceptance script and this documentation, **no product game code**.

## What extra evidence this must establish

Original four real Rust/WebTransport authenticated browser sessions (Chrome, Firefox, Chrome, Chrome) still draw four Silver Knights within one real frame, preserve true Chat C1 proximity, Enter/Escape focus and server input acknowledgments, and visibly fit actual CSS browser viewports (1280×720 or 1366×682). After native controls disclosure has opened and closed, a passive listener on the existing `#arena` Canvas records genuine W3C pointermove events at three different actual CSS positions inside the current short browser window. No synthetic `dispatchEvent`, game state change or fabricated aim packet is allowed.

For **each** real browser, three native WebDriver pointer movements must:

- Deliver trusted `pointermove` to the original Canvas, not an overlay or resized controls element.
- Round-trip screen `clientX/clientY` through *the actual Canvas `getBoundingClientRect()`* to the original **960×540** source backing pixel mapping within 3.1 source pixels, at 34%/33%, 51%/48%, 67%/61% of the actual viewport Canvas.
- Be free of held mouse buttons and produce **zero pointerDOWN/UP attacks**. Other original focus and gameplay event listeners remain untouched; read-only QA listener never intercepts, cancels or stops any pointer event.
- Retain original 14 Combat instructions, full on-screen 16:9 Canvas, visible chat composer, true server-backed four-player roster and original Silver WebP four-per-real-RAF evidence in the same test.

This proves a useful **native visual-to-source pointer geometry boundary** at short desktop viewports. It **does not** prove mouse-facing server authority, actual Combat hit/reach/damage, real roll-to-pointer, public chat, real swords, 4 operators on independent machines, or instant pointerDOWN light / 320ms server READY heavy. Those need Core8A/8C and Combat live approved v2 ingress, exact-head full protected CI, owner/Main GO, independent-host humans and staged rollback. Public Chat C1 remains OFF. No main merge, deployment or restart.

# M181 — Right-button Gesture Ownership and Cancellation

## Problem
The local and online arenas each used their own right-button tap/hold logic, with no
pointer cancellation or capture-loss handling. Releasing outside the canvas could
leave sprint held; an unmatched or repeated press could corrupt tap classification.

## Contract
- Both browser modes share the same right-button gesture implementation.
- A genuine right-button tap shorter than 180 ms emits exactly one kick on release.
- Holding for at least 180 ms enables sprint; releasing it does not kick.
- Pointer capture and a window-level pointerup fallback end an off-canvas hold.
- Pointercancel, lostpointercapture, window blur and explicit input reset cancel
  the gesture without triggering kick.
- Pointer ownership rejects unrelated release/cancel events. Repeated downs do not
  reset the original hold timer.
- Running-attack gestures use the same sprint classification as movement.
- No authoritative combat timing, stamina, damage, input packet, or protocol change.

## Validation
- Unit regressions exercise tap, hold threshold, off-canvas release, duplicate
  pointerup, repeated down, mismatched pointer IDs, capture loss, cancellation,
  and blur in the existing browser-runtime CI lane.
- Run full GitHub quality CI before merging.
- Playable build remains closed.

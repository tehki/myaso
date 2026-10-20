# R2 release-to-strike and RMB+LMB running attacks

## Intended controls

- Press and hold **LMB**: accumulate up to **320 ms** of local charge. No
  automatic light or heavy is sent while charging. Once the bar reads
  **READY**, continue to hold as long as you wish.
- Release **LMB** before 320 ms: request **one light attack**.
- Release **LMB** at or beyond 320 ms: request **one heavy attack**. The
  authoritative server **starts its 320 ms windup while held** and pauses
  in READY after that minimum. Releasing then activates the heavy; if the
  server has a few milliseconds remaining due to input transit, it completes
  them before impact. The heavy cannot hit while LMB remains pressed.
- Hold **RMB** for at least 180 ms to run, hold a movement key, then click and
  release **LMB** for a running strike. Mouse button chord events use native
  `mousedown`/`mouseup` fallback because a second held mouse button does
  not always emit W3C `pointerdown`/`pointerup`.
- Space+LMB keeps the immediate jump-attack commitment. E still requests its
  original authoritative heavy attack.
- Cancelling, losing focus or unmatched pointer IDs never commits an attack.

## Preserved safety and tests

The server enforces the **unchanged 320 ms** charge duration, 82 reach,
physical lunge, damage, guard and parry windows. During LMB hold, both
existing attack+heavy input bits signal a sustained charge (no wire-format
change); release sends only the selected strike. The server remembers a
completed charge until release and does not automatically activate it. The two browser clients share the same gesture classifier.
The running-attack intent is latched through the next input sample so releasing
RMB just after LMB cannot erase the running strike.

Browser flight acceptance written for *immediate LMB-on-down and 80 ms
auto-upgrade* must be updated and revalidated against genuine W3C inputs before
merging or deploying this gameplay change. Retain production rollback.

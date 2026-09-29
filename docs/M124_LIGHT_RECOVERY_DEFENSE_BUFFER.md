# M124 — Light Recovery Defense Buffer

## Goal

Make wheel-back defense feel responsive at the end of a committed light attack without turning recovery into a cancel.

## Rules

- buffer window: final **90 ms** of centered or directional light recovery
- only a **fresh block/parry press** can enter the buffer
- recovery always completes before block/parry begins
- an early held block does not become a free parry when the window later opens
- the normal parry window starts only when the buffered block actually begins
- no attack active, recovery, stun, guard, or stamina timing is shortened
- the buffer adds no packet, snapshot, action code, or protocol change

## Intent priority

If a late light attack is already buffered and the player then presses wheel-back inside the same recovery window, the newer defensive intent wins.

This lets a player change their mind late without receiving an early cancel.

## Acceptance

M124 proves in both browser and authoritative simulation that:

- a fresh late wheel-back waits through full recovery and then enters block/parry
- an early held wheel-back is not promoted into a buffered parry
- later defensive intent overrides an earlier buffered light
- existing M123 light buffering and held-input protections remain intact

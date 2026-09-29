# M93 — Indexed Kill-Event History

## Objective

Remove the per-connection linear scan of retained authoritative kill events from the 20 Hz snapshot loop.

## Base

M92 exact green head `44b8f586593b0e238f0f905a6654473b0ff4b9b3`, quality run `36017448296` PASS.

## Change

`GameState::kill_event_for_cursor` now treats the retained kill-event deque as a contiguous sequence window:

- return no event when the cursor already equals the next sequence;
- compute the cursor's wrapping offset from the oldest retained event;
- read that deque slot directly;
- verify the slot sequence before returning it;
- preserve the existing fallback to the oldest retained event for stale, missing, or unknown cursors.

The lookup changes from O(retained kill-event history) scanning to O(1) wrapping arithmetic plus one `VecDeque::get`.

## Why it matters

Every connected session asks for its next reliable kill event while holding the shared game-state mutex on each snapshot interval. With up to 256 retained kill events, removing the linear scan shortens this shared-lock hot path without changing delivery semantics.

## Focused validation

`kill_event_cursor_lookup_spans_sequence_wrap` installs retained events at:

- `u32::MAX - 1`
- `u32::MAX`
- `0`
- `1`

and verifies:

- each retained cursor resolves exactly;
- cursor `2` (the next sequence) returns no event;
- a stale cursor falls back to the oldest retained event;
- an unknown future cursor preserves the same oldest-event recovery behavior.

## Unchanged

No kill-event wire format, ordering, retention depth, reliable queue/backpressure behavior, snapshot protocol, combat scoring, match lifecycle, gameplay, persistence, deployment, or runtime activation changes.

## Rollback

Close/discard M93; M92 remains unchanged.

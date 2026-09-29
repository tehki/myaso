# M52 - Authoritative FFA Kill Feed

## Objective

Make killer attribution explicit and reliable in free-for-all combat: every connected player can see exactly who defeated whom without inferring attribution from score or death snapshots.

## Authoritative event

M52 adds a dedicated 16-byte reliable packet:

- protocol version: byte 0;
- packet type: `4`;
- reserved: bytes 2-3;
- kill-event sequence: uint32;
- killer net ID: uint32;
- victim net ID: uint32.

The packet is emitted only from the server's existing authoritative `CombatEvent::Death { fighter, killer }` result.

Snapshot encoding, snapshot packet size, score encoding, damage rules, and match rules are unchanged.

## Reliable delivery and backpressure

The authoritative clock records death events in a bounded 256-entry shared history.

Each connection receives a cursor initialized to the current sequence when it joins, so:

- existing historical kills are not replayed to a late joiner;
- kills that happen after join are delivered in sequence;
- a temporarily full reliable writer queue does not advance the cursor;
- kill events are retried on later snapshot ticks;
- kill events are prioritized ahead of optional background reliable catch-up frames;
- if a connection falls behind beyond the bounded history, its cursor resumes at the oldest retained event instead of deadlocking forever.

The existing reliable stream framing is reused. No second transport or stream is introduced.

## Browser presentation

The authoritative client decodes packet type 4 and calls the kill-event callback directly.

The arena displays a compact four-entry feed:

`#<killer> defeated #<victim>`

Rows also retain local identity markers for:

- "I made this kill";
- "I was the victim."

The feed is independent of the transient combat status line. It clears when the authoritative match lifecycle returns from match-over to a clean 0-0 rematch state.

## Deterministic coverage

Rust coverage proves:

- the 16-byte wire fixture;
- server history preserves event order;
- join cursors start after historical events;
- bounded history fallback remains live after overflow.

JavaScript coverage proves:

- the same exact 16-byte wire fixture;
- decoder validation;
- kill-feed presentation preserves killer/victim identity and local-role markers.

## Real-browser acceptance

The M52 `uikillfeed` flight starts three real clients:

- Chrome;
- Firefox;
- a second isolated Chrome.

It performs two distinct authoritative kills in one active match:

1. fighter #1 kills fighter #2;
2. fighter #2 respawns;
3. fighter #3 kills fighter #2.

All three browsers must converge on:

- newest feed row: `#3 defeated #2`;
- previous feed row: `#1 defeated #2`;
- consecutive authoritative event sequences;
- score state #1 = 1, #3 = 1, #2 = 0;
- correct per-client killer/victim "own" markers;
- no `VICTORY` or `MATCH OVER` state.

The acceptance cross-checks the reliable kill event against normal authoritative HP/death/score snapshots. No kill event, score, identity, HP, or death state is injected by the harness.

## Scope / risk

Base is M51 exact head `e6a2e83969e1b7612235e43890a0917eab9898ad`, validated by FULL quality CI #191 / run `35431881826`.

M52 adds one reliable packet type and UI/acceptance coverage. It does not change combat damage, action timing, movement parameters, snapshot format/size, kill target, match lifecycle, persistence, deployment, public bind, or runtime activation.

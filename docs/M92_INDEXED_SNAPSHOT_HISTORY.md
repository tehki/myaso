# M92 - Indexed Snapshot History Lookup

## Objective

Remove the linear scan used to locate acknowledged snapshot history entries on every snapshot build.

## Change

M91 guarantees that real snapshot sequences never use the reserved `0xffff` sentinel. M92 uses that invariant to map a requested sequence directly to its expected `VecDeque` offset from the oldest retained history entry.

The lookup:

- rejects `0xffff` immediately;
- computes the forward distance in the 65,535-value valid snapshot sequence space;
- handles the reserved-sentinel wrap `65534 -> 0`;
- checks the computed deque slot still contains the requested sequence before accepting it.

Both `advance_acknowledged_state` and `has_sequence` now use this helper instead of scanning the retained history.

## Performance effect

ACK lookup changes from O(history depth) sequence comparisons to O(1) arithmetic plus one `VecDeque::get`.

History storage, ordering, retention depth and ACK application remain unchanged.

## Behavioral contract

Unchanged:

- ACK validity rules;
- baseline dependency checks;
- acknowledged-state contents;
- history eviction/recycling;
- snapshot sequence generation;
- snapshot bytes/version;
- planning, freshness and interest behavior;
- combat, movement, input and persistence.

## Validation

The focused M92 regression builds retained history spanning the reserved wrap:

`65533, 65534, 0, 1`

and verifies:

1. each valid sequence maps to its exact deque offset;
2. `0xffff` is rejected;
3. an absent future sequence is rejected;
4. ACK advancement to wrapped sequence `0` removes only older entries;
5. acknowledged and newer retained sequence visibility remains correct.

The full Rust, inherited M64-M91, browser, FFA, input-loss and capacity suites remain required.

## Base / rollback

Base is M91 exact green head `1dd415ba622abe9277d32a1dd6dd3ba224c45f7b`, quality run `36015025537` PASS.

Rollback is to close/discard M92. M91 remains unchanged.

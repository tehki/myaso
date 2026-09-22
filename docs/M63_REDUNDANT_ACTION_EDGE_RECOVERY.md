# M63 - Redundant Action Edge Recovery

## Objective

Make the existing three-sample input redundancy recover committed one-shot combat intents when the datagram that first carried an action edge is lost.

The wire protocol has carried the newest input plus two prior samples since M2, and the server ingress already deduplicates accepted client ticks. Before M63, however, the connection loop applied only the newest accepted sample to the authoritative world. If an attack or dodge appeared only in an older accepted redundant sample while the newest sample had already released that button, the one-shot intent was discarded.

M63 closes that gap without changing packet size, trust, combat authority, or action cadence.

## Server input semantics

After ingress freshness/deduplication, M63 coalesces the accepted chronological batch as follows:

- movement comes from the newest accepted sample;
- facing comes from the newest accepted sample;
- held block state comes from the newest accepted sample;
- the newest accepted one-shot action sample carrying attack and/or dodge supplies those one-shot action bits.

Because ingress marks each client tick seen, a recovered action edge can be consumed only once. Older duplicate ticks in later redundant packets are rejected by the existing ingress window.

If more than one accepted historical sample contains a one-shot action, the newest action-bearing accepted sample wins. This prevents an older attack from overriding a newer dodge intent.

## Deterministic Rust coverage

M63 adds regression coverage proving:

1. an older accepted attack edge survives when the newest sample is idle;
2. newest movement, facing, and block state are preserved;
3. a newer dodge edge wins over an older attack edge;
4. the existing ingress deduplication remains the replay boundary.

## Real-browser loss acceptance

Scenario: `inputloss`.

The normal Chrome + Firefox authoritative PvP flight runs against a loopback-only server fixture with:

`MYASO_FLIGHT_DROP_NEW_ACTION_DATAGRAMS=1`

For this scenario only, the server deliberately discards every decoded input datagram whose **newest** sample contains attack or dodge. The following packet may still carry that action tick in its ordinary two-sample redundancy history.

Acceptance requires:

- both real browser clients connect through WebTransport;
- at least two first-send action datagrams are deliberately dropped;
- both sides still inflict authoritative damage;
- both browsers observe the authoritative HP transitions;
- normal snapshot, acknowledgement, frame-budget, and identity requirements remain satisfied.

Without redundant action-edge recovery, deliberately dropping every first-send action datagram prevents those attack edges from reaching the world and this scenario fails closed.

## Safety boundary

The loss fixture:

- is disabled by default;
- is configured only by the test environment;
- is rejected on non-loopback binds;
- does not weaken packet decoding, freshness checks, ingress history, session identity, or server combat authority.

Production/default runtime still receives every datagram offered by the transport.

## Wire / performance boundary

M63 changes no wire format:

- protocol version remains 1;
- input datagram stays 34 bytes for three samples;
- snapshot formats and 1100-byte realtime budget are unchanged.

The production input path adds only a bounded scan across at most three already-accepted samples.

## Unchanged behavior

M63 does not change:

- attack, dodge, block/parry, guard, damage, movement, death, respawn, or scoring constants;
- server simulation frequency;
- client input cadence;
- input redundancy count;
- snapshot/reliable replication;
- persistence;
- deployment/runtime configuration.

## Base / rollback

Base is M62 exact head `0c3c8bce935af2e3ee9915e50ee2e2554483a61b`.

At M63 branch creation, M62 fresh FULL quality #257 / run `35671822008` was in progress after correcting only the M62 acceptance negative control. M63 is developed on a child branch and does not mutate that tested M62 head.

Rollback is to close/discard the M63 branch/PR. M62 remains unchanged.

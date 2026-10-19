# World & Buildings C1 — Dormant doorway wire contract

This adds versioned Rust/JavaScript binary codecs only. **No live WebTransport handler uses these types.** They remain reserved until authoritative B2 zones, ACK reconciliation, server validation, collision and visibility gates are complete.

## Binary layout, little endian, protocol version 1

- Door request: **12 bytes**. Byte 0 protocol version 1; byte 1 packet type 5; byte 2 authored manifest version 1; byte 3 portal ID (1 Red Lion enter, 2 exit); bytes 4–7 request nonce u32; bytes 8–11 expected zone epoch u32. **No client-defined fighter identity, destination map or arrival coordinate.**
- Zone-entered ACK: **24 bytes**. Byte 0 protocol 1; byte 1 type 6; byte 2 manifest version 1; byte 3 target zone ID (1 Moonvale, 2 Red Lion Inn); bytes 4–7 accepted request nonce u32; bytes 8–11 authenticated fighter ID u32; bytes 12–15 server tick u32; bytes 16–17 spawn x in quarter units u16; bytes 18–19 spawn y in quarter units u16; bytes 20–23 new zone epoch u32.

Rust and JS tests assert identical byte fixtures, round trips, invalid packet length/type/version, unknown zone or portal, impossible spawn, and nonzero fighter ID and epoch. ACK encoding on the client is **test fixture convenience only** and must never relocate the player.

## Required future implementation — not delivered here

1. Server owns authenticated zone epoch and rejects a stale expected epoch/nonce before atomic movement. A correctly parsed packet is never authorization.
2. Add reliable ordered transport routing, explicit rejection response, connection binding and server-owned spawn coordinates.
3. After server ACK, reset client interpolation and input history, load interior assets and discard in-flight old-zone inputs.
4. Verify two real users share the public tavern while a third outside sees no interior snapshots, combat, kill events or offscreen enemy pointers.
5. Add walls/furniture collision, occupied-spawn safety, rollback and capacity tests. Preserve strict M142/M194 acceptance.

Independent of B2 PR #340 while its quality remains red. Live packets 1–4, protocol version and gameplay are unchanged. Merge is not deployment.

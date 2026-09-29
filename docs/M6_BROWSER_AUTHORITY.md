# M6 — Browser Authority and Reconciliation

M6 connects the browser-first M5 runtime to the authoritative M4 server while preserving the existing M2/M4 snapshot v1 layout.

## Runtime modes

The normal page remains the offline sparring arena. Authoritative mode is opt-in through the same browser page:

```text
?server=https://127.0.0.1:4433/game
```

For the loopback development identity printed by the Rust server, also provide the SHA-256 certificate digest as 64 hexadecimal characters:

```text
?server=https://127.0.0.1:4433/game&cert=<sha256-hex>
```

The certificate digest is converted to the WebTransport `serverCertificateHashes` option. Private keys never enter browser configuration.

## Wire compatibility

Snapshot protocol v1 is unchanged.

M6 adds realtime packet type `3`, a separate 16-byte processed-input acknowledgement:

| Offset | Bytes | Field |
|---:|---:|---|
| 0 | 1 | protocol version (`1`) |
| 1 | 1 | packet type (`3`) |
| 2 | 2 | reserved |
| 4 | 4 | processed client tick |
| 8 | 4 | authoritative server tick |
| 12 | 4 | assigned player netId |

The server delays this acknowledgement until the authoritative world tick has advanced beyond the tick at which the accepted input was installed. The ACK therefore does not claim an input is represented in authoritative simulation before at least one server step has consumed that input state.

Because snapshots and ACKs are independent QUIC datagrams, the ACK includes `serverTick`. The browser holds a newly received ACK until its latest authoritative snapshot has reached or passed that server tick.

## Prediction boundary

The browser may predict movement and facing so controls remain immediate. Prediction history is bounded and uint32-wrap safe.

When a processed-input ACK becomes eligible:

1. discard input history through the acknowledged client tick;
2. restore the local player from authoritative snapshot state;
3. replay only still-unacknowledged input;
4. keep combat outcomes authoritative.

The browser does not invent HP, guard, hit results, block/parry outcomes, death/respawn, or authoritative collision corrections.

## Remote players

Remote entities are rendered behind the newest server state by the configured interpolation delay (`90 ms`). Extrapolation is bounded to the configured horizon (`100 ms`). The renderer uses stable entity objects from M5's in-place snapshot store.

## Browser cadence

- browser rendering: `requestAnimationFrame`;
- prediction target: 120 Hz fixed step with bounded catch-up;
- input send target: 60 Hz;
- authoritative snapshot target: 20 Hz;
- hidden tabs: local render/prediction suspended and input released;
- realtime sends: latest-wins under backpressure.

## World / camera

Authoritative positions remain world-space coordinates on the 8192 × 8192 server map. The online renderer centers the camera on the predicted local fighter and projects remote world coordinates into the 960 × 540 canvas. Prediction is bounded by the same default server world dimensions, not by canvas dimensions.

## Evidence boundary

M6 deterministic tests cover ACK encoding/decoding, uint32 tick wrap, acknowledgement pruning, restore/replay, bounded interpolation/extrapolation, and certificate digest parsing. All inherited M1–M5 and Rust authority tests remain required by the same `quality` workflow.

These tests establish protocol and browser-runtime invariants. They do not by themselves establish production frame-time percentiles, mobile thermal behavior, public-internet latency quality, or hundreds-client capacity. Those require measured real-browser and load/impairment runs.

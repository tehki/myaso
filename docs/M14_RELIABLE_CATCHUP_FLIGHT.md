# M14 Reliable Catch-up Stall Flight

## Objective

Prove with a real loopback WebTransport connection that reliable-stream backpressure does not block realtime datagrams, and that queued reliable state eventually drains once the client resumes reading.

## Scope

- no production protocol or browser changes;
- reuse the M13 capacity-1 reliable queue helper;
- open a real HTTP/3 WebTransport session and bidirectional reliable stream;
- intentionally leave the reliable receive side unread while large framed payloads are produced;
- deliver realtime datagrams concurrently;
- require queue saturation and an outstanding stream write before the client begins draining;
- resume reliable reads and require a final catch-up marker to arrive.

## Boundaries

This is transport evidence, not a public deployment or WAN benchmark. Loopback timing is not claimed as internet latency evidence. Existing Chrome/Firefox and 64-client load gates remain the broader regression evidence.

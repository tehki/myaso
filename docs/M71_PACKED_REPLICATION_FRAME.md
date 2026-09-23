# M71 - Packed Replication Frame State Index

## Objective

Reduce authoritative replication-frame allocation and lookup overhead without changing snapshot, interest, or wire semantics.

## Change

`ReplicationFrame` now stores its authoritative per-entity state index in one preallocated `Vec<WireEntity>` instead of a `BTreeMap<u32, WireEntity>`.

The world already preserves fighters in ascending authoritative network-ID order. Frame construction now:

- reserves exactly the fighter count once for the packed state vector;
- appends quantized wire states in that existing sorted order;
- keeps the existing spatial cell index unchanged;
- resolves `frame.get(net_id)` with binary search over the packed vector.

A debug invariant verifies that frame input remains strictly sorted by network ID.

## Performance effect

Each replication refresh no longer allocates one tree node per fighter for the authoritative state index. At the 512-player target this replaces hundreds of per-frame map-node allocations with one contiguous vector allocation while preserving logarithmic identity lookup.

## Behavioral contract

Unchanged behavior:

- frame length / empty semantics;
- exact `WireEntity` quantization;
- spatial interest-cell construction and queries;
- snapshot record planning, ordering, encoding and byte budgets;
- combat, movement, simulation cadence, input handling, persistence and protocol version.

## Validation

The M71 regression builds a world from out-of-order joins, constructs a frame, and verifies exact packed identity lookups against `WireEntity::from_fighter` plus boundary/missing-ID behavior.

The inherited Rust, browser, FFA, input-loss and 512-player capacity suites remain required.

## Base / rollback

Base is M70 exact green head `a35a9bef9da77e56aba92701bdcf1a1bbb5d0156`, quality run `35867744408` unchanged exact-head rerun PASS.

Rollback is to close/discard the M71 branch/PR. M70 remains unchanged.

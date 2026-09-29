# M22 — Cross-browser authoritative PvP combat

## Objective

Prove the first real human-vs-human product loop through the production-shaped browser/network/server path: two independent browser sessions connect to one authoritative shard, see each other, send ordinary movement/aim/attack inputs, and both observe server-owned HP loss.

M22 does not add test-only combat authority, modify damage/range/timing constants, change snapshot semantics, or relax networking/security boundaries.

## Flight

The CI flight launches one headless Chrome session and one headless Firefox session against the same loopback authoritative server.

Each browser:

- establishes the normal reliable baseline and realtime acknowledgement flow;
- waits until the other live player is visible in authoritative state;
- aims toward that player and closes distance using ordinary movement input;
- sends bounded attack pulses through the existing 60 Hz input path;
- records HP only from decoded authoritative snapshots.

The production server's normal spawn layout already places the first two players close enough for deterministic engagement after a small approach, so no combat-specific server fixture is required.
## Acceptance

The paired flight passes only when both browsers independently report all of the following:

- two distinct authoritative player identities are visible;
- each browser identifies the other session as its peer;
- both the local fighter and peer fighter are observed below 100 HP;
- both local and peer HP show at least one downward authoritative transition;
- realtime snapshots, processed-input acknowledgements, and live inputs are sustained;
- browser frame p95 remains below 25 ms.

A connection-only, visibility-only, local prediction, synthetic damage injection, or server-only unit test cannot satisfy this gate.

## Safety and rollback

The flight server binds only to loopback and uses the existing loopback development certificate path. M22 adds no public bind, deployment, account/session system, persistence, production activation, or privileged runtime mutation.

Rollback is deletion of the M22 browser page/runner and CI gate; the exact-green M21 protocol/runtime remains the base checkpoint.

# Core 8B C3n — dormant trusted corpse-loot admission contract

**Status: Rust-only contract, not an authenticated live service.**

Stacked directly on [C3m #469](https://github.com/tehki/myaso/pull/469),
then C3l #463 → C3k #458 → C3j #452 → C3i #447 → C3h #439 →
C3g #434 → Core 8C C4d #393.

## Missing security integration identified

The grant-aware C3l/C3m PostgreSQL function is correct about **transactional
scope and one-use history** but accepts opaque `character_id`,
`worker_id`, `zone`, `epoch` and `grant_id` from SQL arguments.
Even an unexpired grant is **not an authenticated actor**. If a browser or
generic app role can call the raw SECURITY DEFINER function, presenting the
valid grant ID and impersonated character ID may transfer corpse items.

The preexisting [Core C4d #393](https://github.com/tehki/myaso/pull/393)
`world_mutation_contract.rs` deliberately has a typed
`TrustedWorkerVerifier`, but no actual production worker verifier.
The preexisting C3a `identity.rs` has session generation fencing but
no production authenticator/committed-session provider. Its in-memory
lease registry cannot independently verify current identity after restart.

## C3n safe boundary in `server/src/corpse_loot_admission.rs`

- Introduces a `TrustedCorpseLootVerifier` trait. A future **trusted
  server-only** adapter must independently verify the logged-in actor,
  current persisted character generation, death/corpse provenance,
  loot rights/range and a real matching issued C3m grant. It must
  **not echo raw IDs from the network**. There is **no default, grant-
  anyone or production verifier implementation**.
- Adds `VerifiedCorpseLoot` with **private fields and no production
  constructor**. Its only constructor is `#[cfg(test)]` for the
  test-only fake verifier. Implementing this for actual users will
  require a security review of a trusted server adapter **inside the
  crate**, not a web handler or public `From<RawRequest>`.
- `CorpseLootCommand::admit` checks both independently verified
  claims: C4d trusted worker authority and the trusted loot
  entitlement. It requires the world entity to be a **character**
  whose canonical big-endian ID **exactly equals** the entitled
  character ID, and rejects ground-item authority or mismatched
  character IDs.
- Prevents the two item IDs from being equal or reversed; rejects
  identical world-mutation and item-operation IDs; enforces C4d
  world payload and signed PostgreSQL BIGINT bounds on world/item
  revisions.
- Emits a typed, immutable parameter view **in the exact argument
  order of C3l's 14-argument grant-aware SQL function**, with
  canonical **16-byte big-endian** item, corpse, character,
  operation, world-mutation and grant IDs. The grant scope is
  sourced from the trusted verifier result, **not** untrusted
  caller-selected character/corpse/item IDs.
- Adds `CorpseLootReceipt::from_sql`, accepting only **strictly
  positive** world revision, both item revisions and world outbox
  sequence; explicitly preserves `replayed`. Historical receipts
  never renew an active player session or grant fresh loot rights.

No network routes, DB driver, database schema, live authentication,
production secret, grant issuer, actor entitlement or gameplay loop
is modified by this change. PostgreSQL must recheck **all** C3m
scope, worker/epoch, item CAS and grant-consumption state at commit;
typed admission alone is *not* enough.

## Regression acceptance

```sh
cargo fmt --manifest-path server/Cargo.toml -- --check
cargo test --locked --manifest-path server/Cargo.toml --lib corpse_loot_admission
cargo test --locked --manifest-path server/Cargo.toml --lib
cargo clippy --locked --manifest-path server/Cargo.toml --lib -- -D warnings
```

The unit fixtures use an explicit fake trust adapter in `#[cfg(test)]`.
They cover:

- Exact C4d-aligned big-endian SQL 14-parameter binding.
- Rejection of stale session generation, wrong owning character and
  unverified death-event evidence **in the fake test verifier**.
- Rejection of untrusted worker claims, a worker authorized for another
  character, or a ground-item worker trying to loot as a character.
- Rejection of duplicate/reversed item IDs, reused operation IDs,
  signed BIGINT overflow, overlong world mutation payload.
- Rejection of zero/negative SQL result revisions/outbox values.

**Verified locally on Serj Linux Rust 1.89, exact code head before
documentation commit:** six focused tests passed; full server library
**97 passed, 0 failed, 1 intentionally ignored existing subprocess
helper**; formatting check and strict Clippy `-D warnings` passed.
This is Rust-only validation, not a real authenticated integration
or C3m SQL validation.

Full protected exact-head `quality` remains a separate mandatory
gate. Do not weaken any Combat/Firefox test.

## Required integration and remaining blockers

1. Core 8A identity/networking: implement **actual authenticated
   player/session→character mapping**, commit/restore session
   generations durably, and never accept browser-nominated identities.
2. Core 8C: install **real verified worker/zone/epoch claims**,
   reconcile C4d with the C3n typed binder, and provide a least-
   privilege **parameterized** PostgreSQL driver. All SQL privileges
   must be closed to generic clients.
3. Combat and World & Gameplay: create a trusted immutable death
   ticket/loot policy service, verify corpse provenance and access
   rights/range/cooldown, and issue C3m grants from a controlled,
   audited server transaction. No grant issuer exists yet.
4. Magic & Items: approve C3f canonical byte layout and
   C3l/C3m item provenance, reconcile local MYTX writer with
   PostgreSQL before any online inventory; never run dual
   authoritative writers.
5. Economics and Deployment: check future cross-character
   trade/property/currency atomicity, WAL/backup/replica failover,
   outbox delivery/ACK and 60 Hz-safe async latency budgets.

No live corpse loot, production deployment, merge to main or
Moon Coin settlement. Coordination:
[Development Center #360](https://github.com/tehki/myaso/issues/360).

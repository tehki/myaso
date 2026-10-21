# Core 8B C3ab — journal-derived proposed pickup observer source (P0 / DRAFT)

**Authority:** Moon Games First Playable / Core #432 / Main #360. Direct child of Core C3z [#619](https://github.com/tehki/myaso/pull/619). Does **not** merge/activate any branch. Existing `MYTX` one local writer is the **only** durability source for the observer event. No additional ledger, independent `outbox` database, shadow item writer, or changed journal wire format.

## Why

C3z persists original proposed exact rack click envelope and one physical Ground→MainHand ownership operation atomically in **one** immutable MYTX V2 record. The next necessary property is recovering the same event after a process crashes **between durable commit and subscriber delivery**. A separately mutating Items `MYASOL03` authority can still claim the SAME sword belongs to another player after restart, as demonstrated independently in Core #432; do not activate both writers.

## Implemented (offline only)

- `ProposedBoundPickupObserverEvent`: immutable, *historical* canonical `journal_sequence:u64`, `OwnershipTxnId(u128)`, one original full `OwnershipOp::Move` with separate `ItemId(u128)` and exact Ground/Equipped source and target, plus the original full `ProposedRackPickupEnvelope` of authenticated-*candidate* context (socket index, distinct u128 ground entity, character u128, session generation, map revision, World epoch/tick, observed item mutation revision).
- `DurableItemJournal::proposed_bound_pickup_observer_page(after_sequence, max_events)`: immutable in-process projection of **ONLY V2** commits, bounded to 1–64 entries per call; returns `journal_head` even if there are no matching events. V1 operations do not pretend to be pickup events. Cursor is strictly greater than `after_sequence`; `u64::MAX` safely yields no events. Reject invalid page limits and poisoned local writer.
- After a durable MYTX V2 commit, the *same* active journal instance records an in-memory ordered event under the committed journal sequence. On restart, scanning the **same checksum/semantic-validated MYTX V2 records** deterministically reconstructs the same event sequence and payloads. Exact metadata and item transaction are not written twice. An identical lost-ACK transaction replay returns its existing immutable event; forged metadata cannot substitute.
- The source is deliberately historical: after the item drops, the original committed pickup event remains **true**, but it is **not** evidence that the original player still has the sword equipped. Consumers must read current authoritative item state and use the same writer lineage/epoch.

## Negative and crash acceptance

New offline regression 1: same original sword is created V1, picked up V2 at journal seq2, dropped V1 at seq3, picked up again V2 at seq4 with fresh mutation watermark, and dropped V1 at seq5. Exactly **two** V2 events appear, ordered seq2/seq4, regardless of V1 gaps, page sizes, repeated idempotent retry or restart. `journal_head` reports seq5; current Ground wins over the historical MainHand V2 event. Zero/65 size pages fail closed, max cursor safe.

New offline regression 2: a **real separate Rust child process** durably commits the first V2 pickup but stalls **before observer delivery** while still holding the exclusive local OS writer lock. The parent checks the lock is busy, SIGKILLs/reaps the child, then exclusively reopens the journal and reconstructs the exact one historical pickup event from V2. The original transaction replays idempotently; altered lease generation fails, no extra sword or event is minted. Three other intentional subprocess helpers remain ignored directly but are executed by their parent tests; new child helper is also intentionally ignored when invoked standalone.

Exact Serj Linux Rust 1.89 local: **6 focused C3z/C3ab tests pass**, **134 full Rust library tests PASS, 4 intentionally ignored helpers**, strict all-target Clippy/fmt and diff check required before committing. Protected exact-head GitHub quality pending.

## NOT IMPLEMENTED — RELEASE HOLD

This is a **reconstructable observer source**, NOT a durable subscriber ACK cursor, monotonic independently acknowledged delivery store, authenticated packet or a usable live event transport. There is NO actual fan-out/claim that four browsers received it; no signer/MAC, authenticated 8A login/session, 8C authoritative completed zone/epoch/LOS, approved cm conversion, Items current physical ground mapping, Physics complete same-tick reach witness, distributed/global fencing or selected production canonical writer. A delivery consumer must correlate the original committed MYTX V2 record to approved authoritative current state, store its own delivery cursor safely or use idempotent ordered snapshots, and never infer current gear from historical pickup events alone. No automatic equip UI, Combat stat change, local→global writer upgrade, schema migration, or public TryPickup route is authorized.

Protected [#619 quality #39640841234](https://github.com/tehki/myaso/actions/runs/39640841234) FAILED inherited Combat M194 native browser strict guard/parry check, not fixed or waived here. Main Orchestrator #360 alone selects integration and may merge after exact-head protected green, real two-host/four-browser M1–M5 acceptance and explicit approval.

# Core 8B C3w — local one-writer physical sword race and receipt proof

## Purpose

First Playable P0 #480 / canonical writer and identity gate #432. Stacked as a **draft test-only child** of C3v #583. This integration regression uses the existing Core C3e `DurableItemJournal`, Core C3u/C3v exact rack candidate, Core 8B `SessionLeaseRegistry`, current `MainHand` snapshot, and the four original Greyhaven reviewed source labels. It does not create an item ledger, wire opcode or live server handler.

## Executable behavior

One actual mutex-serialized single-writer journal is shared by two simultaneously started Rust threads. Both attempt **the same physical canonical sword** using separately committed synthetic session generations. The winner obtains one persisted `Ground→MainHand` receipt; the other fails current rack membership. Item count remains exactly four. Reapplying the identical `OwnershipTxnId` and mutation batch returns the original durable receipt and does not spend another sequence. Another still-available physical sword is not allowed into the winner's occupied `MainHand`. The losing player's old session generation is superseded; subsequent stale-lease acquisition fails without a durable mutation. After journal close and reopen, both the receipt and the one current owner are recovered; the sword's rack socket remains absent.

## Security caveats / current Gate B blocker

The test-local helper holds one `&mut DurableItemJournal` across exact selection and durable application to eliminate a **local** preflight→writer TOCTOU. It **does not** prove same authoritative world tick, independent-host epoch fencing, real authenticated Core 8A character binding, Physics reach/LOS, or actual trusted Items current `GroundDrop`. Legacy u64 IDs and world-unit→cm ratio remain **synthetic registration and test-only conversion**.

**Important unresolved receipt-envelope gap:** C3e `verified_receipt` keys idempotency on `OwnershipTxnId` plus `OwnershipOp` batch; it does not persist the whole clicked socket / ground entity / observed per-item mutation revision or authenticated request/lease generation. Thus it is **not sufficient as a signed ACK for an untrusted UI click**, even though it safely proves that the canonical item move itself committed. The live protocol must durably bind a fully authenticated, typed, versioned request envelope to the committed operation receipt, reject conflicting operation-ID reuse, and provide a single current vs historical ownership snapshot/outbox. Do not authorize live pickup by composing these standalone test functions.

C3e uses cooperating local `flock` and hard-linked append-only files: this test is NOT multi-host fencing, PostgreSQL primary CAS or World 8C distributed transaction. Approvals remain with Core 8A, 8C, Items 2B, Physics 6, and Main Orchestrator #360.

## Exact local validation

On Serj Linux Rust 1.89.0, project-local TMPDIR:
- `cargo test --manifest-path server/Cargo.toml --lib alpha_current_rack_bindings::tests`: six focused tests pass.
- `cargo test --manifest-path server/Cargo.toml --lib`: **126 passed, 0 failed; 3 deliberately ignored helpers**.
- `cargo clippy --manifest-path server/Cargo.toml --all-targets -- -D warnings`: PASS.
- `cargo fmt --manifest-path server/Cargo.toml --check` and `git diff --check`: PASS.

Upstream C3v #583 exact-head protected quality #39623916256 **FAILED at inherited Combat M205**, not at Rust Core 8B. This does not waive any protected quality gate; the new child must be separately checked at its exact head. No `main` merge or deployment.

# Core 8B C3z — one MYTX V2 bound pickup record (offline P0)

**Repository** tehki/myaso; **stack** Core #541 → #568 → #577 → #583 → #596 → #606 → #613 → C3z. All stacked work is **draft**; no main release or deployment. Supports P0 #432 (Core canonical ownership), #488 (four exact Blacksmith rack swords), #480 (first playable).

## What changed

The existing **single** local `DurableItemJournal` owner retains its same `flock`, append-only hardlink-to-canonical publication, file and directory fsync, fail-closed replay, exact `ItemId(u128)` and atomic `OwnershipOp` batch. A NEW optional, versioned `ProposedRackPickupEnvelope` is appended **within the same MYTX journal record**, before the same checksum, not stored in a parallel ledger or second file. Canonical record V1 continues its original size/version/op encoding and replays unchanged. V2 is accepted for exactly **one** `Ground→Equipped(MainHand)` operation and has the original 80-byte C3x metadata, with all critical fields nonzero and reserved bytes zero.

`apply_proposed_bound_rack_pickup(txn, move, envelope)` compares caller-proposed recorded pre-pickup item mutation revision against the actual current C3e writer-owned item revision **inside the exclusive journal handle** before publishing; then appends the mutation **AND** envelope in one V2 durable record. In-memory transaction index retains an exact envelope fingerprint only by value, never by lossy hash. At restart, canonical V2 replay reconstructs the same exact `txn → envelope` index; corrupt format or pre-mutation revision aborts replay. `verified_bound_rack_pickup` returns the historical commit receipt only if both the canonical operation and **the exact originally persisted envelope** agree. Replaying a V2 transaction with an unbound V1 caller, a different socket, ground entity, session generation, World epoch/tick, or observed item revision is denied even if the item operation alone is identical. A later legitimate drop does not delete historical proof and must not be presented as **CURRENT** MainHand gear.

**Do not call this signed or authenticated**: the envelope comes from a proposed trusted server caller and is only syntactically validated. This is a narrow local-POSIX implementation. The 8A authenticated connection/character/session, 8C authoritative CURRENT completed world tick+epoch+zone+map, collision-checked actual Items2B ground entity→physical item registration, Physics complete same-tick reach/LOS, World-approved cm transform, and single **distributed epoch-fenced** production writer are STILL MISSING. There is **no live TryPickup opcode, no cross-host CAS, no observer outbox atomically committed, no remote ACK and no player-authenticated browser interaction** here. Owner must choose and integrate one canonical storage engine; current MYWLD003 prototype must never run as a second live writer. Existing canonical V1 `verified_receipt` remains an operation-history proof, **not** an authenticated click ACK.

**Design limitations**: local C3e replay maintains transaction IDs and metadata in memory with no retention/compaction; journal checksums are non-keyed corruption detectors, not signatures; this record format is not an approved forward migration for production or interoperable network wire. The V2 record's version is the journal header byte, and the enclosed C3x 80-byte envelope contains no independent version. The entire future observer outbox must be committed atomically alongside the same V2 item transaction or be reconstructible deterministically from it.

## Offline regression gates

- Legacy V1 Create + bound V2 Ground→MainHand replay in one exclusive local writer, exact receipt after real close/reopen.
- Identical V2 retry remains idempotent, while wrong session/world epoch/tick/rack/ground entity/item mutation and V1-unbound downgrade attempts fail closed without spending another sequence.
- Old item revision after movement and return to exact same rack (ABA) cannot commit.
- Wrong item and wrong owner cannot win/forge MainHand via same txn.
- Semantic corruption of rack metadata with a recomputed valid legacy checksum still aborts restart.
- Historical V2 receipt remains true after a legitimate drop, but the current sword location is Ground, not the old player's hand.

**Exact local Serj Linux Rust 1.89**: 4/4 focused new tests PASS, full server library **132 PASS / 0 FAIL / 3 intentionally ignored helper entries**, strict all-target Clippy PASS, rustfmt + diff check required before publication. No bypass of full protected GitHub quality. Direct predecessor #613 protected quality [#39639105888](https://github.com/tehki/myaso/actions/runs/39639105888) **FAILED at Combat M194 (authoritative parry instead of expected guard-break block)** after its 128 Rust library tests passed; unrelated protected gate remains a HARD HOLD.

## Production acceptance still required

Same-tick authoritative 8A+8C+World+Items+Physics *one-owner* committed `TryPickup`, chosen single writer global epoch-fence, unique durable request+outbox, verified rack removal and correct MainHand on all four actual browsers, lost-ACK retry/reconnect/kill+drop/second-owner pickup and exact same sword ID. Main Orchestrator #360 alone may merge/enable/deploy after full protected green.

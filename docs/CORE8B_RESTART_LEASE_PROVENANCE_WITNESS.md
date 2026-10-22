# Core 8B P1 — restart/reconnect identity provenance negative witnesses

Scope: review-only `server/src/identity.rs` on the pre-existing Core C3p / PR #499
stack, **not live WebTransport or Pre-Alpha 0.1**. This is a **known unsafe
integration example**, not a production exploit or an implemented secure login.

## Concrete finding: process restart loses volatile generation high-water

`SessionLeaseRegistry` checks generation monotonicity **only for leases that its
current process has seen**. `CharacterRecord::decode` checks the existing 36-byte
MYCH record's format, FNV checksum and nonzero `CharacterId`. It does not prove
that the record was committed by an authenticated storage authority after the
last server process; the code explicitly documents that requirement.

The test `restart_without_committed_generation_advance_exposes_lease_aba`
shows that, after a simulated server-process loss, a new default registry
accepts the *previous* durable `(CharacterId, generation)` with the *same*
locally recycled `connection_id`. The two `SessionLease` values are equal and
`is_current(previous)` on the new registry is true. This is evidence that the
pure volatile fence **cannot authorize live restart** by itself, NOT a claim
that a real network socket or token can survive a process crash. A fresh
*durably committed* generation **before** admission makes those leases unequal,
rejects the old one, and prevents its delayed release from evicting the new.

The test `well_formed_checksum_does_not_authorize_claimed_character_or_generation`
shows a recomputed FNV32 checksum on a substituted `CharacterId` and generation
passes format validation. The unauthenticated review API will activate it if
called. A checksum is not a signature, account identity, or proof of database
CAS, and live callers must never derive ownership from untrusted bytes.

## Required contract / blockers (Core8A + 8B + 8C + Main)

1. Trusted account authentication resolves the server-side `CharacterId`; no
   browser input/body may select the target ID or session generation.
2. A **single** durable authority atomically reads and commits the advanced
   generation for that character (CAS/fence + fsync/transaction), including
   after crash and before exposing the new session/World actor. On exhausted
   `u64::MAX`, reject login/reconnect; no wrap or zero issuance.
3. The live connection must be uniquely bound to that committed generation,
   server-issued actor/incarnation and current World/zone owner epoch. All
   gameplay and item mutations check those fences together under the World
   authority lock; a transport ACK proves neither an action nor a HIT.
4. In-flight inputs, delayed old close/release, reauthentication, BFCache
   return, duplicate connection IDs and split-owner races cannot revive an
   expired generation or authorize a stale actor. One authoritative item writer
   is independently required before any live inventory transfer.
5. Provide genuine independent authenticated clients + crash/reconnect tests
   including old-generation replay and exact tick/owner changes. Do not infer
   pass from this Rust-only unit fixture or current MYCH checksum.

**Not implemented:** the authenticated account lookup, durable CAS/transaction,
boot-epoch source, quiescent source inventory, live QUIC/World lease admission,
expiry state, production DB, migration and central integration. No native
Combat M107/M121/M143/M194 acceptance waiver, no main merge, no deployment.

Related: Core #405, source Items #432, Main #723 and Pre-Alpha #695. The
independent Core8B ephemeral net-ID exhaustion safeguard #748 remains P0;
this review-only witness is unrelated to live admission paths.

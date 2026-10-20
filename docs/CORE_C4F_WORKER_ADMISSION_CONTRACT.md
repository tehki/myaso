# Core 8C C4f — trusted worker admission adapter contract (dormant)

Stack: C2a #365 → C4a #381 → C4b #388 → C4c #390 → C4d #393 →
C4e #404 → **C4f**. The Development Center alone controls merges
and production activation. No live auth, movement, network or DB code was
changed by this increment.

## Why

The C4d `TrustedWorkerVerifier` deliberately had no production
implementation. Transport/session authentication (Core 8A/8B), the current
worker/zone/epoch (Core 8C) and the atomic PostgreSQL mutation (C4d)
must be connected *without* accepting a client-asserted worker identity.

`server/src/worker_admission.rs` adds a narrow **dormant** adapter contract:

- `WorkerAdmissionClaim` carries a server-selected authenticated
  connection handle, entity, expected zone/epoch and session generation.
  **It does not carry a claimed worker ID.** Client packets cannot
  themselves create a trusted session handle.
- `AuthenticatedWorkerSessions::authorized_worker_for_entity` must be
  implemented by an *actual* authenticated Core 8A/8B backend. It must
  derive the worker ID from the live transport connection and check
  revocation, generation fencing and entity permission, not from request
  fields. No default, accept-all or client-backed implementation exists.
- `AuthoritativeZoneReader::snapshot` must be backed by trusted durable
  authority (not client-rendered zones, an async standby, or an
  uncommitted remote worker message). An ambiguous/failed read rejects.
- `WorkerAdmissionVerifier` implements the existing C4d
  `TrustedWorkerVerifier`, returning a crate-restricted
  `VerifiedWorldAuthority` only when authenticated worker ID,
  zone and authority epoch match a non-frozen, non-retired snapshot.

The private `VerifiedWorldAuthority` fields remain inaccessible
to external code; a crate-restricted constructor supports this
adapter. It is not safe for arbitrary internal callers to construct one
without verified authority.

## Critical race and trust boundary

This verifier is **preflight only**, not a write authorization decision.
The snapshot can turn stale between the admission read and a mutation.
Every real write must *still* execute C4d `commit_world_mutation` on
the SAME primary, which locks the authority row and checks current
owner/zone/epoch and exact world revision atomically with the state,
receipt and outbox write. A historical receipt grants no current authority.

An implementor of `AuthenticatedWorkerSessions` is not automatically
secure just because it implements a Rust trait. The external backend
must actually authenticate worker credentials, bind the connection and
entity, and re-check live session revocation. No such backend is
installed or activated here. No network authentication,
cryptographic session attestation, DB driver, worker registration,
primary failover or multi-host partition test is supplied.

The `AuthenticatedWorkerSessions` permission method is entity-specific:
a peer cannot gain authority to a different character or physical item
just by knowing its ID. Full player-account ownership and ACL policies
remain a Core 8B integration requirement.

## Local and CI acceptance

The Rust 1.89 unit suite covers:
1. Authenticated live owner bound to canonical big-endian SQL parameters.
2. Different authenticated worker unable to impersonate the owner.
3. Missing, revoked and generation-stale session rejected.
4. Wrong entity admission rejected.
5. Wrong zone or authority epoch rejected.
6. Pending/frozen handoff and retired entity rejected.
7. Unknown or unavailable durable authority rejected.
8. Source worker fenced after committed newer-epoch handoff.

Run:

```sh
cargo fmt --manifest-path server/Cargo.toml -- --check
cargo test --locked --manifest-path server/Cargo.toml worker_admission:: --lib
cargo test --locked --manifest-path server/Cargo.toml --lib
```

No production 8A/8B provider, actual SQL connection or independent-host
session admission has been tested. Full protected `quality` CI must pass
at the exact C4f SHA, including all genuine browser Combat gates, as
must all parent PRs. Independent-network acceptance is future work.

## Follow-up integration

Core 8A supplies server-owned authenticated connection handles and
reconnect lifecycle; 8B supplies durable character identity and
entity permissions; 8C supplies the trusted current authority
store/zone memberships; C4d applies the definitive same-transaction
fence. Build a bounded async DB adapter outside the 60 Hz simulation tick,
handle unknown commit outcomes explicitly and preserve original
Combat, inventory and replication behavior.

**DORMANT ONLY — NO MERGE OR PRODUCTION ACTIVATION.**

# Core 8B C3l — fail-closed scoped corpse-loot grants

**Status: DORMANT PostgreSQL hardening only. NOT authenticated player loot.**
This increment stacks on C3k [#458](https://github.com/tehki/myaso/pull/458),
C3j #452, C3i #447, C3h #439, C3g #434 and Core 8C C4d #393.

## Failure mode and new guard

C3k proved that moving exactly two items from one corpse into one inventory
can be atomic, but its raw SQL function accepted an arbitrary caller-chosen
character ID, corpse ID, worker ID and world epoch. A valid source-location
CAS alone is **not permission to loot**. In particular, a caller with SQL
EXECUTE permission could nominate another character and valid corpse items.

Migration `007_scoped_corpse_loot_grants.sql` makes this fail closed *unless
the database already contains an explicit, scoped, live grant*:

- **The old C3k grant-free, 13-argument SQL entry point now raises an error.**
  It is not a fallback. Existing pre-grant historical receipts remain
  preserved, but they cannot automatically be reauthorized through the
  new interface. A production migration would need an explicit review
  of legacy pending transactions and receipts.
- A new protected `corpse_loot_grants` table records an opaque nonzero
  128-bit grant ID, **exact character ID, corpse ID and sorted pair of
  item IDs**, an expiration timestamp, revocation flag and one
  transaction ID that consumed it.
- There is deliberately **no general-purpose grant issuer function**.
  In isolated tests the PostgreSQL owner directly seeds a grant.
  Production issuance requires a *separate, trusted server path*
  that verifies player identity, corpse death event provenance,
  proximity, rights/consent and loot policy, and records a defensible
  audit link before any grant exists. **None of that is implemented here.**
- The new grant-aware 14-argument SQL entry point checks all request
  fields against the immutable corpse receipt, then locks the matching
  grant `FOR UPDATE`. Missing, expired, revoked, already-consumed,
  wrong-character, wrong-corpse or wrong-item-pair grants reject before
  item/world mutation.
- The grant is consumed in **the very same PostgreSQL transaction**
  as the fenced world revision, two item CAS changes, immutable
  receipt, C3j global operation-ID reservation and both linked
  outbox events. Any SQL error or SIGKILL before outer COMMIT rolls
  **all** of those effects back; the grant remains available.
- An identical retry of a completed committed operation returns
  **its historical immutable result** even if the original grant was
  later revoked or expired. It does **not** acquire new loot rights.
- Two concurrent SQL sessions contending for one grant cannot both
  consume it: the first committed operation wins; all state from the
  losing transaction rolls back.

## Explicit warning: this is NOT end-to-end authentication

The grant ID is not itself a cryptographic identity credential. The SQL
still receives arbitrary `p_character`, `p_worker`, `p_zone` and
`p_epoch`. **Someone who learns an existing valid grant ID and has
EXECUTE on the SECURITY DEFINER function could impersonate the
entitled character by supplying its ID** if no real server authentication
and request binding exists. Therefore even grant-aware SQL must not be
exposed to browsers, broad DB roles, unauthenticated network handlers,
or external clients. No trusted grant issuer or verifier exists yet.

Only the schema-owner test fixture may insert grants in this PR.
Production grants, death attestations, permissions and API wiring are
explicitly blocked until identity and signed/trusted server admission
are delivered and reviewed. Likewise, do not infer corpse rights from
item location, from an opaque grant ID alone, or from an unverified
world-worker ID.

## Isolated acceptance

The dedicated CI `.github/workflows/core-c3l-corpse-grants.yml`
installs migrations 001..007 on one ephemeral PostgreSQL 16 primary,
and runs `scripts/verify_scoped_corpse_loot_grants_pg.py` with
`PGDATABASE=myaso_c3l_test`, `MYASO_C3L_TEST_ONLY=1`:

- No grant and the old grant-free function are rejected; no outbox/receipt.
- Expired, revoked, mismatched character, corpse or pair grants are
  rejected with **no grant consumption** or world mutation.
- Valid exact grant moves both items once. Replay of the same complete
  request returns the original receipt even after revocation.
  A second operation or changed grant for the same operation fails.
- A preemptively moved item makes the two-item batch fail and restores
  the previously unconsumed grant.
- Two independent PostgreSQL clients racing the **same** scoped grant
  yield exactly one complete atomic winner.
- A SQL client SIGKILL before its outer COMMIT restores the grant,
  both source items, world version, receipt and outbox; an identical
  retry subsequently commits exactly once.
- Restricted role cannot inspect, insert, update or delete grant rows.

Full protected exact-head `quality` is a separate mandatory gate.

## Production limitations and integration order

- C3f's proposed 26-byte canonical BE location format remains a draft
  requiring 8B/8C migration/schema review. The C3b MYTX file journal
  may not act as a co-equal production writer to PostgreSQL.
- No verified actor-to-character session binding, real C4d worker
  attestation, trusted death/loot grant issuance, distance/cooldown,
  item provenance, complete player authorization, multi-item arbitrary
  looting, currency/trade settlement, outbox consumer and ACKs, DB
  failover/partition recovery, 60 Hz-safe async adapter, or controlled
  production migration is delivered.
- SECURITY DEFINER and schema privileges must be reviewed with minimal
  EXECUTE grants, RLS and trusted service roles, not arbitrary web users.
- No protected combat test may be weakened. No merge to main, production
  restart, live loot or MOCMP deployment is authorized.
- Next integration must coordinate Core 8A identity, Core 8C world
  authority, Magic & Items, Combat, World & Gameplay and Development
  Center [#360](https://github.com/tehki/myaso/issues/360).

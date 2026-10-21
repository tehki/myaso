# Core C3m — immutable corpse-loot grant history

**Department 8B. Dormant PostgreSQL safety work.** Stacked on
[Core C3l #463](https://github.com/tehki/myaso/pull/463) → C3k #458 →
C3j #452 → C3i #447 → C3h #439 → C3g #434 → Core 8C C4d #393.
No production deployment, live loot, or verified player identities.

## Defect being closed

C3l introduced scoped, expiring, single-use corpse-loot grants but did
not enforce *immutable history* on the grant rows themselves. A privileged
SQL writer could silently rewrite the authorized character/corpse/item
pair, extend a grant's original expiration, change a consumed operation
to another one, reset it to NULL, or reverse revocation. The application
role has no direct table privileges, but schema-integrity guarantees
should also protect against future service bugs and accidental broad
database grants.

## New migration 008

`server/sql/008_immutable_corpse_grant_history.sql`, applied **after**
001–007 on the same trusted PostgreSQL primary:

- Adds an FK on non-NULL C3l receipt grant IDs pointing to real grants.
  Legacy C3k pre-grant historical receipts keep their NULL references;
  they cannot be re-authorized through the grant-free function.
- Adds a fail-closed **BEFORE UPDATE/DELETE** row trigger and
  **BEFORE TRUNCATE** statement trigger on the grant table. It forbids
  deletion/truncation and modifications to grant ID, character ID,
  corpse ID, sorted item pair or expiration timestamp.
- Allows only monotone `revoked: false → true`; never true → false.
- Allows only one `consumed_operation_id: NULL → receipt ID`.
  It must reference a real immutable C3k receipt whose grant,
  character, corpse and sorted item pair match exactly. An expired
  or revoked grant cannot be consumed. Once consumed, the ID
  cannot change or revert to NULL.
- Retains C3l's complete atomicity: grant consumption, both item CAS
  changes, C4d world mutation, immutable receipts, C3j global ID and
  paired outbox rows remain in **one** PostgreSQL transaction. A
  crashed/uncommitted transaction restores the pre-consumption grant
  and item/world state; a committed identical retry returns only its
  original historical result.
- Revokes public access to the new trigger function and keeps
  the grant table private. This is no substitute for least-privilege
  audited roles; schema owner/superuser can still alter objects.

## Disposable PostgreSQL acceptance

The workflow `.github/workflows/core-c3m-grant-history.yml`
uses PostgreSQL 16 with `PGDATABASE=myaso_c3m_test` and
`MYASO_C3M_TEST_ONLY=1`. It first executes **all existing C3l
grant acceptance** after installing 001–008, preserving its real
SIGKILL, grant contention, exact retry, revocation and scope checks.
It then tests:

- Even a schema-owner SQL UPDATE cannot modify the grant scope, any
  item ID, or the expiry in either direction; DELETE and TRUNCATE fail.
- A consumed operation can never be cleared, replaced, or
  reactivated; revocation cannot be reversed.
- A revoked unused grant cannot be manually consumed or revived.
- An unrelated *valid* receipt cannot be linked as consuming another
  grant; receipts cannot point to nonexistent grant IDs.
- A restricted application role cannot issue, read, change or erase
  the grant history.

Protected full exact-head `quality` remains a separate mandatory gate.

## Remaining authorization blockers

This is **database integrity, not live player authorization**. There is
still no real verified actor-to-character session binding, protected
death-event attestation, trusted issuer API for granting rights, proof
that corpse ownership/proximity/range/cooldowns permit looting,
trusted worker authorization, or externally audit-linked loot policy.
The existing grant ID is an opaque identifier, **not a cryptographic
credential**. A caller with knowledge of a valid grant ID and SQL
EXECUTE on the raw SECURITY DEFINER function may impersonate its
character by passing caller-selected identity/epoch values. Never
grant such EXECUTE permission directly to a browser or untrusted app.

Other blockers: C3f canonical 26-byte BE location schema review;
local MYTX→PostgreSQL transition (never permit co-equal live writers);
outbox consumer/ACK; >2-item atomic loot/trade/death batches; durable
worker identity and fencing across failover; async tick budget and
backpressure; production schema migration/TLS/backups/audits; real Moon
Coin settlement. No live inventory, main merge, process restart or
production activation is authorized. Coordinate via
[Development Center #360](https://github.com/tehki/myaso/issues/360)
and departments 8A/8C, Magic & Items, Combat and World & Gameplay.

# Moon Games Core 8B — IDR canonical subject and knowledge persistence contract V1

**Status:** P0 dependency / **DRAFT / OFF by default / no live migration**. Owner: Core 8B ([#653](https://github.com/tehki/myaso/issues/653)), under Main IDR [#636](https://github.com/tehki/myaso/issues/636) and First Playable [#480](https://github.com/tehki/myaso/issues/480).

This child is a two-parent reviewed integration of Core8B's existing `identity::CharacterId(u128)` and generation-fenced `SessionLeaseRegistry` with [IDR phase-1 #633](https://github.com/tehki/myaso/pull/633)'s dormant private `identity_disguise::SubjectId(NonZeroU128)` and per-observer Unknown/Claimed/Verified policy. The only textual merge conflict was in module declarations of `server/src/lib.rs`. The integration preserves the existing Core item journal, Items ledger and game runtime unchanged.

## 1. Canonical identity and trust model — implemented in this draft

1. `subject_for_authenticated_canonical_character(CharacterId) -> SubjectId` is a **lossless, nonzero u128 value-preserving typed mapping**. The ID source must be Core8B's authenticated persistent CharacterId, never a reused `u32` player net ID, ephemeral session/connection ID, actor appearance, or item/ground entity ID. Network clients cannot pick another actor's canonical subject from raw packet bytes.
2. `CanonicalIdrBridge::register_authenticated_player` requires the exact canonical CharacterId equal to a CURRENT authenticated Core SessionLease from `SessionLeaseRegistry::is_current`, whose `CharacterRecord` generation must have been committed by the trusted authentication store **before** activation. Tests use explicitly synthetic committed fixtures, not production authentication.
3. `register_trusted_sentinel` accepts a canonical CharacterId reserved by a future trusted NPC actor factory; player/Sentinel canonical collisions fail, but both use the SAME opaque canonical domain and indistinguishable public `ObservedIdentity` labels/appearances. **No** actor-controller bit or true-name audit fields enter the observer projection.
4. `resume_authenticated_player` only accepts a CURRENT higher generation, reusing the same permanent CharacterId; prior lease, stale connection or reused temporary net slot cannot introduce or observe as that actor. Bounded knowledge stays per-observer within the **existing dormant IDR `IdentityRegistry`**, not a second loot ledger.
5. An introduction is **only Claimed** for the chosen observer. The bridge has **NO** `verified_evidence` action exposed to clients or untrusted caller-supplied `verified=true` flags. A future server-only verified-evidence method must only be reached after trusted 8C/Physics evidence policy and a committed durable evidence record.
6. `tombstone_canonical_actor` removes in-memory observations involving that canonical ID; **durable tombstone high-water and name/alias reservation are not implemented**. A subsequent in-memory registration test proves knowledge is not inherited, not that disk rollback is safe.

## 2. Versioned durable data contract — SPECIFIED ONLY; no persistent writer yet

The producer is the **one approved canonical Core8B identity/knowledge persistence authority**, not a rival MYTX item ownership writer, browser cache or Items MYASOL03 data. The contract reserves a separate logical namespace under the trusted Core character store; physical file layout, fencing and credentials require explicit Main #360 approval.

| Logical field | Type / requirement |
|---|---|
| schema / magic | `MYID` + `u16 version = 1`; reject unknown newer version, nonzero reserved bytes and noncanonical length |
| durable order | monotonically increasing `u64 sequence` and globally unique store-lineage/authority epoch; reject zero, gaps, reuse and rollback |
| subject / observer | distinct canonical nonzero `CharacterId(u128)`; verified session generation belongs to **observer** for player-originated writes; temporary net ID never stored as the key |
| event kind | `ActorRegistered`, `PrivateNameChanged`, `AppearanceChanged`, `ClaimObserved`, `EvidenceVerified`, `AliasRevoked`, `ActorTombstoned`; only trusted policy may create EvidenceVerified |
| presentation epoch | `u64` monotonically advances on appearance changes; nonwitness claims/evidence from older presentation epochs are unavailable in current public view |
| knowledge key | `(observer CharacterId, subject CharacterId)`; one observer's claim or true-name verification must not leak to another |
| provenance | event ID; server-completed world tick, authority epoch, zone; verifier policy/version and evidence type, source event digest; witnesses confirmed using complete LOS at that same tick |
| certainty / claim | Unknown, Claimed, Verified with UTF-8 validated bounded claim; **a claimed name never upgrades to Verified via decode or client flag** |
| private-only data | canonical true name, immutable/private controller kind, authenticated account audit link, historical aliases and name reservations; server-owned, access-controlled, never in public observer projection |
| tombstones | permanent subject/alias retirement and high-water marker; no re-use of erased identity or inheritance of knowledge after restart |

Mandatory implementation policy: use a single exclusive **fenced** writer for IDR event ordering and a durable atomic publish+fsync for each event/observer revision. Do not send successful identity recognition ACK before canonical evidence and its dependent observation commit are durable. On crash after commit/before ACK, replay exact event ID+payload and return the same result; changed actor/observer/epoch/evidence with a repeated ID must reject. An uncommitted temp record is not evidence. Corruption, missing sequence and policy/schema downgrade **fail closed to Unknown** and prevent unsafe mutation. Observer projections must include canonical lineage/epoch watermarks, but **never reveal true subject ID/controller** on the public wire.

Do not use legacy unkeyed FNV checksums as a cryptographic integrity, epoch-authentication or anti-rollback guarantee. Trusted storage anti-rollback requires an external protected high-water or equivalent monotonic authority; restarting from a previously valid older snapshot must not resurrect verified knowledge or revoked identities. Store provenance/true names at rest only under approved access control and reviewed secret/key management; keys must never be exposed to a browser. Never treat a mere valid client chat text as verified evidence.

### Recovery / migrations (not yet implemented)

- **V0 / no IDR data:** all observer knowledge starts Unknown; fail closed. Import canonical player identities only from authenticated Core CharacterRecord and NPC IDs from the trusted server reservation registry; never infer from net slots.
- **V1 journal recovery:** validate records, sequence, authority epoch, actor identities and evidence trust policy; apply idempotently with a single owner; restore actor and alias tombstones before knowledge replay; stale session generations or presentation epochs cannot overwrite newer state.
- **Future V2:** add only explicit length-delimited optional fields and reviewed migration; unknown mandatory semantics block activation. A rollback to older V1 cannot silently discard revocations/watermarks. A reversible migration requires tested copy/verify/atomically swap, backup and canonical identity collision checks, never two independently active writers.
- **Moderator/security audit:** privileged, server-only exact actor/account link and actual true name with access-controlled immutable event audit. Ordinary observer UI cannot invoke audit capability or distinguish Human from Sentinel.
- **Privacy/retention:** persist minimal knowledge/evidence; revoked/tombstoned subjects invalidate all observer entries, retaining only required proof/audit tombstones under policy. No client-side personal recognition table is authoritative.

## 3. Dependency / GO gates

Core 8A [#654](https://github.com/tehki/myaso/issues/654): authenticated viewer-session-bound projection and ordering/ACK; no controller kind/raw subject ID/name revelation in public packets. Core8C + Physics [#655](https://github.com/tehki/myaso/issues/655): completed-tick authoritative evidence, current LOS and witness source, appearance epoch, no client-supplied verification flags. NPC 1: trusted stable canonical Sentinel identity allocation with player namespace collision prohibition. Main #360: single durable store/fencing/epoch selection, schema/provenance security review, crash/replay/ABA/tombstone acceptance, exact-head CI, controlled migration, rollback, four-browser disguise observations.

**Already tested** in this scoped dormant bridge: complete u128 mapping, two observers with distinct beliefs, false claim never verified, identical public Human/Sentinel Unknown appearance, stale/reused net slot denial across successive leases, in-memory tombstone clearing. **Still NOT tested/implemented**: real durable write/recovery, encrypted private names, rename reservations, audit permissions, trusted evidence source, cross-host epoch fencing, network transport, production migration, actual live NPC disguises. No claim of full IDR readiness.

**First Playable priority and physical sword ownership are unchanged.** No new public protocol, live identity or item writer, main merge or deployment.

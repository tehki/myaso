# myaso.io — Magic & Items Shared Integration Contract V1 (PROPOSED)


> **P0 OWNER AMENDMENT — 2026-10-21, CURRENT AND SUPERSEDING.** The Main Development & Deployment Orchestrator has adopted mandatory [M1–M5 City → Blacksmith Armory → four sword pickups → armed/unarmed PvP #480](https://github.com/tehki/myaso/issues/480) and the [physical sword-click integration contract #488](https://github.com/tehki/myaso/issues/488). This **replaces** the earlier unarmed-only recommendation in historical Section 7 and any statement below that *physical swords, pickups or equipping are optional P2 for First Playable*. Advanced Fire/Ember, reagent casting, trading, housing, full inventory UI, wallets and MOCMP remain P2 unless explicitly changed. This is a coordination/acceptance document, not live network or production configuration.

## 0. Mandatory P0 sword ownership and player-action contract (latest)

### Gameplay acceptance: 4 real players, one shared city, four separate physical swords

1. **M1 Greyhaven arrival:** four independent network sessions with server-derived character and Fighter identity occupy one authoritative walkable city zone. Their backpack and MainHand are initially empty, and Magic abilities are **not** required.
2. **M2 real Blacksmith sword rack:** use the [World #493](https://github.com/tehki/myaso/pull/493) location design and [Core 8C spawn #486](https://github.com/tehki/myaso/pull/486) for review, NOT as client authority. The exact Blacksmith rack sockets, server collision, range and line-of-sight still need joint World/Physics/8C sign-off. At least four distinct instances of the approved RustySword/IronSword kinds each have **one Core 8B canonical nonzero item identity** and one authoritative rack-ground position; free sandbox creation is a **trusted server operation**, never a client grant.
3. **Actual rendered-sword click:** Graphics/UI presents a geometrically aligned per-sword hit region; an LMB pointer gesture selecting the *actual visible sword pixels* creates one **intent**, never an immediate inventory change. UI/Combat must deterministically route one gesture either to `TryPickup` or the preexisting combat light/heavy input (never both); preserve pointer-down/up/cancel, RMB chords, canvas drag, facing, mousewheel roll/parry and Space semantics. All unknown, stale, dragged-away or canceled selections reject without phantom strikes.
4. **Exactly one authoritative acquisition:** Core 8A verifies the current authenticated session and transmits the opaque request ID plus selected item ID; Core 8C derives current Fighter, completed world tick, zone, position, range, line of sight and active writer epoch; Items checks item `GroundAtRack` presence, amount, equip eligibility, capacity and empty `MainHand`; Core 8B commits the **rack → equipped** move and corresponding receipt/outbox *once* under **one fenced canonical writer**. Do **not** use a local `u64` prototype checkpoint as a second live item writer, or stage a separate accepted pickup before equipment if failure could publish half of the event. A simultaneous second click loses deterministically.
5. **Correlated outcome:** only after durable commit, the requester receives `PickupAccepted` identifying the canonical item, MainHand and authoritative world revision; competing/invalid requests receive a reasoned `PickupRejected`, and duplicate request ID is answered from the previous durable receipt. The server replicates rack disappearance + equipped-hand ownership from the **same committed revision** to all four players. UI cannot predict success by animating a sword into the hand.
6. **M3/M4 real fighting:** Combat resolves actual `UNARMED` (fists with shorter reach and appropriate damage/recovery) vs `SWORD_EQUIPPED` (actual owned MainHand sword ID with reviewed reach/damage/parry). No default invisible sword or client-specified damage bonus. Death, drop, disconnect/rejoin and another player's pickup preserve a *single item owner/location and stable canonical ID*.
7. **M5 real continuity:** independent Chrome/Firefox browsers on separately operated machines prove four-player join, walk to armory, click physical rack sprites, authoritative ACK and observer convergence, sword/fist combat, death/respawn, reconnect, stale epoch rejection and recovery after an ambiguous ACK/crash. Full protected CI and exact package SHA/rollback remain central Main Orchestrator gates. Never substitute offline Rust/domain fixtures, local tabs, a method-invoked click, screenshots or animation-only simulations.

### Minimal interoperable request/receipt design — proposed, NOT a deployed wire schema

| Stage | Trusted producer | Minimum requirements |
| --- | --- | --- |
| Renderable rack appearance | World 9 + Graphics, from Core 8C committed world item | Immutable canonical per-sword ID reference, current zone/world revision, sword kind and render pick geometry. A browser may *display* an ID, never mint/authorize it |
| `TryPickup` intent | UI → Core 8A | Item ID + unique client operation/request ID; selected sword only. **No trusted actor, zone, inventory, range, position, hit, damage or session lease in a client field** |
| Single-writer admission | Core 8A/8C/8B + Items 2B | Authenticated current character/epoch, authoritative World tick, valid reach/LOS/zone, live Fighter, vacant MainHand, exact expected rack source and absent previous committed move |
| Receipt | Core 8B authoritative writer | Accepted OR reasoned rejected, immutable operation identity, resulting location/equipment/owner and revision; durable ACK replay, fencing, crash recovery |
| Replication | Core 8A → Graphics/UI/Combat | Only committed item/rack removal and hand equip in the same order/revision for all four clients; Combat loadout uses this same stable ID |
| Rollback/recovery | Core 8B/8C + Combat | Precommit errors publish nothing; postcommit lost ACK returns existing result; stale worker and reboot cannot duplicate sword or resurrect rack entity |

**Do not fix unapproved canonical enum bytes by guessing.** The existing Items prototype uses `ItemStack.id: u64` and `MainHand` enum; Core 8B uses `ItemId: u128` and numeric equipped slots. Assigning slot tag `1` or widening `u64` is **not approved** without a versioned collision-safe namespace/slot mapping in [Core integration gate #432](https://github.com/tehki/myaso/issues/432). Existing [Items 2B atomic pickup/equip draft #495](https://github.com/tehki/myaso/pull/495) tests local MYWLD003 mutation/recovery and [Core 8B four-sword journal fixture #492](https://github.com/tehki/myaso/pull/492) tests canonical item ownership/races, but these are **different isolated authorities** and may not be joined by double-writing their local checkpoints.

### Mandatory ownership and blocker routing

- **Items 2B** implements physical item/equipment domain and one rack→MainHand operation using Core's chosen writer, coordinating existing [#495](https://github.com/tehki/myaso/pull/495) rather than independently implementing a new inventory service.
- **Core 8B** owns canonical 128-bit IDs, versioned item/slot namespaces, ledger atomicity, receipts, restart/duplication and one durable writer ([#492](https://github.com/tehki/myaso/pull/492), [#432](https://github.com/tehki/myaso/issues/432)).
- **Core 8C/World/Physics** jointly certify the **same rack coordinates and reach/LOS/collision** under fenced server ticks, not a browser pointer or offline portal; World #493 and Core spawn #486 are review inputs only.
- **Core 8A** owns the authenticated command, replay-proof ACK and four-way observer replication; **UI+Combat** own pointer arbitration and real fists/sword damage; **Graphics 3A/B/C** owns sword sprites/hand meshes/pick-region fidelity; **Sound** plays confirmed cues.
- **Magic 2A** is strictly **nonblocking** for the armory. Knowledge, teachers, physical Spellbook/reagent and Ember cost can continue independently in [#467](https://github.com/tehki/myaso/pull/467) / [#476](https://github.com/tehki/myaso/pull/476), but a fresh character must be able to obtain and use a sword with **zero runes, spells and mana**.
- **Orchestrator** owns this contract, [#460](https://github.com/tehki/myaso/issues/460) independent-client acceptance, [#488](https://github.com/tehki/myaso/issues/488) clickable sword input gate, [#432](https://github.com/tehki/myaso/issues/432) identity compatibility and escalation to [#360](https://github.com/tehki/myaso/issues/360) / [#480](https://github.com/tehki/myaso/issues/480). Only Main Orchestrator owns merge, release and production GO.

**Live readiness: BLOCKED.** Existing source is IMPLEMENTED and isolated tests are partly TESTED; real four-client rack pickup, canonical ID bridge, network command/replication, armed+unarmed server Combat and genuine World collision/LOS are **not yet integrated/playable**. Do not merge experimental chain or deploy until approved and independently verified.


### P0 explicit sword-selection, ownership and receipt convergence gate (integration audit, 2026-10-21)

**The reviewed source now demonstrates WHY physical reach alone cannot select a sword.** World V1 [#493](https://github.com/tehki/myaso/pull/493) provides four named rack sockets at `(3740,4038)`, `(3780,4038)`, `(3820,4038)`, `(3860,4038)`, with player approaches at each respective x and `y=4088`. Items' prototype reach is `56` world units. At each approach, own-sword distance is `50`, adjacent-sword distance is `sqrt(40^2+50^2)≈64.03`, so a single sword is eligible. But at each of three neighboring approach midpoints, *two* distinct swords are simultaneously eligible at `sqrt(20^2+50^2)≈53.85`. This has been checked using actual World/Items sources by Core [#541](https://github.com/tehki/myaso/pull/541). **A server-side nearest-item guess, sole-distance lookup, rack-menu index, or an untrusted renderer hit is not an identity binding.** The browser must request the *specific rendered* sword's bounded server-issued ID, and the server must compare that item and ground-entity pair with the authoritative same-tick entity/owner/location.

**Do not conflate the three identifiers:** (A) World-authored stable visual `greyhaven-rack-N` socket name, (B) Items experimental `GroundDrop.entity_id:u64`, and (C) physical `ItemStack.id:u64`/Core canonical `ItemId:u128`. Core #541 source audit establishes that the older Core #492 illustrative `Ground{x_cm:371000+35*i, y_cm:385000}` is **not** the physical Blacksmith rack; coincidentally equal numeric fixture values for a ground entity and an item prove nothing. Core [#499](https://github.com/tehki/myaso/pull/499) is an *offline* domain-separated conversion preflight, not a live namespace assignment. Exact `u128` namespace, one-world-zone ID, approved world-unit→Core-centimeter rational scale, signed origin and no-rounding policy require written **Core 8B+8C, Items 2B, World/Physics sign-off in #432**. Never assume `100 cm = 1 world unit` or select a default transform in this contract.

**Required one-transaction postcondition, not implementation already delivered:**

1. Core 8A binds the authenticated current character/lease and one monotonic operation ID to a client-selected *server-advertised* current-world ground entity **and physical item identity**; never accept caller-supplied owner/position/zone/Combat stats. Reject old rendered/reused entity IDs or epoch changes.
2. Core 8C supplies one fenced current simulation tick, actor position, World/Physics authoritative *complete* geometry revision, zone and worker epoch; source must match the approved rack manifest. An arbitrary/always-true LOS callback or incomplete static-only map cannot authorize physical transfer.
3. Items 2B validates **one specific ground entity's actual immutable item ID, sword kind, available ground state, 56-unit physical reach, alive/capable fighter, empty MainHand**, and prevents general mutation paths that bypass exact-item/Physics checking; see isolated [#539](https://github.com/tehki/myaso/pull/539), [#504](https://github.com/tehki/myaso/pull/504), and [#552](https://github.com/tehki/myaso/pull/552). No production handler is proved by local tests.
4. Core 8B's chosen *sole* fenced canonical writer commits exactly one rack-ground→`MainHand=0` ownership transition, tied atomically to operation receipt/observer outbox. **Historical success is insufficient:** if the sword has been dropped or picked up again, the prior receipt may no longer prove current equipment. Before a current-equipment ACK or server Combat effect, verify the item-specific **latest committed mutation sequence** and exact current owner/location against that receipt (the dormant proof is [Core #510](https://github.com/tehki/myaso/pull/510), followed by [#526](https://github.com/tehki/myaso/pull/526)). Losing contenders must not receive a misleading accepted state or mutate their inventory/attack.
5. Only after this committed revision is authoritative may Core 8A emit replay-safe accept/reject, all four observers update **the same** ground-disappearance/hand-sword revision, and Combat resolve actual fist-vs-sword stats. Client UI hit geometry (including transparent sprite pixels) and Combat LMB reservation must not create a weapon or attack on denied/canceled sword clicks.
6. After failed durable precommit, uncertain network ACK, crash/rejoin, epoch takeover, contested click, drop and second-player reacquisition, re-query canonical ownership and receipts: **exactly four initial physical swords, each at exactly one exclusive valid location/owner; no duplicate identity or phantom equipment**. Existing MYASOL03 experimental checkpoint and Core MYTX/PG ledgers must never co-write the same live sword.

**Source/CI maturity checkpoint (not release approval):**
- **Items 2B:** [#539](https://github.com/tehki/myaso/pull/539) protected [quality #39600869861](https://github.com/tehki/myaso/actions/runs/39600869861) PASS; its one-file [#504](https://github.com/tehki/myaso/pull/504) five-slot checkpoint recovery merged *within a draft branch only* at exact head `9c8ba6719d12635a2307c6409545db0dd87e036d` with [quality #39605015677](https://github.com/tehki/myaso/actions/runs/39605015677) PASS; child [#552](https://github.com/tehki/myaso/pull/552) exercises four fully outfitted users on joint checkpoint, full CI [#39610099950](https://github.com/tehki/myaso/actions/runs/39610099950) was still running at this audit.
- **Core 8B:** [#510](https://github.com/tehki/myaso/pull/510) exact `75ac3dc980738daff91e30cd24a2b86343ec8234` [quality #39594610070](https://github.com/tehki/myaso/actions/runs/39594610070) PASS; [#526](https://github.com/tehki/myaso/pull/526) full CI FAIL on inherited browser M145; [#541](https://github.com/tehki/myaso/pull/541) further frozen World source/Items reach compatibility, full CI [#39610109795](https://github.com/tehki/myaso/actions/runs/39610109795) running when inspected. All are dormant domain/preflight, not a globally approved live ledger/ACK.
- **Core 8A/8C:** [#536](https://github.com/tehki/myaso/pull/536) four-browser multihost **offline preflight** CI PASS (not actual two-host staging); [#532](https://github.com/tehki/myaso/pull/532) scoped real-QUIC four-player independent session/movement tests PASS on earlier exact head, but still no live rack pickup. Actual four-client city→armory→sword→PvP staging remains [#480](https://github.com/tehki/myaso/issues/480) **BLOCKED**.
- **Integration target:** protected `main` `6fa59b649112c272bcbc018b4a32bf963f9a5bba`; no live loot/Core/World sword wiring is merged by this contract. The initial First Playable release must not substitute an offline fixture, four browsers on one CI host, or code-only receipt proof for independent-machine acceptance.

**Next necessary central decision (no implied authorization):** record one approved canonical namespace/slot/coordinate transform, sole item writer and fenced atomic World+Physics+loot receipt/outbox contract at [#432](https://github.com/tehki/myaso/issues/432); then request one minimal reviewed vertical integration PR, genuine four-browser M1–M5 acceptance, exact candidate/full and post-merge green CI, staged rollback/GO. Department 2 will not independently choose a writer, a network opcode or a production database cutover.


### Gate B phase handoff: one durable writer, genuine rack click and current equipment (review amendment, 2026-10-21)

**Critical trust-boundary correction:** Existing Core [C3e #406](https://github.com/tehki/myaso/pull/406) acquires a cooperating **POSIX local `flock`** around dormant MYTX journal replay, which prevents concurrent cooperating local writers but is **not** a remote/distributed worker-epoch fence or protection against a malicious/network filesystem. Core [C3f #417](https://github.com/tehki/myaso/pull/417) adds proposed PostgreSQL byte-encoding only (**`u128` MYTX little-endian vs PostgreSQL big-endian**, no SQL driver or atomic world+item operation). The Main Orchestrator must select and review one canonical durable item commit/receipt mechanism and how it is fenced to *Core 8C's* active world authority before any public item write. **Neither local `flock` nor a codec is production ownership authorization.** There must be no independent local MYWLD003+MYTX+PG writes for one sword.

**Current independently verified, still nonlive, domain support:**

| Gate | Exact evidence | What it proves / does not prove |
| --- | --- | --- |
| Rack items and all five equipment slots survive local checkpoint | [Items #504](https://github.com/tehki/myaso/pull/504) head `9c8ba6719d12635a2307c6409545db0dd87e036d`, protected [quality #39605015677](https://github.com/tehki/myaso/actions/runs/39605015677) **PASS** | Four-rack Items prototype with 5-slot disk recovery; not live canonical IDs |
| Checked direct MainHand→Ground drop, even with full backpack | [Items #563](https://github.com/tehki/myaso/pull/563) head `8c61476b9d336d921922a293a6df9fc5a3c5ecbd`, protected [quality #39616091274](https://github.com/tehki/myaso/actions/runs/39616091274) **PASS** | Stable local sword ID with a new ground entity; not verified 8A wire/8C epoch |
| Refuse delayed drop selecting replaced sword (ABA) | [Items #576](https://github.com/tehki/myaso/pull/576) head `7c799df65e8e8bf451d10ae297d1e669c9a34b68`, protected [quality #39621273000](https://github.com/tehki/myaso/actions/runs/39621273000) **PASS** | Expected physical item verified against true current MainHand before staging; remains experimental `u64` |
| Current rack occupancy/revision, not old receipts | [Core 8B #577](https://github.com/tehki/myaso/pull/577) head `27d495edddf6c8b2d2226bceda2dc6bff9b87bd1`, protected [quality #39621376123](https://github.com/tehki/myaso/actions/runs/39621376123) **PASS** | Pure read-only projection from local C3e journal; unapproved source namespaces and coordinate transform |
| Exact-click candidate / mutation watermark (read only) | [Core 8B #583](https://github.com/tehki/myaso/pull/583) head `8e278e5b249ab05ee3260a0b09c19d0a59f7865f`, protected [quality #39623916256](https://github.com/tehki/myaso/actions/runs/39623916256) **FAILED M205 Combat browser**, local 125 Rust PASS | Reject stale or substituted ID in *preflight* only; **TOCTOU** until same writer rechecks at atomic commit |
| Real four native Chrome/Firefox clients rendered in Greyhaven | [Core 8A/UI #589](https://github.com/tehki/myaso/pull/589) head `30921852fbd4d24bef615249e6dda227a6e56040`, [native #39628283313](https://github.com/tehki/myaso/actions/runs/39628283313), [protected #39628283446](https://github.com/tehki/myaso/actions/runs/39628283446) **PASS** | Genuine pinned-WebTransport server, four native browsers with authoritative Rx/ACK and HUD ticks **on one CI host**; no real item pickup nor independent two-host acceptance |

**Do not equate these greens with a solved Gate B.** The minimal *proposed* one-writer command boundary for review is:

1. Core 8A may accept an **untrusted intent** selecting one exact server-advertised tuple: `{rackSocket, groundEntityId, canonicalItemId, observedItemMutationSequence, requestId}`. It verifies authenticated actor/session/lease; identifiers and protocol codes MUST be centrally allocated/versioned, not invented in an Items-only packet. An observed sequence is an optimistic **expected state**, never permission to transact.
2. Core 8C acquires a **currently valid fenced worker/zone/tick authority** and supplies trusted same-tick Fighter, full static+dynamic collision/LOS snapshot/revision and actor capability. World→Core unit scale and signed origin, `ZoneId`, current ownership and item ID namespace remain **explicit unsigned integration decisions** until approved in [#432](https://github.com/tehki/myaso/issues/432); do not infer them from demo constants.
3. The **single final durable item writer** rechecks expected tuple, actual Ground location, item-kind/amount, current MainHand, LOS/reach and exact item-specific mutation sequence **inside the same commit/fenced authority**. Read-only preflights #577/#583 are useful filtering, **not a substitute for this recheck**. An outdated world tick/authority epoch, changed item after observation, stale session, invalid sword selection or changed LOS must reject with *no ownership mutation or success outbox*.
4. One durable operation commits `GroundAtRack→Equipped(MainHand=0)` **or** `Equipped(MainHand=0)→GroundAtServerApprovedPosition`, preserving the same canonical sword identity. Receipt and observer intent belong to the **same durable commit point**. ACK is a projection of a *recovered committed operation*, never a confirmation of speculative UI or local Items checkpoint; outbox/snapshot must be monotonic for all four browsers. Under drop/re-pick ABA, previous accepted receipt is not current equipment proof.
5. Crash immediately before commit leaves item unchanged; crash/ACK loss after commit replays the same receipt with no double-mint; competing four claimants yield one success and three stable rejects; stale second writer epoch cannot replay a conflicting transition. Client sprite disappearance and hand status must both derive from one committed canonical revision. Gameplay accepts zero spell progression.

**Central acceptance request:** nominate **one** Core item transaction owner and one committed writer backend, plus 8C/World/Physics reviewed `ZoneId`, cm/world-unit transform, worker epoch and true LOS snapshot, and 8A reliable opcode/multiplexing/ACK/outbox schema at [#432](https://github.com/tehki/myaso/issues/432). Until owner sign-off and native two-host four-player M1–M5 evidence, **NO live Item activation**. This document neither implements nor approves a writer, imports a legacy namespace, or authorizes staging/production.



---

**Owner:** Department 2 Magic & Items Orchestrator (shared integration only).
**Reviewers:** Magic 2A, Items 2B, Core 8A/8B/8C, Combat, Graphics 3A, UI, World, Economics.
**Status:** Design and compatibility gate, **not** a live protocol, approved migration, Combat implementation, or permission to merge.
**Audit baseline:** October 21, 2026; protected `main` `4ed368d911eb5250a0a09a133500037ff5518c12`.
**Integration tracker:** [Development Center #360](https://github.com/tehki/myaso/issues/360).

## 1. One physical item truth, one durable character truth

- Players begin with an **empty backpack, empty equipment, no spellbook, no reagents, and no learned spells/runes**. Visible adult unclothed appearance does not mint items.
- **Items 2B** owns `ItemKind`, individual item identities, backpacks, slots, ground entities, corpses, full-loot transitions, and stack semantics. A sword cannot occupy ground and a backpack or two players' inventories at once.
- **Magic 2A** owns learned Fire/Ember, mana, lessons, intents, cast and interrupt semantics. Earned knowledge must survive loss of a physical spellbook and reagents.
- **Core 8B** must define the eventual canonical stable character ID, item ID, ownership ledger, durable receipt, migration and restart-safe recovery. Do not run Magic's whole-file checkpoint and Core's journal/SQL as two independent canonical writers.
- **Core 8C** owns zone location, world entity identity, writer epoch and mutation fencing. **Core 8A** authenticates the network and delivers commands, ACKs and committed observer state.
- **Combat** resolves unarmed vs equipped attack/damage and atomic death transitions. Graphics and UI consume trusted state; never grant, delete or duplicate gear client-side.

### Provisional source ownership

| Source | Owner | Joint review required from |
| --- | --- | --- |
| `server/src/magic.rs`, `magic_teacher.rs`, `magic_cast.rs`, `magic_combat_preview.rs`, `magic_combat_interrupt.rs` | Magic 2A | Items 2B / Combat for reagent, equipment and effect boundaries |
| `server/src/loot.rs`, `loot_persistence.rs` | Items 2B | Core 8B / Core 8C for durable IDs, schemas and ground entities |
| `server/src/loot_transaction.rs` | Items 2B with orchestrator review | Magic 2A + Core 8B/8C: the present file also writes Magic and uses World leases |
| `server/src/magic_checkpoint.rs`, `magic_combat_death.rs` | Shared, one orchestrator-coordinated integration owner per change | 2A, 2B, Core 8B/8C, Combat |
| `server/src/character_identity.rs` (experimental) | Shared **provisional only** | Core 8B owns canonical identity and session admission |
| `server/src/combat_loadout.rs` in Combat draft #426 | Combat | Items 2B / Core / Graphics |
| `src/browser/character-appearance.mjs` in Graphics draft #423 | Graphics 3A | Items 2B / UI |

No parallel implementation of an inventory database, spell ledger, item allocator, Combat damage engine or graphics renderer inside this department. Each shared file has **one writing team per change**.

## 2. Identity and serialization mismatch: hard integration blocker

These are **different currently isolated types**, not interchangeable wire contracts:

| Domain | Verified draft type and representation | Action |
| --- | --- | --- |
| Magic #354 `character_identity.rs` | `CharacterId(NonZeroU64)`, `SessionLease` with `u32` session + `u64` epoch | Prototype only; use Core-admitted verified identity, never client ID |
| Items #354/#424 `loot.rs` | `ItemStack.id: u64`; local world/corpse entity ID `u64`; `EquipmentSlot` Rust enum | No implicit cast into canonical journal namespace |
| Core 8B #417 `identity.rs`, `item_ownership.rs` | `CharacterId: u128`, `ItemId: u128`, `CorpseId: u128`, independent operation IDs | Core 8B defines authoritative namespaces and collision policy |
| Core 8B C3b / C3f #417 | `MYTX` journal fields little-endian; PostgreSQL `bytea` ID representation proposed as big-endian 16-byte | Typed encode/decode at the boundary; no raw-byte reinterpretation |
| Core 8C C4d #393 | Fenced PostgreSQL world-entity transactions; 16-byte entity/operation IDs and single-entity mutation scope | Extend joint death/transfer transaction only with reviewed 8C API |
| Magic/Items #354 | `MYASOL03` local Loot snapshot, `MYWLD003` joint Loot + Magic checkpoint | Versioned migration/rollback and item conservation proof required |

**Required review before any live migration:**
1. Decide canonical item, character, corpse, operation and ground-entity namespaces (with zero/overflow/collision rejection).
2. Specify an explicit `u64` prototype-to-canonical mapping or a one-time migration with immutable provenance; **do not silently zero-pad, truncate, reinterpret bytes or remint**.
3. Specify equipment slot numeric mapping (`MainHand`, `OffHand`, `Body`, `Head`, `Feet`) and version it; Core's `slot: u8` is not yet an agreed live cross-domain schema.
4. Validate cross-version encode/decode, item identity uniqueness, corrupt-record refusal, crash before/after commit, and old/new rollback.
5. Choose one canonical durable writer, world fencing token, idempotent receipt and recovery ordering. Local exclusive flock from 8B cannot be treated as a distributed multi-host lock.
6. Define authoritative Combat HP/death + Magic interruption + item/corpse mutation as **one recoverable logical transaction**; C4d's single-world-entity atomic receipt alone does not prove a multi-entity death commit.

No real database schema migration, production account identity change, or on-chain asset conversion is approved by this draft.

## 3. Proposed internal operation and durable outcome boundary

A client may request only a **kind and selection**: `pickup(entity_id, amount)`, `take(corpse_id, item_id, amount)`, `equip(item_id, slot)`, `unequip(slot)`, `drop(item_id, amount)`, or `prepare_cast(spell, target_intent)`. The client **must not supply** an authoritative owner/actor ID, character ID, inventory contents, caster mana, world position, session lease, trusted teacher receipt, or damage result.

Core-authenticated admission derives stable character identity, current session incarnation, writer epoch and serialized world tick; World validates fighter/zone, distance and action state; Items validates item existence, exclusive ownership, correct slot/capacity and conservation; Magic checks owned knowledge, physical spellbook/reagents, mana, spell intent and interruptions. A durable transaction must commit the operation receipt and *every participating state change* before ACK/replication; ambiguous persistence must reconcile from the canonical store rather than merely retrying mutation in RAM.

The current `commit_verified_pickup` (#409), `commit_verified_equipment` (#424), and `MYWLD003` checkpoints are **isolated server-domain experiments**; their Rust tests do not prove real authentication, distributed fencing, cross-domain Combat HP atomicity, post-rename recovery or independent multiplayer execution. No live handler activation.

## 4. Visual and Combat contract

- Graphics #423 currently supports `RustySword`, `LeatherArmor`, `Spellbook` and `mainHand/offHand/body`, while Items #424 adds `IronSword`, `WoodenClub`, `ChainmailArmor`, `IronHelmet`, `LeatherBoots`, `WoodenShield` and `head/feet`. Graphics must extend its render-only compatibility map and safe fallback *after item taxonomy review*, **not** invent ownership.
- Combat #426 has a dormant read-only loadout view. Define a genuinely **unarmed** baseline rather than portraying the existing arena's fixed 34HP attack as an unarmed fist. Damage, blocking, mitigation and fairness remain Combat-owned and server-authoritative.
- A visible skin or asset key can never create a physical item. Rendered equipment updates only from committed server snapshots/receipts, not client guesses.

## 5. PR integration map and current test gates

| PR | Changes | Dependency |
| --- | --- | --- |
| [#354](https://github.com/tehki/myaso/pull/354) | Combined initial Magic/Items domains and experiments | `main` |
| [#397](https://github.com/tehki/myaso/pull/397) | Death timestamp overflow validation | #354 |
| [#409](https://github.com/tehki/myaso/pull/409) | Typed pickup + joint checkpoint and single-winner contests | #397 |
| [#424](https://github.com/tehki/myaso/pull/424) | Empty starter, physical gear, slot/codec extensions, typed equip/unequip/drop | #409 |
| [#426](https://github.com/tehki/myaso/pull/426) | Dormant read-only Combat loadout | #424 |
| [#427](https://github.com/tehki/myaso/pull/427) | Dormant verified read-only Magic knowledge | #354 |
| [#423](https://github.com/tehki/myaso/pull/423) | Dormant adult body/equipment rendering contract | independent on `main` |
| [#417](https://github.com/tehki/myaso/pull/417), [#393](https://github.com/tehki/myaso/pull/393) | Core 8B canonical PostgreSQL item codec; Core 8C fenced world mutation | separate Core chains |

All Magic branches remain drafts. Passing nested child CI **does not** replace a failed or missing parent acceptance or prove a legal merge order. Never rebase/force-push department heads without coordination.

**Smallest safe integration order:** agree namespace/operation/slot contracts → fix and revalidate parent stack failures → integrate #354 then #397, #409, #424 in dependency order with fresh merged-head CI after each → integrate Combat/Graphics/UI/Core only after their own independent review → exercise *real* two-client sword pickup/equip/transfer, corpse contention, teacher+Ember resources, reconnect/crash/replay/multiwriter defenses → central release decision. Alternative stack surgery requires the Development Center's explicit approval; preserve existing commits/reviews.

## 6. Acceptance that must not be diluted

- **Naked start:** no free equipment, items, runes or spells; identity cannot be forged.
- **Single sword:** valid obtain/pickup/equip/drop/take; exactly one owner/position, identical stable ID through transitions; no ghost rendering or stale acknowledgement.
- **Death:** physical gear/reagents/spellbook transfer to corpse/ground; no duplicated bodies/items; learned Fire/Ember retained; pending spell safely interrupted.
- **Spell:** verified teacher/lesson; owned Spellbook and Sulfur Ash; one mana/reagent expenditure, one authoritative Combat outcome.
- **Durability:** precommit rollback, postcommit confirmation, ambiguous ACK, restart/epoch fence, competing writers, duplicate receipts and incompatible/corrupt schema refusal.
- **Live clients:** >=2 independent browsers and a real authoritative server, observed committed ground/corpse/equipment state and no item duplication.
- **CI:** exact-head Rust fmt/check/Clippy/tests and full protected Chrome/Firefox Combat acceptance; do not weaken failing M143/M121/M147 assertions to accelerate activation.
- **Performance:** bounded zone loot queries, no whole-world disk writes per trivial pickup as a final performance design without Core 8B/8C measurement, conservative Combat tick latency.


## 7. HISTORICAL First Playable alignment — unarmed-only directive superseded by Section 0

**Directive:** [P0 First Playable central gate #480](https://github.com/tehki/myaso/issues/480), coordinated through [#360](https://github.com/tehki/myaso/issues/360). This amendment **does not change Item/Magic ownership, durable guarantees or future gameplay approval**. It decouples unfinished features from a genuinely enjoyable *initial* shared-world release. First Playable itself is NOT yet accepted.

### P0 — Must not regress the first playable

- **Existing stable Combat/Core arena stays authoritative, playable and unarmed by default.** The optional Loot/Magic drafts are not imported, registered, called or silently switched on by this document. The live baseline may retain existing legacy Combat semantics until Combat explicitly implements and validates a real unarmed loadout: do not mislabel a fixed arena 34-HP strike as real fists.
- Preserve existing account/session boundaries, movement, facing, blocking/parry, kick, roll, jump, damage/death, respawn, reconnect and authoritative state replication exactly as the reviewed game requires. Do not redefine or bypass Combat/Core wire validation in Items or Magic.
- No hidden spawning sword or armor should be *granted by an activated Items service*; conversely, the experimental `empty backpack` invariant does **not** justify wiring incomplete LootAuthority into the live browser server before its identity/death/recovery proof.
- Retain all protected Rust/JS/native Chrome+Firefox CI acceptance. Real independent-machine First Playable multiplayer remains Core/Combat/World/UI and Main Orchestrator responsibility, not a simulated Items acceptance.
- All departmental work stays **isolated/dormant by default**. Do not force the unmerged PR stack into an early release, change production DB schemas, alter real wallets, or require new GUI commands for playable unarmed Combat.

### P1 — Minimum additive contribution when the center requests it

- Provide **read-only, server-derived capability declarations** at the reviewed Core/UI boundary, e.g. whether the live server has opted into inventory/equipment/Magic. Until real authority is accepted, the effective state is `inventory=false, equipment=false, spells=false, full_loot=false` and a client must neither show a misleading operational control nor send hypothetical item/spell intents. This paragraph is a **proposed future interface**, NOT an implemented packet field or CI-verified runtime state.
- Define an additive test for the accepted game candidate that starts two real browsers without experimental item/Magic extensions and exercises movement, skills, health, death, respawn and reconnect with no imported inventory or spell prerequisite. Core + Combat + UI own implementation of that acceptance; Department 2 supplies only compatibility expectations.
- If the central Main Orchestrator selects an independently qualified gear/loot element for the alpha, require an explicit scoped GO, exact-head and integrated CI, one canonical Core 8B item identity/receipt, fenced 8C World and 8A protocol, reliable observer UI, rollback, and two real independent clients before activation. No implied requirement to activate *all* magic or inventory.

### P2 — Continue independently behind review gates

- **Items 2B:** physical catalog, backpack, equip/unequip/drop/pickup, corpses, redacted nearby visibility, private inventory, replay/reconnect rejection. Current specialist efforts include [#428](https://github.com/tehki/myaso/pull/428), [#437](https://github.com/tehki/myaso/pull/437), [#444](https://github.com/tehki/myaso/pull/444), [#449](https://github.com/tehki/myaso/pull/449), [#464](https://github.com/tehki/myaso/pull/464), and Core migration audit [#454](https://github.com/tehki/myaso/pull/454).
- **Magic 2A:** read-only permanent knowledge, World-authorized lessons, Ember resource costs, stun/death interruption and recovery. Specialist integration candidates [#467](https://github.com/tehki/myaso/pull/467) and [#476](https://github.com/tehki/myaso/pull/476) have isolated full-quality evidence; real spell effects, teacher content and network commands remain separate releases.
- **Items + Core 8B/8C:** canonical ID/slot/quantity codec, one-writer durable item ledger, no dual writers, multi-entity Combat/loot/Magic atomicity and rollback. Track [#432](https://github.com/tehki/myaso/issues/432).
- **Cross-department vertical slice:** [#460](https://github.com/tehki/myaso/issues/460) requires real first-sword independent-client pickup/equip/drop/transfer, physical full-loot death and crash recovery, **not** a First Playable P0 prerequisite unless central scope changes.

### Current factual evidence and readiness words

| Change | Exact verified head | CI evidence (at alignment audit) | Classification |
| --- | --- | --- | --- |
| Protected `main` | `4ed368d911eb5250a0a09a133500037ff5518c12` | [quality #39509423836](https://github.com/tehki/myaso/actions/runs/39509423836), attempt 2 PASS (165/165), separate [#39515499562](https://github.com/tehki/myaso/actions/runs/39515499562) PASS | **TESTED stable baseline**, not proof of a running production artifact |
| Shared Department 2 contract [#429](https://github.com/tehki/myaso/pull/429) | Previous `77cd09345f6fee102d430ec5ccd98562f5225e23` | [quality #39515016372](https://github.com/tehki/myaso/actions/runs/39515016372) PASS; this amendment needs its **own** exact-head result | Shared design **IMPLEMENTED**, new HEAD unverified until CI |
| Items gear prototype [#424](https://github.com/tehki/myaso/pull/424) | `dc98944b754a59d615684d465bba2c2e436bc0bd` | [quality #39512461503](https://github.com/tehki/myaso/actions/runs/39512461503) PASS | **TESTED isolated only**, not network-integrated |
| Item pickup parent [#409](https://github.com/tehki/myaso/pull/409) | `a345bb173356b790cd13b959650fb5c3c82a2588` | [quality #39511207641](https://github.com/tehki/myaso/actions/runs/39511207641), attempts 1/2 FAIL M143/M158 | **BLOCKED** for integration |
| Magic 2A [#476](https://github.com/tehki/myaso/pull/476) | `bc1a7244dc4b60092ddd64b63889813393111624` | [quality #39529512822](https://github.com/tehki/myaso/actions/runs/39529512822) PASS | **TESTED isolated**; Magic live **EXPERIMENTAL** |
| Items 2B [#464](https://github.com/tehki/myaso/pull/464) | `b29936e8732faea0540e9d9ee6587759bcfed0d4` | [quality #39524741239](https://github.com/tehki/myaso/actions/runs/39524741239) FAIL | **BLOCKED** for integration |

**Do not conflate**: `IMPLEMENTED` code exists; `TESTED` checks passed in branch; `INTEGRATION-READY` explicit interfaces plus all required gates have been verified; `INTEGRATED` accepted into the shared release candidate; `PLAYABLE` real shared-world independent-client acceptance has actually passed. Department 2's live Magic, equipment, full loot and canonical ledger remain **EXPERIMENTAL/BLOCKED**, and none is INTEGRATED or PLAYABLE.

**HISTORICAL ONLY (SUPERSEDED BY OWNER P0 ARMORY SCOPE):** accept the minimum unarmed arena as First Playable scope without waiting for #460 or #432, retain all experimental Magic/Items drafts OFF, and use their validated compatibility contracts only when the center selects a separately reviewed incremental integration. Preserve stable `main` and rollback. A general "first playable" mandate is **not** approval for optional full-loot item loss or irreversible persistence migrations.


The main R2 multiplayer release must not be blocked by unfinished Magic/Items. **No production activation, irreversible migration, real-money trading, real MOCMP wallet/custody or main merge under this document alone.**

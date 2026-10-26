# 🌕⚡️🚀 Core 8A — ONE v2 gesture wire candidate for Main #723


## Near-u32 shared counter reservation — Core8C review fix

The Core8C review of #815 caught a real **review-state invariant**:
if a source0 LMB PRESS is still **unupgraded** and source1 KeyE begins
near the end of its shared per-lease 32-bit sequence space, the
previous `1 + activeSources + ownSourceFuture` arithmetic failed
to reserve the LMB's *optional* UPGRADE. Example: only three slots
remain after a legitimate LMB PRESS, but a concurrent KeyE PRESS,
KeyE terminal, LMB UPGRADE and LMB terminal require **four**.
The KeyE start must be refused **without retiring the already-valid
LMB**, while its queued upgrade and terminal still fit.

The dormant allocator now counts **one terminal for each active
source plus one optional UPGRADE for a not-yet-upgraded LMB**. It
reserves these obligations before admitting any additional PRESS.
It also preserves outstanding obligations before retiring one source,
so releasing KeyE first cannot starve an outstanding LMB upgrade.
If there is **no** active source and no sequence headroom to start
a complete gesture, the exhausted review lease retires. No u32 wrap.

A test-only `testOnlyInitialSequence` fixture constructor parameter
allows actual original allocator calls to reproduce the invariant at
`0xffffffff - 3` and to exercise a fully legal exactly five-edge
sequence finishing on `0xffffffff`, without billions of dummy
events. No real network can set this local test parameter; the entire
module remains dormant and non-imported by live gameplay. This
does not establish QUIC source authentication, server actor binding,
World-clock admission, ACK or HIT, nor prove client IDs will actually
reach 2^32 in a real session. The original browser v1 and strict
Combat acceptance tests remain unchanged.

## One bounded typed edge outbox — isolated Core8A review child

The original dormant `src/network/prealpha-lmb-gesture-outbox-proposal.mjs`
now also exports a **separate opt-in review** `ProposedSharedTypedGestureOutbox`
that **composes the one shared ID allocator**, instead of constructing
two independent LMB/KeyE sequence=1 queues. The original
`ProposedLmbGestureOutbox` and its existing tests remain unchanged,
and neither class has any live `web/` import.

The typed review outbox implements original Core8A bounded
`maxPending=16` (configurable 4–256) and `maxAttempts=3`
(configurable 1–8); all source0/source1 edges use one pending map,
same monotonic sequence ID and a single lease-private ACK router.
New PRESS acceptance budgets queue room for all **other** active
sources' terminals plus potential own LMB UPGRADE/terminal or
KeyE terminal; refusing a new over-capacity PRESS leaves legitimate
outstanding release paths open. Next-send chooses **unscheduled
first attempts ahead of retries** without reordering the chosen
packet batch. Return values are packet COPIES; this method neither
transmits bytes nor authenticates a server.

`receiveAck(bytes, trustedLease)` delegates to the original strict
Combat4 `0x12` decoder (byte3 MUST be zero), denies foreign object
tokens, unscheduled ACK, absent/replayed sequence and mismatched
gesture. ACCEPTED/DUPLICATE settle transport receipt only;
STALE/REJECTED closes and clears the entire lease. Retransmission
exhaustion closes it as well, rather than dropping an unACKed
terminal silently. The single ACK sequence+gesture pair is
matched back to the exact *originally queued source*; no
untrusted source field is reconstructed from the ACK.
No `CombatEvent::Hit`, damage or World authority is exposed.

The focused tests include: two 0x11 press/release edges in a
single 30Hz tick; interleaved LMB/KeyE seq1…5 with disjoint
gesture IDs; limit=1 first-send fairness; terminal capacity
under both simultaneous sources; unscheduled/foreign/invalid
ACK refusal; independently copied retransmits; bounded retry
exhaustion; stale/retired lease; four independent hypothetical
clients emitting identical KeyE bytes and isolated ACK handling.

**Proof boundary:** this is one local, dormant JavaScript review
state machine. An object `trustedLease` is NOT a real
authenticated WebTransport actor identity. There is no true
network writer, QUIC stream/handshake, durable replay window,
Core8C actor/zone/World incarnation atomic fence, server hit,
real W3C provenance, or current live v2 support. The final
single integrated transport adapter may reuse this logic only
after Main's exclusive branch/writer fence and cross-owner
review. Original v1 and all strict Combat native gates remain
untouched. **NO MERGE / DEPLOY / PROTOCOL ACTIVATE.**

## Shared typed-source ID allocator — review-only child of #809

`src/network/prealpha-shared-source-allocator-proposal.mjs` now
defines **one** `ProposedSharedSourceGestureAllocator` for BOTH
`source=0` LMB and `source=1` standalone KeyE. It calls the opt-in
typed codec already reviewed in #809 without changing original
LMB-only outbox internals or any original live browser importer.
One test-owned lease begins with one global `sequence=1` and
`gestureId=1`; pressing either source consumes a new global gesture
ID and each event consumes a globally increasing sequence.
Both independent sources may be active simultaneously, and a
matching RELEASE/CANCEL uses only its own source gesture ID.
KEY_E UPGRADE is unavailable; LMB UPGRADE is allowed once.

Counters fail closed before overflow and reserve enough **identifier
headroom** for outstanding terminal events (plus optional LMB
upgrade). Retirement closes all active gestures, so stale caller
commands fail. Two different hypothetical leases may legitimately
restart from the same numeric IDs: authenticated actor isolation
**cannot** be established from wire sequence alone. The Node
contract test requires four independent fixture allocators to emit
identical KEY_E PRESS bytes and stay mutually independent.

**Critical limits:** The allocator does not send packets, record
retransmission attempts, reserve network outbox slots, accept ACKs,
authenticate `trustedLease`, bind actor/World zone epoch, or commit
Combat hits. An object token is merely a local test handle.
Original LMB-only `ProposedLmbGestureOutbox` is UNCHANGED and still
owns its independent counters: do **not** instantiate it alongside
this allocator on one eventual live v2 lease. Main's eventual
integrated writer must join the allocator, bounded 16-gap replay
outbox and same-lock Core8C/Combat World authority into **one**
reviewed implementation before enabling any traffic. This draft
is non-imported and default OFF. Existing W3C M41/M143/M156
protected gates and real independent host acceptance are unchanged.

## Isolated typed source API, NOT active v2 — Core8A review

The existing **same** dormant proposal codec modules now expose
`encodeProposedTypedGestureEvent/decodeProposedTypedGestureEvent` in JS
and `encode_typed_event/decode_typed_event` in Rust. These reuse the
original source0 Combat4 16B encoder/decoder and modify **only byte3
in an independent copy** for the explicitly opt-in source1 candidate.
There is **no parallel envelope and no change** to the old decoder:
`decodeProposedGestureEvent`/`decode_event` continue to reject
source1 until the Main-approved future live adapter explicitly opts in.
The original v1 gameplay remains unchanged.

The new JS/Rust tests read the SAME canonical 15-row golden fixture;
they assert source0 bit compatibility, source1 PRESS/RELEASE/CANCEL,
KeyE UPGRADE rejection, unknown source denial and 0x52 denial.
A transport ACK is never a hit. The codec by itself **does not** supply a sequence allocator,
authenticated QUIC capability handshake, bounded stream or ACK router,
World-incarnation/owner epoch check, terminal/replay arbitration,
browser provenance, or Combat heavy-on-KeyE-PRESS handling.
Those are still mandatory, not inferred from a byte decoder.

Core8C [#798](https://github.com/tehki/myaso/pull/798) currently
provides only a dormant World-local incarnation concept; same-World
lock with authenticated session/World-zone epoch is still required.
Combat4 [#803](https://github.com/tehki/myaso/pull/803) has separate
server-World KeyE semantic tests, not proof of typed network admission.
Main's [draft ABI decision](https://github.com/tehki/myaso/issues/723#issuecomment-6344860886)
is a review design, not final merged/authenticated wire enable.
**DRAFT / HOLD.**

## Reserve Main design decision — 22 October 2026

[Main's protocol-family selection in #723](https://github.com/tehki/myaso/issues/723#issuecomment-6344679826)
**SELECTS only the existing original Combat4/Core8A v2 family**:
16-byte `0x11` EVENT + 16-byte `0x12` ACK. **Competing `0x52`
is explicitly rejected for the future live path**, not adopted as
an alternative parser. This does **not** approve the final source
discriminator, negotiated handshake bytes or any runtime acceptance.

The **byte3=0 LMB / byte3=1 standalone KeyE is still a proposed
source grammar** awaiting signed-off Core8A/Core8C/Combat4/UI10
interoperability review and Main's explicit final ABI lock.
The *existing* original Rust and JavaScript dormant codecs must
continue to **reject byte3=1** (historically reserved) until that
cross-owner decision. Do not switch source1 on merely because the
review-only decoder accepts it. No actor identity or authentication
comes from these 16 bytes: each source is associated with the same
trusted, server-authenticated QUIC actor/lease, not a client epoch.

### Single immutable JS↔Rust golden-vector corpus

The normative **review candidate, not a production codec** is
[`tests/fixtures/core8a-p723-selected-family-v2.golden`](../tests/fixtures/core8a-p723-selected-family-v2.golden).
**Both** `tests/core8a-one-v2-gesture-wire-review.test.mjs` and
`server/tests/core8a_single_v2_wire_choice_review.rs` consume
the **same exact 15 vectors** rather than maintaining independent
byte copies that could quietly drift:

- Seven independent EVENT examples: LMB PRESS/RELEASE on the same
  diagnostic tick42, proposed KeyE PRESS/RELEASE/CANCEL, LMB
  UPGRADE/CANCEL. Each vector is a standalone ABI example;
  they are **not** an ordered seven-event game gesture.
- Four ACK statuses (ACCEPTED, DUPLICATE, STALE, REJECTED), all
  with reserved byte3 zero and server-owned tick; receipt only,
  **never Combat success**.
- Four invalid frames: KeyE UPGRADE, unknown source2,
  incompatible `0x52`, ACK with byte3 nonzero.
  The JS original ACK decoder must deny the malformed ACK;
  Rust currently **encodes** ACKs but does **not** expose a
  production ACK decoder. A future server ACK parser must
  fail closed on this value.

This corpus does **not** itself authenticate QUIC streams, settle
which optional handshake frames are valid, prove true server-side
125ms parry or 135ms/320ms Combat timing, accept any typed KeyE
frame in production or grant a release. Original v1 remains intact.

### Open sign-offs before source activation

Core8A must specify a connection-owned version-negotiation
preface (exact request, reply, stream and capability failure
bytes) and verify original v1 retains correct behavior on
negotiation rejection. Core8C must approve trusted same-lock
actor/World/zone/lifetime binding and retirement, including ABA
within one server tick. Combat4 must approve KeyE PRESS/RELEASE/
CANCEL semantics without LMB UPGRADE alias or damage duplication;
UI10 must verify DOM KeyE, focus and cancel provenance.
Main chooses the final byte3 grammar after all reviews, and
only then authorizes a **single** default-disabled live adapter.
The Reserve Main notice selected a design family but did not
authorize central merge, live code push, CI bypass, rollout or
production access. **Release HOLD.**


**DRAFT / REVIEW-ONLY / DEFAULT OFF.** Requested by
[Main decision issue #723](https://github.com/tehki/myaso/issues/723),
for joint **Core8A + Core8C + Combat4 + UI10** sign-off.
**Not approved as a runtime wire, not a live QUIC service, not a new
listener, not actual instant-light gameplay, and not a release.**
Based on [Combat4 + Core8A + UI10 source assembly #725](https://github.com/tehki/myaso/pull/725).
No code in `web/`, `server/src` or the production input codec changes.

## Nominate exactly ONE wire family: v2 EVENT 0x11 / ACK 0x12

Preserve original Combat4 [#705](https://github.com/tehki/myaso/pull/705),
Core8A [#712](https://github.com/tehki/myaso/pull/712),
real World wire proof [#721](https://github.com/tehki/myaso/pull/721)
and UI10 [#720](https://github.com/tehki/myaso/pull/720).
Original legacy INPUT v1 remains 16-byte header + up to three 6-byte
samples, maximum 34 bytes. No unnegotiated v2 event is accepted by it.

One EVENT is **exactly 16 bytes** on a separate, future authenticated
and version-negotiated reliable QUIC stream *on the existing gameplay
connection*, never a naked client-admin message or a separate Combat service.
All multibyte fields little-endian.

| Offset | Length | EVENT type 0x11 | ACK type 0x12 |
|---|---:|---|---|
| 0 | 1 | version **2** | version **2** |
| 1 | 1 | type **0x11** | type **0x12** |
| 2 | 1 | action: 1 PRESS, 2 UPGRADE, 3 RELEASE, 4 CANCEL | 1 ACCEPTED, 2 DUPLICATE, 3 STALE, 4 REJECTED |
| 3 | 1 | **source 0=LMB, 1=standalone KeyE** | **reserved 0** |
| 4–7 | 4 | `sequence:u32` nonzero, per authenticated lease | echoed sequence |
| 8–11 | 4 | `gestureId:u32` nonzero, per source and lease | echoed gestureId |
| 12–15 | 4 | `clientTick:u32`, **diagnostics only** | server-own real `serverTick:u32` |

**Source 0 LMB** with byte3 zero is **byte-identical** to existing
Combat4/Core8A dormant tests and original proposed codec. Preserve all
four actions; same 30Hz client tick PRESS+RELEASE must occupy two separate
events and ordered sequence numbers (e.g. 1/2). **Source 1 KeyE** is
a proposed extension using previously reserved byte3=1: PRESS,
RELEASE or CANCEL only; UPGRADE=2 is **invalid** for KeyE and must not
masquerade as LMB charge. KeyE cannot reuse an LMB gesture ID at a
live source-owner scope. This source tagging is NOT YET supported by
original runtime or existing dormant codec: existing decoder correctly
returns `Reserved` for byte3=1. Any future codec update requires all
owners' exact approval and independent CI; never silently relax reserved.

The 16-byte ACK does not carry source; it is reconciled ONLY against
the unique tuple **(trusted current connection/actor epoch, sequence,
gestureId)** and its original pending typed source entry. An ACK
settles a **transport edge**, not a World hit, HP decrement, effective
heavy, damage, or combo. Reject unexpected ACK, wrong source/gesture,
out-of-order future ACK, cross-lease/reconnect ACK and duplicate replay.
Maintain original bounded Core8A outbox 4–256 pending, 1–8 attempts,
reserve terminal RELEASE/CANCEL capacity, immutable retransmission bytes
and no silent sequence wrap. On exhausted ACK capacity, reject/close
the gesture lease; never invent a hit.

## Real actor authority and future mandatory negotiation

**There is deliberately NO client-controlled actorId or lease epoch field
in these sixteen bytes.** A server-issued canonical session binding
must be established FIRST on the existing certificate-pinned,
authenticated gameplay QUIC association. Core8C owns a durable
`(actor, world/zone epoch, session generation)` and a fresh
connection-scoped server lease; Core8A's future stream binds that
current server-authorized lease to exactly one fighter. Never trust
a client-supplied numeric `epoch` as authentication.

Activation gate requires a **server-confirmed v2 capability handshake**
on a new reliable stream within the same authenticated gameplay QUIC
session, before any proposed EVENT or ACK is interpreted. No old v1
client is silently upgraded. Server rejects other wire types, unknown
actor/source/lease, unexpected stream, duplicate session, zero ID,
sequence gaps, old epochs, disconnected/dead/respawned actors, retired
gesture, unexpected action and any stale buffered event after rejoin.
Core8C must supply an atomic current-lease check during the authoritative
World tick. **Handshake exact bytes, explicit enable flag, and signed
epoch proof are NOT implemented or established by this PR**; remain
blocking cross-owner approval items, not implicit features.

During v2 gesture ownership, mask the overlapping legacy-v1 LMB/KeyE
input bits from Combat handling for that source; preserve v1 WASD,
RMB, wheel, Space/roll/parry and Chat Enter/Escape handling. Never
deliver the same KeyE or LMB intent through both v1 and v2 to create
a double hit. Core8A transports DOM edges captured by UI10; Combat4
alone adjudicates server 135ms LMB light WINDUP, possible upgrade
before strike, held 320ms READY and single heavy only on matching
RELEASE, early release single light, CANCEL no phantom attack.
No damage, charge, target, recovery or authority from `clientTick`.

## Alternatives REJECTED for this review

- Core8C [#715](https://github.com/tehki/myaso/pull/715)
  v2 type **0x52** batched header + event rows: contains useful
  design concepts (authenticated epoch and typed KeyE) but bytes
  are **not interoperable** with Combat4's original 0x11 / Core8A
  bounded outbox / 0x12 ACK. Do not run both. Retain 0x52 only
  as comparative dormant evidence; strict current v1, current 0x11
  and this candidate decoder reject it.
- Adding KeyE to old v1 INPUT heavy bits as a hidden side channel:
  current missing-held-packet alias cannot distinguish KeyE from
  orphaned heavy LMB RELEASE. Explicit typed source avoids that.
- Placing a bare `actorEpoch:u64` in the event and treating it as
  auth: numeric replay across actor reuse is possible unless
  the actual server QUIC session lease and World epoch fence it.
  A server-issued epoch is instead bound out of band to the trusted
  existing gameplay connection/stream, subject to Core8C review.
- ACK meaning "hit": forbidden; only an authenticated live World tick
  can commit a Combat HIT once for a gesture.

## Verifiable DORMANT proof and decisions still required

Node + Rust independent literal vectors for LMB PRESS/RELEASE in
same tick42, KeyE PRESS/RELEASE in distinct source byte3=1, original
0x12 ACK and negative wrong version/0x52/invalid source/action/zero
identity. The JS test calls **actual dormant Core8A outbox** for
LMB and **actual older decoder** to prove KeyE is denied until
negotiated update. Rust test imports **actual dormant Combat4 decoder
and ACK encoder**, also independently requires KeyE denial. Neither
runtime importer gains a new codec or stream. Golden vectors are
review bytes, not live source auth or network tests.

## New authentic QUIC default-v1 security gate (still NOT live v2)

Beyond pure source goldens, `server/tests/core8a_v2_unnegotiated_real_quic.rs`
builds/starts the real unchanged `myaso-server` with **two separate
certificate-pinned WebTransport/QUIC clients** on disposable loopback.
Both establish the original genuine game stream and send 16-byte
Combat4/Core8A LMB type0x11, proposed typed KeyE type0x11, and
the incompatible alternate 48-byte type0x52 datagrams **without any
v2 negotiation**. Neither may cause a version2 type0x12 gesture ACK,
and neither may close/disable the original two clients. Each then
sends a genuine original v1 input datagram with a distinct client tick
and MUST receive a correctly addressed server-owned v1 INPUT_ACK with
its own assigned net player ID. This distinguishes *refused optional
protocol* from broken gameplay service. The wire gate proves only
current non-activation and safe legacy traffic: it does NOT prove
future authenticated v2 negotiation, delivery, retransmission, actor
fencing, real Combat commits, UI mouse input or independent hosts.
The new step is part of the same exact-head dedicated Rust/JS workflow.

**Owner sign-offs required IN #723 BEFORE proceeding:**
Core8C confirms per-connection actor/epoch/world-tick fence,
revocation on death/rejoin and source-specific KeyE treatment;
Combat4 confirms KeyE PRESS/RELEASE/CANCEL meanings, no charge alias,
full original 34/46HP World single-hit invariants;
UI10 confirms KeyE real DOM capture, LMB CANCEL/blur and chat focus
arbitration; Main locks selected bytes, real capability handshake,
default-OFF feature policy, protected CI and staging approval.
Then Core8A can separately implement actual QUIC reliable v2 stream,
ACK issuer/auth replay, fail-first loss/reorder/short-tap/reconnect,
true Rust + W3C Chrome/Firefox 2–4-player Combat and independent
client hosts. Until then, **release stays HOLD**.

Pre-Alpha original arena Silver/R4/optional Chat remains distinct
from Full Greyhaven physical swords #480/#488. No merge to main,
port changes, deployment, network listener, player data change or
production activation is authorized by this proposal.

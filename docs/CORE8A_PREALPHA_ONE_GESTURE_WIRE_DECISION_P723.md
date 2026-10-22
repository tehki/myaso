# 🌕⚡️🚀 Core 8A — ONE v2 gesture wire candidate for Main #723

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

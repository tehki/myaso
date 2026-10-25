# Main 0 — Pre-Alpha 0.1 Final Acceptance Packet

**Status: INCOMPLETE TEMPLATE — NOT RELEASE AUTHORIZATION.**  
**Canonical candidate:** [PR #1036](https://github.com/tehki/myaso/pull/1036), starting review checkpoint `78634ecc797ee0024a574f46ad0ea22ba9e76f4a`; final source is the package `REVISION` and exact-head GitHub acceptance record.  
**Protected main at review:** `6fa59b649112c272bcbc018b4a32bf963f9a5bba`.  
**Rule:** Do not merge, deploy, enable public experimental protocols, or alter production configuration using this document. Main 0 and the owner retain release authority.

This packet makes the outstanding operational evidence explicit. It does not itself prove that any gate has passed. Complete it against one immutable candidate and one separately authorized non-production environment.

## 1. Historical evidence snapshot (not final-head acceptance)

- [Protected quality #40197147667](https://github.com/tehki/myaso/actions/runs/40197147667): exact candidate, 166/166 executed steps passed.
- [Mandatory native Chrome/Firefox matrix #40197147725](https://github.com/tehki/myaso/actions/runs/40197147725): 8/8 passed and same-SHA repeat passed.
- [Original four-browser gameplay #40197147655](https://github.com/tehki/myaso/actions/runs/40197147655): passed.
- [Core 8 original QUIC/World #40197147758](https://github.com/tehki/myaso/actions/runs/40197147758): passed.
- [Private HIT loopback #40197147753](https://github.com/tehki/myaso/actions/runs/40197147753): passed in developer-loopback scope only.
- [Fresh bidirectional private UDP probe](https://github.com/tehki/myaso/pull/461#issuecomment-6398814698): blocked; no packets received in either direction. No gameplay test.
- Packaging was skipped because branch eligibility excluded the canonical integration. The current engineering correction enables a review-only artifact through that same workflow; no deployment or release publication is authorized. Qualification remains pending an exact-source artifact, checksum and verification record.

**Current decision: AUTOMATED PASS / EXTERNAL ACCEPTANCE INCOMPLETE / RELEASE HARD HOLD.**

## 2. Gate A — independently operated multiplayer

**Owners:** Core 8A/8B/8C, Combat 4D (independent QA), UI 10.

Before the trial, fill in all fields:

- Non-production environment and owner authorization: `[REQUIRED]`
- Exact server source SHA and deployed artifact SHA-256: `[REQUIRED]`
- Server host alias, TLS certificate SHA-256, pinned URL/port: `[REQUIRED — do not use a production-associated endpoint]`
- Independent human-operated machine aliases and browser versions (2–4 distinct physical machines): `[REQUIRED]`
- UTC start/end times and evidence artifact links: `[REQUIRED]`
- Server-side session/actor identifiers and corresponding client-side evidence: `[REQUIRED]`

Run actual player sessions on separate machines; do not count multiple browser processes on one runner as independent human hosts. Record join/admission, authoritative movement and combat, damage/HP, disconnect and ghost removal, rejoin with a fresh valid actor/session, and post-rejoin movement. Preserve raw timestamps and the exact tested SHA.

**Pass only if** server authority and every client observation agree for the same build; the independent QA owner records a signed PASS. Otherwise mark FAIL/HOLD with evidence.

## 3. Gate B — live WAN loss, delay and jitter

**Owners:** Core 8A, Combat 4A; Combat 4D validates independently.

The existing deterministic regression covers the historical multi-packet first-edge gap, and current loopback trials recovered genuine dropped samples. This does **not** prove live WAN behavior.

- Record the real network impairment tool/profile, packet-loss rate, delay, jitter and consecutive-packet gap duration: `[REQUIRED]`
- Record client send/transport evidence and matching server ingress evidence for the **same original source-0 action tick**, session and actor lease: `[REQUIRED]`
- Verify exact one-shot recovery or fail-closed rejection, duplicate suppression, release/cancel/focus-loss behavior, and no stale action after lease/session retirement: `[REQUIRED]`
- Preserve original v1 34-byte packet format and strict M108/M229/M230 assertions. Never count a later held sample as recovery of an earlier one-shot edge.

**Pass only if** the same original sample is proven accepted exactly once under the declared adverse-network profile and no stale or duplicate action is accepted. A successful ordinary loopback run is not a substitute.

## 4. Previous private M147 scope — not authorized for this standard-path execution

**Owners:** Core 8B/8C, Combat 4C; Combat 4D validates independently.

The latest owner command prohibits `gestureLab=1` and experimental protocol bypasses. This section preserves historical scope and missing evidence; it does not authorize executing private laboratory acceptance in the current standard-path workstream. Do not present older private-loopback evidence as current standard-path or public acceptance.

Public experimental v2/HIT5/HIT6 remains disabled. Private HIT remains default-off outside an explicitly authorized isolated test.

Record a non-production test covering:

- Authoritative World HIT identity, source, victim, tick and resulting HP.
- Attacker/victim-only receipt delivery; spectator exclusion.
- Processed/write-before-ACK behavior, matching ACK cursor, GAP/replay and duplicate rejection.
- Reconnect, actor-incarnation/lease change, overflow and stale-recipient retirement.
- Actual network loss/jitter profile and raw client/server evidence on the same immutable SHA.

Required environment and feature-flag attestation: `[REQUIRED]`. Four-browser developer-loopback PASS is partial evidence, not external WAN acceptance.

## 5. Gate D — executable rollback and restore drill

**Owners:** Main 0/release operator and Core 8C.

The existing Ready-Five README documents only the reversible **art flag**. It refers to a separate supervised previous-release workflow but does not provide verified deployment-specific service names or executable application rollback commands. Do not invent those values.

Before a rollback drill, the authorized operator must fill and review:

- Isolated non-production target and approval: `[REQUIRED]`
- Current candidate source SHA, deployed artifact SHA-256, and redacted configuration digest: `[REQUIRED]`
- Exact previous known-good source/artifact SHA-256 and protected restore-point location: `[REQUIRED]`
- Actual deployment mechanism, service identity, and reviewed stop/restore/start/health-check commands: `[REQUIRED — copy from the real authorized deployment system]`
- Operator and independent witness: `[REQUIRED]`

Perform the drill **only** on the approved isolated environment. Record UTC timestamps, command outcomes, before/after artifact and configuration identities, health checks, TLS pin, player join/movement smoke, and confirmation that experimental public protocols remain disabled. Demonstrate restoration of the previous approved version, not just removal of the art flag.

If the operator cannot identify the restore point or verify the actual commands, the rollback gate is **NOT PROVEN** and release remains HOLD. No production restart or deployment is authorized by this packet.

## 6. Final authorization record

Do not mark any box until the linked evidence exists.

- [ ] Gate A: independent human multiplayer PASS, evidence linked.
- [ ] Gate B: adverse WAN first-edge recovery and cancellation PASS, evidence linked.
- [ ] Gate C: private HIT recipient isolation/ACK/GAP/reconnect PASS, evidence linked.
- [ ] Gate D: previous-version restore drill PASS, evidence linked.
- [ ] Combat 4D records independent final verdict against the exact tested SHA.
- [ ] Main 0 verifies the exact SHA and complete evidence packet.
- [ ] Owner posts explicit GO for the stated release and environment.
- [ ] Release scope, default-off flags, monitoring and rollback owner are stated.

Any failed, missing, cross-SHA, loopback-only or unrepeatable evidence keeps the gate **HOLD**. A GO for one scope does not authorize First Playable Alpha, public experimental protocols, real-value settlement or any unrelated deployment.

## 7. Separate Alpha lane

First Playable Alpha remains a separate integration track tracked by [issue #480](https://github.com/tehki/myaso/issues/480). Greyhaven, physical rack-sword pickup, equipment, and new architecture/art drafts must not be merged into this Pre-Alpha candidate solely to satisfy this packet. Alpha requires its own exact-head end-to-end acceptance.

---
**Prepared by Main Orchestrator 0 as an evidence template only. No acceptance test, rollback drill, merge or deployment is implied by this file.**
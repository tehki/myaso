# Combat 4A / 4B / Core 8A — Public Instant-Light Cutover Review

**Owner contract approved; implementation cutover and public protocol activation NOT authorized.**
2026-10-27. Base: exact clean 20/20-green Combat Draft #1077
`73113571c765295f0067331b2d348912a54da8af`.
This Draft is a nonproduction design and acceptance prerequisite, not a live release.
No merge, production changes, server flags, ingress change or public protocol v2 enabling.

## Actual incompatibility in existing sources

- `src/browser/left-button-charge.mjs` explicitly commits ordinary legacy
  Light on pointer **UP** (unless Space+LMB); legacy `web/online-game.mjs`
  calls `press({immediate:false})` and then `release()`.
- Original v1 6-byte INPUT sample has no gesture ID, physical source or
  request identity. A lost/reordered release or Key E-shaped bit pattern
  cannot safely express the approved physical DOWN / UPGRADE / UP contract.
  Do NOT retrofit inferred gesture IDs into original v1 packets.
- Dormant `prealpha_lmb_gesture_authority.rs` + original World already
  expose lease-bound PRESS → BeginLightWindup and a source0 UPGRADE route
  that MUST occur before Light has landed; the Rust clock controls
  HeavyReady at 320ms. A late upgrade after LightActive is a NO-COMBAT
  action, not a second damage opportunity.
- Dormant `prealpha-lmb-dom-gesture-review.mjs` attaches **one**
  exclusive owner of LMB input; its hold-UPGRADE trigger is deliberately
  manual (review only). Existing browser loopback private-gate is
  dual opt-in and server bound to loopback; public clients stay v1.

## Required single-source design — unresolved approval points

1. The authenticated negotiated typed source0 outbox MUST atomically
   replace the existing sampled public v1 LMB producer for a specific
   connection lease; never attach both listeners or let Key E own source0.
   Only server World 60Hz tick and actor-incarnation fence authorize hit.
2. Trusted physical LMB DOWN (including RMB-held mousedown path) creates
   a single same-lease PRESS. Original World immediately enters
   LightWindup, 135ms windup unchanged, damage remains 34 HP only on real
   World LightActive contact. Down cannot give client-side HIT credit.
3. **Unlanded-only upgrade:** an observed held pointer must request a
   SAME-gesture UPGRADE *before* the World adjudicates LightActive/contact
   (server action guard), else it loses upgrade eligibility. Core 8A/4B
   must review the exact early-upgrade policy: a 320ms local client timer
   is TOO LATE for a 135ms Light windup. Do not infer that holding alone
   retroactively cancels a real Light HIT.
4. From a valid pre-contact UPGRADE, authoritative World holds charging
   state, enters HeavyReady at **320ms measured from server PRESS** and
   sends no damage while still held. Physical pointer UP then resolves
   exactly one 46HP Heavy attack; early UP resumes original Light rules.
   Lost/delayed/reordered upgrade/UP cannot clone, reset or backdate hit.
5. All pointerup/cancel/blur/visibility/transport-close/reconnect paths
   retire the same gesture and lease once. Duplicate presses, stale IDs,
   canceled ownership, late ACKs, u32 rollover and actor-incarnation swaps
   are rejected/tombstoned; no second combat writer or spectator effects.
6. Preserve genuine Space+LMB 42HP JumpAttack and running RMB+LMB
   behavior in the single source0 path. Server must consume identical
   authenticated actor identity and rollback restores v1 baseline.

## Cutover gate: fail-closed before public activation

- Contract tests: real W3C pointer DOWN starts original World
  LightWindup before physical UP; without fabricated timeout.
- Under 320ms: genuine early UP with no valid HeavyReady cannot invent
  46HP damage; if Light landed before upgrade, later UP/upgrade
  cannot inflict additional damage.
- At/after 320ms: valid held, unlanded World charge READY;
  no Heavy hit before genuine UP; one 46HP hit only after UP.
- Two browsers, 4 players, lost/duplicate/reordered QUIC and reconnect;
  34HP/46HP, Parry125ms/Block240ms/JumpRecovery450ms unchanged.
- Independently accepted Chrome/Firefox first attempts under load; then
  isolated two-machine WAN and witnessed isolated rollback.
- Core 8A, Core 8C, Combat 4A/4B and independent 4D must sign off the
  exact proposed authority state machine before replacing public v1.
  Separate owner approval is required for live activation.

**Current verdict: public instant-Light NOT IMPLEMENTED / NOT ACCEPTED.**
The existing 20/20 SHA `7311357` and its public v1 remain unchanged.

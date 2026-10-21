# Combat 4 — Pre-Alpha 0.1: safe LMB release gate and required protocol provenance

**Authority:** Main Orchestrator [#695](https://github.com/tehki/myaso/issues/695), Combat P0 [#696](https://github.com/tehki/myaso/issues/696). **Base:** merged `main` `6fa59b649112c272bcbc018b4a32bf963f9a5bba`.

**Classification: PARTIAL SOURCE CORRECTION, NOT A READY PRE-ALPHA COMBAT BUILD.** No browser gestures, production wire, native acceptance, merge, staging or deployment are changed by this candidate.

## Actual fail-first evidence

On isolated Serj Linux, new `server/tests/prealpha_lmb_authority.rs` failed two original-source checks:

1. An original server light at `attack=true, heavy=false` began `AttackWindup`; adding `heavy=true` while still held entered `HeavyAttackWindup` **and reset the already elapsed authoritative light clock**. `early_held_lmb_upgrade_remains_ready_from_the_original_server_press_clock` RED.
2. Keeping `attack=true` until the original light completed and the actor returned to idle, then receiving delayed `heavy=true` with the same still-held LMB, began an entirely NEW `HeavyAttackWindup`. `delayed_heavy_edge_cannot_turn_one_already_landed_lmb_light_into_second_heavy` RED.
3. A standalone `attack=false, heavy=true` KeyE heavy from idle correctly entered heavy windup (GREEN).

## Narrow, inactive-with-respect-to-the-browser correction

- While upgrading an unlanded light or running-light with actual **co-held** `attack+heavy`, retain the fighter's already elapsed authoritative light-windup time and set the existing `charging_heavy` state. The unchanged `advance_action` clamps READY to 320 ms and never attacks until release. Existing standalone KeyE upgrade without LMB retains its original path.
- Reject a new heavy edge from idle when the *same* `attack` button remained continuously down from a prior server sample. This forbids a delayed co-held upgrade becoming a second heavy **after** the first light reached contact/recovery. Standalone `attack=false,heavy=true` remains valid.

All three new actual Rust simulation tests are GREEN after this patch. The original shared world, damage constants, timings, movement, packet codec and browser input remain unmodified.

## Why instant pointerDOWN MUST NOT be enabled using existing bits

**Direct source diagnostic:**

```
SOURCE_REAL_ON_PRESS []
SOURCE_REAL_ON_RELEASE ["LIGHT"]
THREE_SAMPLE_BYTES 34
```

The merged `src/browser/left-button-charge.mjs` still sends the normal light callback on pointerUP; `web/online-game.mjs` still sends `attack+heavy` from the start of a held LMB, so the live source remains release-to-strike.

Existing `src/network/input-codec.mjs` and `server/src/lib.rs` use **16-byte header + 3 six-byte sampled inputs = 34 bytes** and eight occupied button bits. A standalone KeyE (`attack=0,heavy=1`) and a heavy-release arriving **without its lost preceding held-LMB samples** serialize to the SAME sample values. Server receives no origin, gesture epoch or reliable press-release edge. A short native press+release can also begin and end between two 30 Hz input samples and vanish from a boolean-only capture. A new guessing rule based on time, HP or local browser clock would be non-authoritative.

**Minimum reviewable alternative (not implemented or approved):**

- Version and negotiate an explicit *source-authenticated per-LMB gesture event* with a bounded monotonic gesture ID scoped to the authenticated server session/actor lease. Typed events should be `PRESS`, `UPGRADE_WHILE_HELD`, `RELEASE` and `CANCEL`, separately identified from standalone KeyE heavy. Transport must retain quick press/release edge transitions across 30 Hz sampling and packet loss, with ACK/redundancy/dedup and no client hit authority.
- The server starts normal light windup on the first accepted `PRESS`; upgrades only that SAME still-unlanded light when a matching held-intent arrives in its original 135 ms window. Preserve accumulated server ticks into heavy charging; server READY at 320 ms cannot auto-strike. A matching `RELEASE` fires exactly one heavy **only after server READY**; an early release resolves at most one legal light; `CANCEL` never adds an attack. Late/lost upgrade after light contact fails closed without double damage. Separate KeyE remains authoritative and distinct.
- Invalid/duplicate/old IDs, actor lease/reconnect changes, death, focus loss, native Space+LMB, RMB+LMB, wheel parry/roll, packet reorder, packet loss, multi-browser independent-host conditions and M41/M107/M108/M111/M147/M155/M171/M194/M206 must all be proven before rollout. Do not trust client elapsed milliseconds or expand protected windows.

**Decision requested from Main Orchestrator:** approve a small versioned input-provenance protocol extension or specify an equally unambiguous authoritative alternative. Without this, restoring instantaneous pointerDOWN via the existing 34-byte flags alone is **RELEASE BLOCKED**. Do not label the narrow Rust improvement an instant-light fix or a playable release.

No merges, protected-test waivers, service restarts, or deployment rights are implied.

## Review-only codec prototype (child candidate, no runtime use)

The separately pinned child defines a **proposal-only**, explicitly non-negotiated v2 16-byte envelope for genuine LMB gesture *messages*; it does NOT yet prove browser gesture truth, guaranteed transport or safe gameplay. The old 34-byte v1 input datagrams remain byte-identical, current server rejects v2 there, and no active player/client imports this proposal.

| Byte offsets | Input event | Server ACK |
| --- | --- | --- |
| 0 | Protocol proposal version 2 | Version 2 |
| 1 | Type 0x11 | Type 0x12 |
| 2 | PRESS=1, UPGRADE=2, RELEASE=3, CANCEL=4 | ACCEPTED=1, DUPLICATE=2, STALE=3, REJECTED=4 |
| 3 | Reserved, required zero | Reserved, required zero |
| 4–7 | Nonzero event sequence, little-endian u32 | Correlated event sequence |
| 8–11 | Nonzero lease-scoped gesture ID, little-endian u32 | Correlated gesture ID |
| 12–15 | Client tick for diagnostics only, **never charge authority** | Authoritative Rust server tick |

**Unimplemented gates:** authenticated lease-binding at ingress (never client-selected actor), reliable ordered event delivery with de-duplication/ACK/backpressure, handshake to negotiate v2, event sequencing across reconnect/death/cancel, rate limits, press→release-before-30Hz preservation, binding event state to actual World simulation timing, session-epoch fencing, and native Chrome+Firefox integration. Sequence wrap requires a new lease or defined safe rollover; do not silently allow it. The proposal is only a portable serialization and validation contract to review jointly with Core 8A/8C, not permission to change either live packet format or production behavior.

# M230 — bind genuinely dropped heavy input to the exact recovered original action

Tracking: [#279](https://github.com/tehki/myaso/issues/279). The related open root-cause investigation is [M229 #277](https://github.com/tehki/myaso/issues/277). Baseline [M229 `e88c8bd`](https://github.com/tehki/myaso/commit/e88c8bd44b9b8e2e2e9131032046c54785d89b98), [149/149 independent main checks](https://github.com/tehki/myaso/actions/runs/38873810261).

## Why M229 counts were insufficient

On genuine M108 Chrome/Firefox input-loss acceptance, the loopback Rust server drops the first datagram containing the one-shot E heavy input, then may recover that *same original sample* from a subsequent redundant packet. The M229 accepted-input log reported `client_tick`—the **newest** accepted/coalesced input tick. If the one-shot occurred at tick 40 and recovery came from packet 42, it might log 42 despite the heavy button edge still being from 40. Independent positive *counts* of dropped and accepted actions don't establish they are the same action in the same session.

## M230 strict proof

- In the existing loopback-only accepted-ingress log, preserve all M229 fields and add `action_tick` read directly from the accepted `InputSample` that actually carried `heavy_attack`. It is **not** reconstructed from network clock, packet header, or coalesced newest state.
- A pure JS parser reads authoritative server output and requires exactly one original `M63_INPUT_ACTION_PACKET_DROPPED` and exactly one `M229_LOOPBACK_HEAVY_INPUT_ACCEPTED` line; their session ID and original action tick **must match**, in drop-before-accept order.
- Validate the exact three-copy 60Hz redundancy window, accepted sample bounds, 32-bit tick behavior including wraparound, and reject cross-session/mismatched-tick, duplicate/absent, or out-of-window claims. No retries or proxy measures produce a pass.
- The unchanged genuine W3C M108 Chrome/Firefox heavy flight must **first** prove exactly 46HP hit with original authentic E input; only then can the M230 evidence checker succeed. A successful flight emits `M230_EXACT_HEAVY_REPLAY_EVIDENCE` with the true original heavy tick, dropped packet tick and accepted replay tick. No synthetic DOM input is used.
- Deterministic Node tests include successful linkage, malformed/missing/duplicate/cross-session/out-of-order/replay-window and u32 wrap cases; the complete suite and a dedicated focused CI gate run them.

## Scope and release

This is read-only evidence in the loopback impairment fixture and strict acceptance harness. The normal production path is unchanged; no gameplay, damage/stamina, movement, physics, protocol, packet redundancy, native browser controls, or input timing was altered.

Full exact-head CI twice plus independent post-merge `main` CI are mandatory. Keep the root-cause issue #277 open. M230 helps discriminate which genuine one-shot was recovered; it does **not** make three lost datagrams recoverable and is not the final reliability fix. No playable build or production deployment.

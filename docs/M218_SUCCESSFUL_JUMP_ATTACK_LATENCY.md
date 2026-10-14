# M218 — read-only genuine jump attack feedback

A focused successful-action slice of [M196 responsiveness issue #221](https://github.com/tehki/myaso/issues/221). It observes the **existing strict M136 Chrome attacker / Firefox victim** genuine Space+LMB jump-attack exchange (one true Space keydown/up and one true LMB down/up no more than 60ms apart), direct server-authoritative jumpAttackWindup→Active→Recovery→Idle, correctly replicated victim focus, exactly one **42HP** narrow jump-attack hit, full 100HP/guard on attacker, and no false parry. All original acceptance gates must pass *before* any latency observation is emitted.

Three client-local observations on **the same Chrome attacker browser**, never mixing server or Firefox clocks:

- Genuine combined Space+LMB chord browser epoch → Chrome-observed replicated authoritative jumpAttackWindup epoch.
- Genuine chord browser performance time → visible "Jump attack committed - the narrow lane is readable." DOM event.
- Genuine chord browser performance time → visible "Opponent hit - 42 HP." DOM hit-confirmation event.

A late/stale/missing cue, inverted timestamp or unverified simultaneous chord yields null/missing evidence, never fabricated zero. These are local observed-authority and DOM feedback measurements, **not** the server's instant commitment, animation frame present time or human-perceived responsiveness. No changed controls, narrow hit cone, damage values, combat, physics, Rust/protocol, networking, rendering, retries, public playable or production execution. Full real-browser exact-head and independent merged-main CI are required.

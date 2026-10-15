# M229 — heavy input-loss ingress evidence and bounded replay matrix

Tracking: [M229 #277](https://github.com/tehki/myaso/issues/277). Base: certified [M228 main `f1bb97d`](https://github.com/tehki/myaso/commit/f1bb97d10a1462b62e534ddd287288be39704a69), [148/148 independent main quality](https://github.com/tehki/myaso/actions/runs/38791391640).

## Failure being investigated

One unchanged-head M228 full-quality attempt failed existing strict M108 real Chrome/Firefox `uiheavyinputloss`: browser recorded genuine `KeyE` down/up, the server logged one deliberate `M63_INPUT_ACTION_PACKET_DROPPED`, but no authoritative heavy action, and both HP values remained 100 rather than 100/54. Other attempts and independent merged-main quality passed. **No cause has been proved.**

The production input codec carries **three most recent samples** in each 60Hz datagram. A single one-shot `heavyAttack` sample is thus present in three packets, but the client does not resend until server acknowledgement. A deliberate initial drop plus further packet loss may exhaust the replay; server admission/reordering is another possible cause.

## Acceptance-only evidence introduced

- A **deterministic Rust server matrix** uses the actual wire decoder, M63 new-action drop detector, ingress deduplication, coalescer, real `World` action latch and simulation step. It tests three scenarios: one deliberately dropped heavy datagram with **0, 1 or 2 additional** dropped packets. The first two scenarios must begin exactly one authoritative `HeavyAttackWindup`; losing all **three** carrying packets must remain **Idle**, never invent an action. HP stays 100 throughout.
- A **real JS wire-codec regression** independently confirms the heavy bit survives in exactly the three newest-to-oldest encoded datagrams and disappears from the fourth. It uses production encoding/decoding but is **not** substituted for genuine W3C browser acceptance.
- During a loopback-only M63 first-action-drop flight, after actual Rust `InputIngressWindow` dedup and coalescing, the server emits `M229_LOOPBACK_HEAVY_INPUT_ACCEPTED` with **session, accepted client tick, received packet tick and accepted sample count**. It logs only a genuinely accepted heavy action, not an attempted/sent action. No added logging on the normal production path.
- In the **existing** M108 scenario, **after the unchanged real Chrome/Firefox 46HP/100HP and attack-feedback assertions have succeeded**, the runner requires at least one server `M229_LOOPBACK_HEAVY_INPUT_ACCEPTED` alongside the original mandatory first-drop proof. `M229_HEAVY_LOSS_INGRESS_EVIDENCE` records the counts. Missing authoritative hit or accepted ingress fails closed; no synthetic input, retries, health relaxation, or artificial attack.

## Interpretation

This milestone distinguishes: (a) authentic `KeyE` observed by browser, (b) intentional first datagram loss, (c) server accepted a recovered heavy input, and (d) server-authoritative heavy damage with genuine HUD feedback.

The matrix demonstrates the **nominal bounded three-copy contract**, not a solution to genuinely losing all three datagrams, and cannot by itself explain the intermittent M108 failure. If another failure occurs, the presence/absence of `M229_LOOPBACK_HEAVY_INPUT_ACCEPTED` will isolate server action delivery vs. simulation/damage.

**Acceptance gates**: full exact-head CI twice, Chrome/Firefox genuine M108, original complete Rust/JS PvP/FFA, and independent merged-main quality. Keep M229 issue open until the intermittent case is explained or the reliability decision is recorded. **No combat parameters, network protocol, production server path, playable publication or deployment changed.**

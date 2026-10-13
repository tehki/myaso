# M201 — authoritative 60 Hz proof of genuine FFA guard-break punish

## Failure and root cause
[M200 PR #231 quality attempt 1](https://github.com/tehki/myaso/actions/runs/38270425283) intermittently missed `attackActive` in Chrome's `ownActionTransitions` while a legitimate single 34 HP light punish was received by the stunned guard-broken fighter. The browser records states from snapshot delivery (nominal 50 ms), which does **not** guarantee observing every 80 ms server-authoritative `AttackActive` phase, especially under real browser/input scheduling. Repeating the unchanged build passed, making this an evidence gap rather than permission to accept a hit without proof.

## M201 implementation
- Only when the real-browser runner requests `MYASO_FLIGHT_ACTION_PROOF=1` **and** the game server binds to loopback, its 60 Hz authoritative simulation emits read-only stdout diagnostic records for genuine fighter action transitions, guard-break events, and hits, all carrying native **server ticks and fighter IDs**. The Rust server refuses the trace on a non-loopback bind. The gameplay network/protocol and combat model are unchanged, and no fixture creates or injects combat inputs.
- The M152 Chrome/Firefox/Chrome2 browser flight reads that server process's stdout directly. The independent verifier requires exactly one defender guard break and stun, one subsequent attacker light windup and windup-to-active server transition, and precisely one attributed 34 HP/66 HP hit to that defender within the unchanged 650 ms stun (39 server ticks at 60 Hz). No extra hit or damage to idle fighter #3 is permitted.
- The real browser still must provide **exactly one genuine Chrome W3C LMB down/up**, valid aim, recovery buffer timing, opponent damage feedback, clean attacker/bystander HP, and eventual stun/focus clearing. Server phase evidence cannot substitute for these client-input proofs. The 80 ms active phase does not need to appear in the sampled browser transition list, but its genuine **server action edge is mandatory**.
- Browser wall clocks are **not compared** with server clocks. Browser epochMs is used only for the genuine input/90 ms recovery buffer validation, while server tick values prove action ordering and the stun window. Both are required separately.
- The parser rejects malformed traces, nonmonotonic ticks, missing active phases, invalid fighter IDs, stale/late activation, wrong hit damage/HP and collateral hits.

## Release gate
Run all Rust unit/clippy/fmt checks, M201 focused Node tests, genuine W3C M152/M194/M107 and FFA checks, and 512-occupant browser/server capacity in exact-head CI. Then independently requalify merged `main`. No playable build launch, server deployment, trading/payment systems, or production changes.

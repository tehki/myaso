# M217 — read-only successful short-RMB kick observability

Third successful-action M196 [issue #221](https://github.com/tehki/myaso/issues/221) slice. Existing **M153 real Chrome+Firefox+Chrome2 3-player FFA** proves a genuine short right-mouse down/up under 180ms (kick, not hold-to-run), authoritative kick windup/active/recovery, defender knockdown, Chrome focus HUD + recovery hint, no HP/guard loss, and eventual true focus/knockdown recovery. M217 logs **only after** all these existing fail-closed assertions.

The same **Chrome attacker's browser** timestamps supply two diagnostics: genuine successful-attempt RMB down browser epoch → locally replicated authoritative own kickWindup epoch, and RMB down browser-performance t → locally visible FFA KNOCKDOWN focus label transition t. Attempts are explicitly fenced to the successful attempt, not earlier retries. Missing/stale/negative/cross-browser results are null with reasons. No claim to true server commitment timestamp, frame presentation, population p95 or response feel.

No gameplay constants, W3C input, retries, attack rules, server Rust/protocol, rendering, production telemetry or public playable deployment change.

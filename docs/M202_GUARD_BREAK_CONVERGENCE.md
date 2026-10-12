# M202 — preserve guard-break convergence before additional W3C inputs

Merged M200 main quality [#38274550712](https://github.com/tehki/myaso/actions/runs/38274550712) correctly rejected an unblocked 34 HP hit during the third fresh M194 guard-break session. The third real wheel + click already produced authoritative Chrome 'Opponent guard broken - punish', while the independently observed Firefox player guard was still 24. The runner queued a **fourth** genuine wheel + click using that stale defender value and struck the stunned target for 34 HP. This is not a request to weaken M34/M194 expectations.

M202 is an acceptance-only read-side correction: once the attacker has server-derived guard-break confirmation **or** three valid genuine click/wheel exchanges have been delivered, stop sending new combat inputs while polling for the defender's authoritative zero-guard snapshot. Require bounded convergence, 100 HP, no parry, guard 0, original exact damage/stun and direction evidence. Fail closed if evidence never converges; never fabricate input, relax damage checks, delay the server, change combat parameters or automatically retry a failed exchange.

The only clock used for this polling deadline is the test runner's monotonic time; no browser/server timestamp comparisons are introduced. The preexisting M152 callback still receives real authoritative browser snapshots; if snapshot latency makes its punish impossible, CI must report that failure independently (issue #232).

Full exact-head Rust, Node, real Chrome+Firefox, FFA, 512-player capacity and independent merged-main CI required. No playable build or deployment.

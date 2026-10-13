# M205 — repeat M201 genuine FFA punish proof three times

M201 fixed the evidence gap in intermittent M152 acceptance: a genuinely active server light strike could become invisible to the browser's sampled state observer. Server-only, loopback-enabled 60 Hz action and hit trace now establishes the precise guard-break stun, windup, attack-active and 34 HP/66 HP victim hit using server ticks.

The original M152 CI gate ran **one** fresh Chrome/Firefox/Chrome2 fight per quality run. M205 makes that same strict gate **three independent cold-start browser-and-server trials**, one after another (no retry-on-failure). Each invocation starts its own loopback Rust authority and Chrome/Firefox/Chrome2 W3C sessions, so per-session driver variance and one-shot trace state are challenged rather than hidden by reuse. A failed trial terminates the CI step.

The exact original safety and fidelity properties remain mandatory: one genuine Chrome LMB down/up and valid aim, real Firefox block wheel, strict recovery/stun timing, 100 HP/guard of the idle third fighter, exactly one 34 HP server-authored hit of the guard-broken fighter, and the server's actual windup→active edge. Missing transitions, late input, parry, collateral or repeated hits fail. No gameplay constants, simulation, wire protocol, or production settings change.

This modifies only the CI test repetition policy, adds a static gate-test, and preserves M201 loopback-only diagnostic behavior. Require full exact-head Rust/Node/browsers and 512-occupant qualification, followed by independent post-merge main quality. Keep public playable closed and do not deploy production.

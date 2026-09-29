# M33 - Real Online Authoritative Parry Feedback

## Objective

Make the highest-skill defensive exchange immediately readable in the normal online arena without adding client-side combat authority.

M33 adds distinct presentation cues only after the existing authoritative readability tracker proves a cost-free parry.

## Player presentation

- The successful defender receives `parry-success` feedback.
- The attacker whose commitment was read receives `parried` feedback.
- Both cues are short, non-interactive arena edge pulses.
- Existing parry text remains the explanation of what happened.
- No local parry prediction, collision decision, timing window, stun rule, or damage rule is introduced.

## Real-browser flight

The M33 `uiparry` scenario uses the production `index.html` client in concurrent Chrome and Firefox sessions against one loopback authoritative server.

M33 assigns the lower-net-ID Chrome client as attacker and the higher-net-ID Firefox client as defender. Both headless windows are normalized and the arena is centered before pointer input so element-origin geometry is consistent. Chrome closes right with real `D` input and uses the same real LMB move/down/pause/up sequence already proven by the M30 online flight. Firefox is pre-aimed left. To compensate only for GeckoDriver command-start latency, its genuine W3C RMB timeline is submitted first with a 120 ms in-action pause; 60 ms later Chrome commits the attack. This pre-arms the slow driver instead of reacting across browsers or launching both commands simultaneously. The production client, server parry window, combat rules, and acceptance thresholds remain unchanged.

The flight passes only when:

- attacker and defender both remain at 100 HP and 100 guard;
- attacker renders `Parried - your commitment was read.` plus `parried` feedback;
- defender renders `Parry! Opponent stunned - punish now.` plus `parry-success` feedback;
- real `D` movement plus LMB/RMB pointer provenance confirms rightward attack and leftward directional block input.

The observer reads rendered DOM/HUD state only. It does not inject action, HP, guard, position, stun, parry, or server state.

## Risk / rollback

Presentation-only product change consuming already-authoritative parry state. Server simulation, combat constants, parry timing, wire protocol, persistence, and networking remain unchanged. Rollback is to close/discard M33; frozen M32 remains unchanged.

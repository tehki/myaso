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

To avoid Firefox WebDriver latency controlling the parry result, M33 assigns the higher-net-ID Firefox client as attacker and the lower-net-ID Chrome client as defender. Firefox closes left with real `A` input and commits a leftward LMB attack. Chrome is pre-aimed right without blocking, then its concurrent W3C pointer timeline waits 120 ms before real RMB-down. Both timelines are submitted together, removing cross-browser command round trips while leaving the server parry window unchanged.

The flight passes only when:

- attacker and defender both remain at 100 HP and 100 guard;
- attacker renders `Parried - your commitment was read.` plus `parried` feedback;
- defender renders `Parry! Opponent stunned - punish now.` plus `parry-success` feedback;
- real `A` movement plus LMB/RMB pointer provenance confirms leftward attack and rightward directional block input.

The observer reads rendered DOM/HUD state only. It does not inject action, HP, guard, position, stun, parry, or server state.

## Risk / rollback

Presentation-only product change consuming already-authoritative parry state. Server simulation, combat constants, parry timing, wire protocol, persistence, and networking remain unchanged. Rollback is to close/discard M33; frozen M32 remains unchanged.

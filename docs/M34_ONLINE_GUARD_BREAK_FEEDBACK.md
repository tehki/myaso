# M34 - Real Online Guard Pressure and Guard-Break Feedback

## Objective

Make the anti-turtling guard loop immediately readable in the normal online arena without adding client-side combat authority.

M34 adds presentation cues only after the existing authoritative readability tracker observes guard loss or the zero-guard stunned transition.

## Player presentation

- Defender ordinary block cost emits `guard-pressure`.
- Attacker ordinary blocked strike emits `block-confirm`.
- Defender authoritative zero-guard stun emits `guard-broken`.
- Attacker authoritative guard break emits `guard-break-confirm`.
- Existing text remains the explanation of guard cost and punish opportunity.
- No local block, parry, guard-cost, guard-break, stun, or damage decision is introduced.

## Real-browser flight

The `uiguardbreak` scenario uses the production `index.html` client in Chrome and Firefox against one loopback authoritative server.
Chrome is the attacker and uses real `D` movement plus separate genuine rightward LMB requests. Firefox pre-aims left and holds real RMB continuously beyond the 115 ms parry-entry window. Each LMB request is issued only after the prior 470 ms attack commitment can finish, while guard is sampled before RMB release; a bounded fourth browser edge is allowed only if one request is dropped before becoming an authoritative attack.

The flight passes only when:

- the first two blocked strikes visibly spend guard while both fighters remain at 100 HP;
- the third blocked strike reaches 0 guard and produces the authoritative guard-break stun/readability transition;
- attacker renders `Opponent blocked - guard -38.` plus `block-confirm` before break;
- defender renders `Block held - guard -38.` plus `guard-pressure` before break;
- attacker renders `Opponent guard broken - punish.` plus `guard-break-confirm`;
- defender renders `Guard broken - you are vulnerable.` plus `guard-broken`;
- real key/pointer provenance confirms Chrome movement/LMB and Firefox held directional RMB;
- no parry feedback occurs.

The observer reads rendered DOM/HUD state only. It does not inject HP, guard, position, action, stun, parry, or server state.

## Risk / rollback

Presentation-only product change consuming already-authoritative guard transitions. Server simulation, 38-point guard cost, 115 ms parry window, 520 ms guard-break stun, wire protocol, persistence, and networking remain unchanged. Rollback is to close/discard M34; frozen M33 remains unchanged.

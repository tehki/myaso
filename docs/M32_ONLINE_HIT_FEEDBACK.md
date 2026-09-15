# M32 - Real Online Authoritative Hit Feedback

## Objective

Make successful melee exchanges feel immediate in the normal online arena without adding client-side combat authority.

M32 adds short presentation cues only after the existing authoritative readability tracker observes HP loss.

## Player presentation

- Authoritative opponent HP loss emits `hit-confirm` feedback for the attacker.
- Authoritative local HP loss emits `damage-taken` feedback for the defender.
- The normal arena renders each signal as a short non-interactive edge pulse.
- Existing HUD values and M29 text remain the explanation of what happened.
- No predicted hit, local collision result, damage value, or server rule is introduced.

## Real-browser flight

The M32 `uifeedback` scenario reuses M30's proven real `index.html` one-hit choreography in concurrent Chrome and Firefox sessions against one loopback authoritative server.

The flight passes only when the same authoritative 34-HP exchange also records:

- `hit-confirm` on the attacking client's real arena stage;
- `damage-taken` on the defending client's real arena stage;
- the existing 100->66 / 100 HP HUD result and M29 hit messages;
- real movement and rightward primary-pointer input provenance.

The observer reads rendered DOM attributes only. It does not inject combat state or invoke internal combat functions.

## Risk / rollback

The product delta is presentation-only. Server simulation, combat constants, wire protocol, persistence, and networking remain unchanged. Rollback is to close/discard the M32 branch; frozen M31 remains unchanged.

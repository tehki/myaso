# M29 - Authoritative online combat readability

## Objective
Make the real online browser client explain why an exchange was won or lost using only state already replicated by the authoritative server.

## Player-facing changes
- Authoritative HP loss becomes hit feedback instead of being hidden behind network-status chatter.
- Guard-only loss is identified as block pressure.
- Cost-free block plus attacker stun is identified as a parry; zero-guard stun is identified as guard break.
- Death and full-vitals `Idle` recovery are surfaced as defeat and respawn.
- Attack windup/active, block direction, dodge, stun, and death have visible arena cues.
- When no combat message is active, action-specific hints explain commitment/recovery before falling back to connection status.

## Safety / authority boundary
M29 changes presentation only. It does not predict combat outcomes, create synthetic combat events, alter server rules/constants, or change the wire protocol.
For parry attribution, the helper requires exactly one opponent; multi-opponent states keep generic entity transition messages rather than inventing an attacker.

## Acceptance
- Pure transition tests cover hit, block pressure, parry, guard break, death/respawn, and action hints.
- Existing browser/runtime/networking and M22-M28 authoritative combat flights remain green.
- No server file changes.

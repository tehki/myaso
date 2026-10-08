# M170 — Exhausted Feint Commitment

## Goal

Deepen the human-vs-human feint mind-game by proving that an early wheel-back only cancels a committed strike when authority can pay the unchanged 12-stamina feint cost.

M170 deliberately does not add a client-side “low stamina feint” warning. The browser does not receive authoritative action-age metadata, so it cannot reliably distinguish an early exhausted feint attempt from a wheel-back that simply arrived after the 70 ms light-feint window. A misleading warning would be worse than silence.

## Contract

- Light feint window remains 70 ms.
- Heavy feint window remains 160 ms.
- Feint cost remains 12 stamina.
- Feint recovery remains 270 ms.
- The genuine control remains LMB followed by wheel-back inside the early commitment window.
- With enough stamina, the existing M117 browser proof must still enter authoritative FeintRecovery.
- Below 12 stamina, the exact same early LMB + wheel-back browser-owned gesture must not enter FeintRecovery.
- A rejected exhausted feint spends no feint stamina and does not erase the original attack commitment.
- The original light continues through active/recovery.
- The exhaustion proof is aimed away from the rival so health and guard stay unchanged.
- No damage, guard, stamina, movement, timing, hitbox, packet, snapshot, or protocol constants change.

## Acceptance

The existing real Chrome + Firefox `uifeint` flight becomes a strict superset:

1. prove the normal early wheel-back feint and remote FeintRecovery readability;
2. wait for authoritative idle;
3. move/aim away and drain stamina below 10 using genuine RMB-hold running;
4. submit the exact same browser-owned LMB + wheel-back chord;
5. require genuine epoch-stamped LMB and wheel evidence;
6. require authoritative light Active with no FeintRecovery transition;
7. prove the rejected feint did not spend 12 stamina;
8. preserve clean HP and guard on both clients.

JS and Rust regressions also require the exhausted feint to remain committed through light Active rather than merely remaining in windup.

The playable build remains intentionally closed while combat acceptance continues.

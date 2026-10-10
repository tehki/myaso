# M180 — Real-Browser Guard/Parry Input Sequencing

## Problem evidence

- `main` post-M178 quality run 38085006194 failed M107 despite a real heavy hit, where Firefox wheel-back arrived too early and authoritative output was an ordinary -64 guard-pressure block rather than parry.
- M179 PR #195 initial quality run 38085385625 failed M34 because independent Chrome LMB and Firefox wheel-back calls raced: the first hit parried, leaving only two subsequent -38 guard-pressure blocks and no guard break.
- Independent reruns demonstrated the intended parry and guard-break gameplay paths; the combat kernels and protocol were unchanged.

## CI-only corrections

- M34 dispatches Firefox's genuine wheel-back and awaits delivery before issuing genuine Chrome left-button actions. Independent cross-browser request reordering can no longer make the wheel arrive after the attack.
- M107 biases its windup-relative wheel press 40 ms later (150 ms to 190 ms after observed windup), reducing early parry-window expiry during WebDriver latency.
- Existing fail-closed assertions continue to require authentic real browser inputs, authoritative hit/parry/guard-break events, clean HP and guard, and real FFA visual feedback.
- No gameplay, packet, simulation timer, parry duration, block duration, or stamina constant is changed.

## Promotion

Pass full Linux GitHub Actions quality suite including M107, M34, M35, M107 other heavy branches, M155/M156, and M8 authoritative capacity. Keep playable build closed.
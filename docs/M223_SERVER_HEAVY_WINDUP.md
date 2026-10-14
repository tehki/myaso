# M223 — Server-gated genuine heavy-counterplay input

Independent M221 repeat quality #38569834466, attempt 2, failed the existing strict M188 heavy-block flight. The wheel reached the authoritative server 265ms after heavy windup instead of the intended 155ms, so the defender correctly parried rather than applying 64 guard damage.

This CI-only change enables existing read-only server action tracing for the real heavy-block and heavy-parry acceptance flights. It sends one genuine Chrome E key gesture. Only after the server reports a fresh heavy-windup transition for that player does it schedule exactly one genuine Firefox W3C wheel, using measured wheel-ingress latency. No gameplay, server physics, combat numbers, or protocol changes.

Missing authoritative proof is fatal. Existing strict 100HP, -64 guard, parry stun, genuine browser controls and no retry after a resolved wrong outcome are unchanged. Complete exact-head and independent merged-main quality required prior to merge. No playable build or production.

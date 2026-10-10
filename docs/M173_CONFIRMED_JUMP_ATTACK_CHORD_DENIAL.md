# M173 — Confirmed Low-Stamina Jump-Attack Chord Downgrade

## Goal

Explain the last ambiguous jump stamina outcome without changing gameplay: a genuine same-tick Space + LMB chord submitted from idle with enough stamina to jump (14+) but not enough for the full jumping attack (26) must still become an ordinary Jump, and the denied jumping-attack intent must be explained only after authority acknowledges the exact chord.

## Contract

- Ordinary jump cost remains 14 stamina.
- Jump-attack conversion cost remains 12 stamina.
- A same-tick Space + LMB jumping attack from idle therefore remains 26 total stamina.
- With 26+ stamina, the existing chord still starts JumpAttackWindup.
- With 14–25 stamina, the same genuine chord still falls back to ordinary Jump and spends only 14 stamina.
- With less than 14 stamina, the existing ordinary-jump denial remains authoritative and takes precedence.
- The low-stamina jump-attack cue is queued from the genuine Space + LMB chord but is shown only after processedClientTick acknowledges that exact combined input and authority reports ordinary Jump rather than JumpAttack.
- Denial telemetry preserves queued → submitted → confirmed-rejected → shown.
- Input recognition is order-independent inside one browser action tick: Space-first and LMB-first delivery both identify the chord while preserving the separate airborne LMB conversion path from M172.
- No damage, guard, stamina cost, regeneration/drain rate, movement speed, timing, hitbox, packet, snapshot, or protocol constant changes.

## Acceptance

The existing real Chrome + Firefox uijumpattack flight becomes a strict M173 superset:

1. preserve M136’s successful genuine same-tick Space + LMB jump attack;
2. preserve M172’s later airborne LMB rejection below the additional 12-stamina conversion cost;
3. recover to authoritative idle and establish 14–25 stamina using genuine held-RMB running or bounded regeneration;
4. submit one genuine same-tick Space + LMB chord;
5. prove the exact chord tick is acknowledged before the visible low-stamina cue;
6. prove authority and the remote browser observe ordinary Jump only, with no JumpAttack state;
7. prove exactly 14 stamina is spent and combat vitals remain unchanged;
8. recover the fallback Jump to Idle.

JS and Rust kernel regressions independently prove that a low-stamina same-tick chord degrades to ordinary Jump and never damages the target.

The playable build remains intentionally closed while combat acceptance continues.

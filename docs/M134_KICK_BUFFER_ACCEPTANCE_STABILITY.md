# M134 — Kick Buffer Acceptance Stability

## Goal

Make the M133 real-browser kick-buffer proof robust to temporary hosted Firefox observation stalls without weakening its gameplay evidence.

## Change

The M133 flight no longer assumes a fixed 520 ms post-input sleep is sufficient for both browsers to render the terminal authoritative idle frame.

Instead it polls bounded UI evidence for up to 1600 ms and proceeds only when both sides have observed the complete sequence:

`attack-recovery → kick-windup → kick-recovery → idle`

## Evidence preserved

M134 still requires:

- one genuine Chrome short-RMB pointerdown/pointerup pair;
- pointerup duration below the 180 ms hold-to-run threshold;
- the short RMB release to land late in authoritative light recovery;
- exactly one authoritative kick;
- Firefox replication of the same kick sequence;
- no running-strike crossover;
- no parry outcome;
- the original one-hit 34 HP exchange unchanged.

# M216 — genuine successful parry + late punish feedback, read-only

Small successful-action responsiveness slice of [M196 #221](https://github.com/tehki/myaso/issues/221), layered on fully-certified M215. Reuses the unchanged real **Firefox attacker / Chrome defender** M146 scenario and records diagnostics **only after M146 passes** its original strict one genuine wheel-back, authoritative 650ms parry stun, single true late-window LMB, exact 34HP punish, no extra damage or guard loss, and both attacker and defender authoritative UI cues.

All three intervals are captured on the same **Chrome defender browser observer**:
- Genuine wheel-back performance time → matching visible "Parry!" DOM event cue performance time.
- Genuine wheel-back browser epoch → Chrome-observed **replicated authoritative opponent Stunned** action epoch. This is not the instant the server committed stun, and it does not subtract Firefox/server clocks.
- Genuine punish LMB pointerdown performance time → matching "Opponent hit - 34 HP." DOM cue performance time.

Cues earlier than the input, inverted/unsynchronized or stale data remain explicit null/missing. The original HP, stun, timing and action checks still fail closed independently. Per-CI-run reports are individual low-N diagnostic observations; do not treat as population p95 or graphics-frame presentation.

A genuine successful CI #38531729613 M146 session preceding this milestone observed approximately **66.8ms** wheel-back to parry DOM cue, **66ms** wheel-back to observed replicated Stunned, and **196.4ms** late LMB to 34HP hit cue. This historical single-run trace is only a baseline, not proof M216 passed until its own full CI.

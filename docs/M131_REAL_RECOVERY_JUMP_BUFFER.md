# M131 — Real Recovery Jump Buffer

## Goal

Prove M130's late light-recovery jump buffer through a genuine Chrome Space gesture and independent Firefox replication of authoritative action state.

## Real-control choreography

1. Chrome performs one genuine LMB light attack against the staged Firefox fighter.
2. Chrome's acceptance hook, populated only from authoritative snapshots, observes `attack-recovery`.
3. Chrome sends one real held Space key gesture late in that recovery.
4. Authority must finish recovery before entering `jump`.
5. Firefox must independently replicate the same `attack-recovery → jump → idle` sequence.
6. Space remains held past the first jump's completion so a repeated jump would be observable if the browser/client pipeline replayed held input.

The exact 90 ms buffer boundary remains pinned by M130's deterministic browser and Rust tests. M131 proves the real browser/input/network path reaches that behavior without creating a recovery cancel.

## Acceptance

The flight fails closed unless:

- exactly one real `keydown:Space` and one real `keyup:Space` are observed;
- the Space keydown occurs after authoritative light recovery has begun and before authoritative jump starts;
- the observed input is late enough in recovery to exercise the M130 buffer path with scheduler margin;
- Chrome authority reports `attack-recovery → jump → idle`;
- Firefox independently reports the same sequence for Chrome;
- only one authoritative jump occurs while Space remains held;
- authoritative idle returns before the real Space keyup, proving held Space does not auto-repeat;
- the original light still resolves as one 34 HP hit with guard preserved;
- no parry outcome appears.

## Acceptance hook

`web/online-game.mjs` exposes `window.__MYASO_ACCEPTANCE_STATE__` only when the explicit `scenario=uijumpbuffer` query parameter is present.

The hook records action transitions from `networkClient.state`, which is authoritative replicated state. It does not observe local prediction and does not alter normal production UI behavior.

## Boundary

No combat constants, jump duration, stamina cost, attack timing, recovery timing, packet format, replication format, input cadence, damage, reach, movement speed, or production UI behavior changes.

M131 adds browser acceptance evidence only. The playable build is not opened.

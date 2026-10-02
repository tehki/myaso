# M133 — Real Recovery Kick Buffer

## Goal

Prove M132's late light-recovery kick buffer through a genuine short right-click gesture and independent Firefox replication of authoritative action state.

## Real-control choreography

1. Chrome performs one genuine LMB light attack.
2. Chrome's acceptance hook observes authoritative `attack-recovery`.
3. Chrome performs one real RMB tap late in that recovery.
4. The RMB release must remain below the existing 180 ms hold-to-run threshold.
5. Authority must finish recovery before entering `kick-windup`.
6. Firefox must independently replicate the same recovery-to-kick sequence.

The exact 90 ms buffer boundary and stamina-on-execution rule remain pinned by M132 deterministic browser and Rust tests.

## Acceptance

The flight fails closed unless:

- exactly one real RMB pointerdown and pointerup are observed;
- the short tap stays below 180 ms;
- RMB release occurs late in authoritative light recovery;
- authoritative kick begins only after the RMB release;
- Chrome authority reports `attack-recovery → kick-windup → kick-recovery → idle`;
- Firefox independently reports the same sequence for Chrome;
- only one kick windup occurs;
- no running-strike state appears;
- the original light remains one 34 HP exchange with guard preserved;
- no parry outcome appears.

## Acceptance hook

`window.__MYASO_ACCEPTANCE_STATE__` remains acceptance-only and is enabled for `scenario=uikickbuffer`.

## Boundary

No kick damage, reach, timing, stamina cost, knockdown, right-click run threshold, packet format, replication format, or production UI behavior changes.

M133 adds browser acceptance evidence only. The playable build is not opened.

# M128 — Light Recovery Roll Buffer

## Goal

Make wheel-forward movement feel responsive at the end of a committed light attack without turning roll into a recovery cancel.

## Rules

- buffer window: final **90 ms** of centered or directional light recovery
- only a **fresh wheel-forward press** can enter the buffer
- recovery always completes before the roll begins
- the normal **28 stamina** roll cost is paid when the queued roll actually begins
- a roll is not queued if the fighter cannot afford it when pressed
- an early held wheel-forward input is not promoted when the buffer window later opens
- the queued roll preserves the pointer-facing direction chosen at the wheel event
- continuing to move the pointer before recovery ends does not redirect that committed roll
- a later recovery-buffer input replaces earlier queued intent rather than stacking actions
- no attack, recovery, iframe, roll speed, collision knockdown, or network timing is shortened

## Edge semantics

Roll input is edge-triggered in the deterministic and authoritative combat kernels.
Holding the dodge bit through recovery cannot auto-roll when control returns; a new wheel-forward press is required.

## Acceptance

M128 proves in browser and authoritative simulation that:

- a fresh late wheel-forward waits through full light recovery
- stamina remains untouched while the roll is merely queued
- the roll starts at recovery completion and pays the normal stamina cost
- the pointer direction captured on press controls the committed roll
- an early held wheel-forward does not become a free roll
- a later roll intent can replace a previously buffered light attack
- existing M123/M124 attack and block buffers remain intact

No playable build is required for this milestone.

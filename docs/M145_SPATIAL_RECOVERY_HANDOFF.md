# M145 — Spatial recovery handoff in FFA

## Goal
Align the in-arena golden recovery ring with the same authoritative `PUNISH TARGET` selected by the M143/M144 HUD.

Before M145, every remote fighter in a recoverable action state painted a golden recovery ring. In simultaneous-recovery FFA this could show two spatial punish rings while the HUD correctly selected only one punish target.

M145 changes no combat constants and no authoritative combat behavior.
## Rendering contract
Each render frame resolves `fighterRecoveryNetId(state, ownId)` once. Only the remote entity whose network id matches that selected recovery target may paint `drawRecoveryTell()`.

Two-player recovery readability is unchanged because the sole recoverable opponent remains the selected target.

## Real-browser acceptance
M145 extends the deterministic three-client simultaneous-recovery choreography from M144. The M145 acceptance starts the jump chord about 100 ms after the light input so the unchanged recovery windows retain a stable observer-visible handoff interval:

- Chrome / #1: off-axis jump attacker on the left
- Firefox / #2: observer
- second Chrome / #3: closer off-axis light attacker on the right

The observer must still transition:

`NEAREST #3 -> PUNISH TARGET #3 -> PUNISH TARGET #1 -> NEAREST #3`

A browser-local target-change sampler scans only the arena canvas for the exact recovery-ring color `#efcf73`. During `PUNISH TARGET #3`, the ring centroid must be on the right side of the observer. After handoff to `PUNISH TARGET #1`, the centroid must move to the left side. Once both recoveries close, the arena must contain zero recovery-ring pixels.

This proves the spatial indicator follows the authoritative punish target rather than all recoverable fighters.

## Scope
Changes are limited to recovery-ring target selection, query-gated browser acceptance, CI wiring, and this document. The playable build is not opened.
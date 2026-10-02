# M135 — Jump Attack Input Chord

## Objective
Make the promised `Space + LMB` control reliable when both inputs arrive in the same simulation sample.

## Behavior
- A fresh simultaneous jump + light-attack edge from idle starts `JumpAttackWindup` directly.
- The action pays the normal jump stamina cost plus the normal jump-attack stamina cost.
- If the combined cost cannot be paid, the existing standalone jump fallback remains available when its cost can be paid.
- A simultaneous jump + light edge during the final 90 ms of light recovery is buffered as one jump-attack intent.
- Buffered jump attack waits for the current light recovery to finish before it starts or spends stamina.
- Existing later-in-air LMB conversion from `Jump` to `JumpAttackWindup` remains unchanged.

## Parity and boundaries
The deterministic JavaScript combat model and authoritative Rust simulation implement the same chord and recovery-buffer semantics.

No jump-attack reach, arc, damage, knockback, timing, jump duration, network packet, snapshot, replication, persistence, or deployment behavior changes.

## Acceptance
Regression coverage requires both kernels to prove same-sample jump attack and late-recovery buffered jump attack while preserving the existing narrow jump-attack cone and all prior combat behavior.

The shared M54/M57 and M55-M62 real-browser threat flights actively sample UI evidence while the short 135 ms windup / 80 ms strike phases are live. This keeps headless sessions scheduled without weakening any authoritative threat or pointer-provenance assertion.

The playable build is not opened for this milestone.

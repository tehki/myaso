# M130 — Light Recovery Jump Buffer

## Goal

Make Space feel responsive at the end of a committed light attack without turning jump into a recovery cancel or allowing held Space to auto-bunny-hop.

## Rules

- buffer window: final **90 ms** of centered or directional light recovery
- only a **fresh Space press** can enter the buffer
- light recovery always completes before jump begins
- the normal **14 stamina** jump cost is paid only when the queued jump actually begins
- a jump is not queued if the fighter cannot afford it when pressed
- an early held Space input is not promoted when the buffer window later opens
- holding Space after recovery does not automatically start a jump; release + fresh press is required
- a later recovery-buffer input replaces earlier queued intent rather than stacking actions
- existing attack, block, and pointer-directed roll buffers keep their current timing and behavior

## Edge semantics

Jump becomes edge-triggered in both deterministic and authoritative combat kernels. The authoritative M127 action-edge latch still preserves a real Space press across packet/simulation scheduling, but a sustained jump level is consumed only once.

This makes the input contract consistent with light attack and wheel-forward roll: **press intent is remembered; held state is not replayed as a new action**.

## Acceptance

M130 proves in browser and authoritative simulation that:

- a fresh late Space press remains queued until full light recovery completes
- stamina stays untouched while jump is only queued
- jump begins at recovery completion and charges exactly 14 stamina
- an early-held Space press cannot become a free recovery jump
- held Space cannot auto-repeat a jump after commitment ends
- a later jump intent can replace an earlier buffered light attack
- browser and authoritative kernels stay behaviorally aligned

## Acceptance harness stability

The M130 quality pass also exposed CI timing jitter in two pre-existing real-browser gates after the hosted Chrome/Firefox driver update:

- M37 now waits for the required authoritative opponent-recovery frame instead of sampling only the first post-hit render;
- M129 shortens its browser-owned wheel pause so the genuine wheel remains inside the already-observed authoritative recovery window despite newer WebDriver command overhead.

Both gates keep their original evidence requirements. These are acceptance-harness timing changes only; no combat behavior is relaxed or altered.
## Boundary

No attack timing, recovery timing, jump duration, jump movement multiplier, stamina cost, damage, reach, iframe, packet format, replication format, or production UI behavior changes.

The playable build is not opened.

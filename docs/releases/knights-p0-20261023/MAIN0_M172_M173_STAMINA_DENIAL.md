# M172/M173 stamina-denial investigation — 27 October 2026

Nonproduction fixture correction on existing Draft #1077. Starting source
`0792c3e5bcb77c9f41081128e1345d0ef823c44c`. No combat, stamina costs,
regeneration, network authority or browser confirmation semantics change.

## Preserved first failure

[Full quality job 122072717910](https://github.com/tehki/myaso/actions/runs/40469310815/job/122072717910)
failed its M173 step in the prerequisite M172 airborne conversion denial.
The original log is retained locally at
`.git/myaso-evidence/m147-missed-contact/M173-quality0792-first-red.log`.

Original browser evidence:

| Event | Epoch milliseconds | Evidence |
| --- | --- | --- |
| Space down/up | 1793088336216 / 1793088336262 | Genuine ordinary Jump |
| Replicated Jump | 1793088336324 | Action15, World tick525, stamina9 |
| LMB down/up | 1793088336377 / 1793088336419 | Trusted physical click |
| Denial queued | 1793088336378 | Baseline9 |
| Attack submitted | 1793088336393 | Client tick356 |
| Confirmation | 1793088336675 | Processed366, actionIdle, stamina12 |

The client correctly recorded `confirmed-not-stamina`: a stale9 baseline is
not permission to claim low stamina once the confirmed snapshot has12. The
physical click did occur during the observed Jump. The fixture allowed23
before Jump, leaving9 after its unchanged14 cost and insufficient headroom
for regeneration while confirmation waits for a fresh own snapshot. This is
an observed evidence-window failure, not evidence of a wrong World cost.

## Correction and strict gates

M172 now establishes14–19 using genuine run input, leaving at most5 after
Jump. Its prerequisite requires the latest observed action to remain Jump.
The already aimed pointer uses the existing genuine click helper with a positive5ms hold for down/up chronology,
removing an extra20ms sleep, redundant pointer move and40ms click hold.
M173 reuses the existing pre-aimed native chord helper. Its actual physical
Space/LMB gap must still be at most60ms.

Both scenarios retain submitted/processed acknowledgement ordering, current
authoritative stamina, no JumpAttack lifecycle, no unintended cost or damage,
both browser witnesses and the real UI message. M173 still requires original
World before/after proof of exactly14 stamina for its ordinary Jump. No
stale-baseline fallback, synthetic input, retry-to-green or relaxed threshold.

Regression tests execute the actual fixture setup and client confirmation
functions:23 is drained further; historical Jump followed byIdle is rejected;
9→12 delayed confirmation cannot show denial; an unprocessed input and an
accepted action cannot show denial. The dedicated three-trial workflow pins
the candidate SHA and preserves every native trace, including failures.

Qualification is pending exact-source native and full quality results. The
canonical source, independent Combat4D ownership and release HOLD remain.

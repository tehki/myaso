# M147 missed-contact investigation — 27 October 2026

Durable project engineering evidence. Existing Draft #1077, starting source
`2f9ab7329ff3abfcb8df6aae069374f4f8205341`. Nonproduction QA correction only;
no merge, deployment, damage, control, World or timing changes.

## Preserved first-red

[Job122057199302](https://github.com/tehki/myaso/actions/runs/40464699148/job/122057199302)
recorded actual original World victim1 Recovery2439→Idle2466, punisher2
LightWindup2451→Active2459→Recovery2464, **no HIT**, victim HP100. Genuine
Firefox LMB was recorded. This is not a late34HP hit and cannot qualify.

Original physical victim KeyD held492ms despite a requested210ms; its original
server ingress recorded one movement-bearing submission, whereas passing
trials recorded multiple submissions over different World ticks. That does
not prove actual displacement. The native failure dump was truncated around
65KB even in its preserved raw artifact; actor positions were not enabled for
this scenario, so exact historical contact geometry cannot be reconstructed
from that artifact. Do not claim a retrospectively proven exclusive cause.

Raw first-red logs and all three original trial artifacts were downloaded to
`.git/myaso-evidence/m147-missed-contact/`; original GitHub evidence is intact.

## Demonstrated setup defect and diagnostic checkpoint

The fixture inferred light reach from requested movement durations and the
ordinary NEAREST#3 focus label. A valid nearest#3 configuration can still leave
victim1 at original spawn42 and punisher2 at138:96 units apart, outside the
unchanged76+18=94 contact limit. A regression executes the real preflight guard
against that counterexample; this is not a claim that the historical miss had
those exact unrecorded positions.

Diagnostic commit `9f9aa99182a574eef52e47e0fcda8d86fc934005` enables the existing
read-only replicated-fighter witness for `uijumppunishffa`, adds a strict range
and ordering gate, and emits compact preflight/missed-contact summaries before
throwing. It adds no input writer or authority. Dedicated
[3/3](https://github.com/tehki/myaso/actions/runs/40467794635), standard M1472/2
and unchanged diagnostic repeat
[3/3](https://github.com/tehki/myaso/actions/runs/40468318643) passed. Observed
passing victim gaps were60–68 units, with genuine World HIT34 before recovery
exit. These positives did not reproduce or erase the original failure.

## Correction

Reuse the existing M121 replica-driven interior-range planner and bounded W3C
movement helper after the original genuine210ms D/260ms A approach. Read real
server replicas after every corrective pulse; never treat a requested duration
as movement evidence. Target the existing planner's72±4 gap, well inside94,
and require fresh advancing server snapshots with stable victim/punisher
positions. Limit corrections to eight; require310ms separation to avoid the
existing directional Dash double-tap. A stalled or invalid approach fails
before the single JumpAttack, with no retry after a resolved combat failure.

Retain the original closer-idle focus staging, pristine vitals, off-axis
trusted Space+LMB, physical punisher click,450ms recovery, actual intended
World HIT34/HP66 strictly before recovery exit, no other contacts, unaffected
peers, and focus/feedback convergence. Server simulation and combat parameters
are unchanged. The only client change exposes existing acceptance-only
replicated positions for this scenario.

## Validation before correction commit

- M147 plus reused M121 geometry regressions:39/39 PASS.
- Full Windows Node866/869 PASS; same three existing environment failures:
  unmodified Rust LF-sensitive assertion, OpenSSL and POSIX staging paths.
  No test skipped or semantic assertion weakened.
- Syntax, whitespace, policy and governance validators: PASS.
- Fresh immutable-head native M147/standard/full quality and independent
  Combat4D review remain required. Unit regressions are not human/WAN proof.

Rollback: reviewed revert of the two M147 work-unit commits to restore the
starting QA source. Canonical #1036 remains separate; global release remains
HOLD pending independent qualification and external acceptance.

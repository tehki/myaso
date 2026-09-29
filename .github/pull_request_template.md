## Objective

Describe the single coherent delivery objective.

## Work-unit contract

- Base/head/target:
- Behavior changed:
- Behavior preserved:
- Risk: LOW / MODERATE / HIGH / CRITICAL
- Minimum capabilities:
- Mutation boundary:
- Authorization state:
- Validation lane: FAST / FULL / RELEASE
- Rollback/recovery:
- Stop conditions:

## Validation

- [ ] Diff reviewed; only intended files/behavior changed
- [ ] Policy validation passed
- [ ] Repository-governance validation passed
- [ ] Focused checks passed
- [ ] FULL/RELEASE checks passed when required
- [ ] Security/retention/project-isolation invariants preserved
- [ ] Exact-head/target verified where required

## Governance

- [ ] No secret or project payload leaked into logs/artifacts
- [ ] No required control was weakened to make checks pass
- [ ] Provider-side controls are not claimed without verification
- [ ] Merge does not imply runtime activation/deployment
- [ ] Temporary exception, if any, is explicit, scoped, owned, expiring, and has a removal condition

# myaso.io Development Method

## North star

Deliver the smallest safe, clear, verifiable change that advances the product while preserving project isolation, least privilege, retention, recoverability, and repository governance.

## Work-unit contract

For every meaningful work unit establish once:

- project/repository and delivery objective;
- exact base/head/target where material;
- behavior to change and behavior to preserve;
- risk class: `LOW`, `MODERATE`, `HIGH`, or `CRITICAL`;
- minimum capabilities required;
- mutation boundary and authorization state;
- validation lane: `FAST`, `FULL`, or `RELEASE`;
- rollback/recovery;
- stop conditions.

Verified facts are reused until a validity input changes. Do not rediscover unchanged facts merely because a conversation turn changed.

## Default execution loop

1. Resolve repository, target, goal, and authority.
2. Snapshot only volatile state that matters.
3. Inspect the smallest authoritative implementation/test/config/policy surface.
4. Batch independent read-only work.
5. Design one coherent patch.
6. Reuse bounded authorization while project, target/head, scope, risk, capability, side-effect class, rollback assumptions, and exception state remain unchanged.
7. Review the diff before broad validation.
8. Validate the delta first: syntax → changed-file checks → focused tests → broader impacted tests.
9. Run FULL validation once on the final review head when required.
10. Review/merge only with exact-head governance evidence.
11. Treat runtime activation/deployment as a separate authorization boundary.
12. Close temporary exceptions/staging and record concise evidence.

## Work-unit sizing

Prefer one reviewable PR per coherent delivery objective, with small reversible commits inside it. Do not create micro-PR churn for tightly coupled changes. Split when objectives, project/confidentiality boundaries, privileged/destructive authority, rollback semantics, or reviewer decisions differ.

The highest risk contained in a work unit governs the entire work unit.

## Validation lanes

### FAST
Use for intermediate feedback where impact is known. It may select impacted deterministic checks but must retain global policy/governance/security basics.

### FULL
Required for the final ready-for-review head, security-sensitive changes, dependency/lockfile changes, CI/governance changes, HIGH/CRITICAL changes, and ambiguous impact.

### RELEASE
FULL plus packaging/distribution/provenance/release acceptance and bounded smoke/acceptance checks.

Unknown relevance falls back to FULL.

## Evidence reuse

A previous result may be reused only if relevant source/tree identity, dependency lock, toolchain/runtime, policy/governance version, configuration, test/build definition, environment class, and artifact identity are unchanged where material.

A source, policy, target, or relevant runtime change invalidates stale evidence.

## Stop conditions

Stop mutation and reassess if:

- authorized exact head/target changes;
- a required security invariant cannot be demonstrated;
- a required gate fails materially;
- risk becomes higher than authorized;
- project boundary becomes ambiguous;
- secret exposure is suspected;
- rollback assumptions become false;
- a destructive target cannot be re-verified;
- a required provider-side control is absent without an active exception;
- runtime/resource safety materially degrades.

## Status protocol

User-facing progress should report decision-relevant state, not every tool call:

- `DONE`
- `EVIDENCE`
- `BLOCKER` when present
- `NEXT`
- `AUTH NEEDED` only when a new authorization boundary is actually reached

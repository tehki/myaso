# myaso.io — Priority 0 GitHub Actions policy

Owner directive: **myaso.io is priority ZERO — highest among Moon Company
projects**. This is the intended infrastructure scheduling order. It must not
be misrepresented as GitHub's own job priority, since standard
`ubuntu-latest` hosted runners have **no numeric cross-repository priority
setting or preemption API**.

## Enforced today: latest-PR-wins queue hygiene

The required `.github/workflows/ci.yml` job remains `quality` on
`ubuntu-latest`, with the *full unchanged* Rust, JS and genuine
Chrome/Firefox acceptance suite. For any given pull request, a new commit
supersedes and cancels the older pending/running quality run. The latest
commit's full quality is still mandatory. Each `push` to protected `main`
gets a **separate per-SHA** concurrency group and is **never automatically
cancelled** (required merged-main release evidence).

This stops stale PR builds from occupying hosted runner capacity and has no
effect on other repositories' jobs, deploys, branch protection or secrets.

## Hardware / actual cross-project scheduling

At initial audit (19 October 2026):
- `tehki/myaso` has **zero repository self-hosted runners**;
  all required quality jobs target GitHub-hosted `ubuntu-latest`.
- Existing Windows **Machine** has 14 other repositories' GitHub runner
  services, four physical cores, 16 GiB RAM and less than 1 GiB free.
  Do **not** install myaso's intensive Linux/browser suite there or
  suspend those services as an undocumented side effect.
- Accessible Omarchy laptops run other important workloads and have
  insufficient unreserved RAM for an independently qualified dedicated
  runner. Do **not** put an unisolated self-hosted CI agent on their
  personal filesystems, or onto the live game VPS.
- This is a public repository: untrusted fork PR code on a self-hosted
  runner is a documented security risk.

**Real strict cross-repository Priority 0** requires separately reserved,
isolated Linux CI capacity (ephemeral VM/runner with owner-only trusted job
routing, 4+ cores and sufficient RAM), or supported GitHub-managed dedicated
capacity. Once available: register repo-only, restrict fork PRs to
GitHub-hosted runners, enforce a clean ephemeral runtime and exact existing
`quality` context, retain a safe hosted fallback and compare genuine
Chrome/Firefox results before cutover. Until then, P0 is a project priority
policy with **partial queue hygiene**, not a promise to jump ahead of other
GitHub-hosted repositories.

## Proof and release boundary

- The governor sentinel in `scripts/validate_repository_governance.py`
  checks the P0 workflow routing/cancellation contracts.
- Verify a second commit to the same PR cancels only its *older* attempt.
- Verify a protected `main` push still runs full `quality` to completion.
- Never cancel others' deployments or bypass `quality` to accelerate myaso.

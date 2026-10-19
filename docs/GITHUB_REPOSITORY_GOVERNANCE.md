# GitHub Repository Governance

`REPOSITORY_GOVERNANCE_v1.2.yaml` is the repository-specific governance manifest for `tehki/myaso`.

Required `main` state:

- pull requests required;
- direct pushes prohibited;
- force pushes prohibited;
- branch deletion prohibited;
- **no mandatory approving reviews** for the owner-authorized single-maintainer workflow (approval count = 0);
- CODEOWNERS still mark ownership and enable optional review, but CODEOWNER approval is not a merge gate;
- stale approvals dismissed;
- conversations resolved;
- branch up to date before merge;
- required `quality` status check;
- linear history.

The files in this repository are governance-as-code and do not prove that GitHub's provider-side branch/ruleset control plane is configured. Provider-side enforcement must be independently configured and verified. Until verified, do not claim remote branch protection is active.

Merge authorization, runtime activation authorization, and deployment authorization are separate by default.


## Owner-authorized single-maintainer policy (19 October 2026)

The project owner explicitly preauthorized ongoing commits and PR merges **without GitHub review**.
This changes only the reviewer requirement, not the release, security or CI boundary.
All merges must still use a pull request, pass the full required `quality` check,
use a current base and linear-history merge, resolve any discussion threads,
and preserve no-force-push/deletion protection. High-risk changes require
specific scope/risk/rollback verification; deployment is never implied by merge approval.

GitHub provider ruleset [#25404518](https://github.com/tehki/myaso/rules/25404518)
is scoped to `main` and was independently read back with
`required_approving_review_count=0`, `require_code_owner_review=false`,
and `quality` required with strict up-to-date enforcement.
A ruleset change is not proof of deployment authorization.

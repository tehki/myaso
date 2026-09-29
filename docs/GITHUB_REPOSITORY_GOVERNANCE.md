# GitHub Repository Governance

`REPOSITORY_GOVERNANCE_v1.2.yaml` is the repository-specific governance manifest for `tehki/myaso`.

Required `main` state:

- pull requests required;
- direct pushes prohibited;
- force pushes prohibited;
- branch deletion prohibited;
- at least one approval;
- CODEOWNER review for sensitive paths;
- stale approvals dismissed;
- conversations resolved;
- branch up to date before merge;
- required `quality` status check;
- linear history.

The files in this repository are governance-as-code and do not prove that GitHub's provider-side branch/ruleset control plane is configured. Provider-side enforcement must be independently configured and verified. Until verified, do not claim remote branch protection is active.

Merge authorization, runtime activation authorization, and deployment authorization are separate by default.

#!/usr/bin/env python3
"""Dependency-free sentinel checks for myaso.io repository governance."""
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
GOV = ROOT / "REPOSITORY_GOVERNANCE_v1.2.yaml"

REQUIRED = (
    "name: myaso-repository-governance",
    "version: '1.2'",
    "handbook_version: '1.6'",
    "constitution_version: '1.3'",
    "policy_version: '1.3'",
    "default_branch: main",
    "protection_required: true",
    "pull_request_required: true",
    "direct_push_allowed: false",
    "force_push_allowed: false",
    "branch_deletion_allowed: false",
    "required_approvals: 1",
    "require_code_owner_review: true",
    "- quality",
    "mixed_risk_batch_uses_highest_risk: true",
    "bounded_authorization_reuse_allowed: true",
    "merge_and_runtime_activation_separate_by_default: true",
    "full_validation_once_on_final_review_head_preferred: true",
    "full_gate_semantics_must_not_be_reduced: true",
    "branch_protection_or_ruleset_required: true",
    "never_claim_remote_branch_protection_without_verification: true",
)

FORBIDDEN_SOURCE_REPO_MARKERS = (
    "ai-automation-department-repository-governance",
    "/src/ai_automation_department/",
)

def main() -> int:
    text = GOV.read_text(encoding="utf-8")
    missing = [needle for needle in REQUIRED if needle not in text]
    forbidden = [needle for needle in FORBIDDEN_SOURCE_REPO_MARKERS if needle in text]
    if missing or forbidden:
        for needle in missing:
            print(f"missing required governance invariant: {needle}", file=sys.stderr)
        for needle in forbidden:
            print(f"source-repository marker leaked into myaso governance: {needle}", file=sys.stderr)
        return 1
    print("repository governance sentinel validation: PASS")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())

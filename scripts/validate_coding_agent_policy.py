#!/usr/bin/env python3
"""Dependency-free sentinel checks for the adopted Coding Agent Policy.

This is intentionally not a general YAML parser. It verifies the critical
cross-file invariants that must remain present in the reviewed policy bundle.
"""
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
POLICY = ROOT / "CODING_AGENT_POLICY_v1.3.yaml"

REQUIRED = (
    "version: '1.3'",
    "handbook_version: '1.6'",
    "constitution_version: '1.3'",
    "repository_governance_version: '1.2'",
    "default_mode: deny_by_default",
    "default_post_use_seconds: 10",
    "operational_metadata_default_days: 30",
    "deletion_failure_is_security_event: true",
    "cross_project_access_default: false",
    "full_validation_required_before_ready_merge_state: true",
    "merge_and_runtime_activation_separate_by_default: true",
    "remote_branch_protection_required: true",
    "required_status_check: quality",
    "custom_crypto_prohibited: true",
)

def main() -> int:
    text = POLICY.read_text(encoding="utf-8")
    missing = [needle for needle in REQUIRED if needle not in text]
    if missing:
        for needle in missing:
            print(f"missing required policy invariant: {needle}", file=sys.stderr)
        return 1
    print("coding-agent policy sentinel validation: PASS")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())

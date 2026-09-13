#!/usr/bin/env python3
"""Verify main-push parent continuity and GitHub commit verification.

Runs only for a GitHub Actions push to refs/heads/main.
"""
from pathlib import Path
import json
import os
import subprocess
import sys
import urllib.request

ZERO = "0" * 40

def fail(message: str) -> int:
    print(message, file=sys.stderr)
    return 1

def main() -> int:
    if os.getenv("GITHUB_EVENT_NAME") != "push" or os.getenv("GITHUB_REF") != "refs/heads/main":
        print("main-push provenance: not applicable")
        return 0

    event_path = os.getenv("GITHUB_EVENT_PATH")
    if not event_path:
        return fail("GITHUB_EVENT_PATH is unavailable")
    event = json.loads(Path(event_path).read_text(encoding="utf-8"))
    before = str(event.get("before", ""))
    after = str(event.get("after", ""))
    if not after or after == ZERO:
        return fail("main push has no live after commit")

    github_sha = os.getenv("GITHUB_SHA", "")
    if github_sha and github_sha != after:
        return fail(f"GITHUB_SHA mismatch: event={after} env={github_sha}")

    parents = subprocess.check_output(
        ["git", "rev-list", "--parents", "-n", "1", after],
        text=True,
    ).strip().split()[1:]

    if before and before != ZERO and before not in parents:
        return fail(f"previous main {before} is not a parent of {after}")

    repo = os.getenv("GITHUB_REPOSITORY")
    token = os.getenv("GITHUB_TOKEN")
    api = os.getenv("GITHUB_API_URL", "https://api.github.com")
    if not repo or not token:
        return fail("GitHub repository/token unavailable for signature verification")

    req = urllib.request.Request(
        f"{api}/repos/{repo}/commits/{after}",
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "myaso-governance-provenance-check",
        },
    )
    with urllib.request.urlopen(req, timeout=15) as response:
        payload = json.load(response)

    verification = payload.get("commit", {}).get("verification", {})
    if not verification.get("verified"):
        return fail(
            "GitHub commit verification failed: "
            f"reason={verification.get('reason', 'unknown')}"
        )

    print(f"main-push provenance: PASS {after}")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())

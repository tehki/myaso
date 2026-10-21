#!/usr/bin/env python3
"""P0 First Playable: inspect only active entrypoint dependency graphs.

This guard does not prove live multiplayer or account security. It prevents
research-only Economics artifacts from being imported into the player runtime
without an explicit, reviewed First Playable scope decision.
"""
from __future__ import annotations

import argparse
from pathlib import Path
import re

# Only files reachable from shipping entrypoints are inspected.
ENTRYPOINTS = (
    "server/src/lib.rs", "server/src/main.rs",
    "web/bootstrap.mjs", "web/online-game.mjs",
)
RUST_MOD = re.compile(r"(?m)^\s*(?:(?:pub(?:\([^\n)]*\))?)\s+)?mod\s+([A-Za-z_]\w*)\s*;")
JS_IMPORT = re.compile(
    r"\b(?:import|export)\s*(?:[^;\n]*?\bfrom\s*)?['\"](\.{1,2}/[^'\"\n]+)['\"]"
    r"|\bimport\s*\(\s*['\"](\.{1,2}/[^'\"\n]+)['\"]\s*\)"
)
# Narrow safety policy, not a ban on generic DB libraries or future Core work.
FORBIDDEN = re.compile(
    r"\b(?:mocmp|moon[_-]?coin|settle_test_purchase|e2j_lab|"
    r"economics_sqlite_lab|economics_core_gateway|"
    r"core_fixture_bindings|_test_only_server_authorizer|"
    r"wallet|purchase_intent|economy::|ledger::)\b",
    flags=re.IGNORECASE,
)
FORBIDDEN_PATH = re.compile(
    r"(?:^|/)(?:economics?[_\-/]|economics_e2j|moon[_-]?coin|wallet[_\-/])",
    flags=re.IGNORECASE,
)


def _relative_imports(src: str) -> tuple[str, ...]:
    return tuple(a or b for a, b in JS_IMPORT.findall(src))


def active_source_files(root: Path, entrypoints=ENTRYPOINTS) -> tuple[Path, ...]:
    """Walk literal local runtime imports only; test files stay excluded."""
    root = root.resolve()
    queue = [root / name for name in entrypoints]
    seen: set[Path] = set()
    while queue:
        file = queue.pop().resolve()
        if not file.is_relative_to(root):
            raise ValueError("Runtime dependency escapes repository: " + str(file))
        if file in seen:
            continue
        if not file.is_file():
            raise ValueError("Shipping runtime dependency is missing: " + str(file.relative_to(root)))
        seen.add(file)
        text = file.read_text(encoding="utf-8")
        if file.suffix == ".rs":
            for name in RUST_MOD.findall(text):
                parent = file.parent if file.name in {"lib.rs", "main.rs", "mod.rs"} else file.with_suffix("")
                choices = (parent / (name + ".rs"), parent / name / "mod.rs")
                for candidate in choices:
                    if candidate.is_file():
                        queue.append(candidate)
                        break
                else:
                    raise ValueError(f"Unresolved Rust module {name!r} in {file.relative_to(root)}")
        elif file.suffix in {".mjs", ".js"}:
            for relative in _relative_imports(text):
                dependency = (file.parent / relative).resolve()
                if dependency.suffix not in {".mjs", ".js"}:
                    continue
                queue.append(dependency)
    return tuple(sorted(seen))


def violations(root: Path, entrypoints=ENTRYPOINTS) -> list[str]:
    root = root.resolve()
    findings: list[str] = []
    for file in active_source_files(root, entrypoints):
        path = file.relative_to(root).as_posix()
        if FORBIDDEN_PATH.search(path):
            findings.append(f"{path}: research economy module on active runtime import graph")
        for number, line in enumerate(file.read_text(encoding="utf-8").splitlines(), 1):
            if FORBIDDEN.search(line):
                findings.append(f"{path}:{number}: optional economy reference in First Playable runtime")
    return findings


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    try:
        found = violations(args.root)
    except (ValueError, OSError, UnicodeError) as exc:
        print(f"FAIL: Alpha economy perimeter could not be verified: {exc}")
        return 1
    if found:
        for line in found:
            print("FAIL: " + line)
        return 1
    print("PASS: shipping Rust+browser runtime imports have no Economics prototype hooks")
    print("Note: this is a source-level tripwire; not multiplayer, security or deployment acceptance.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

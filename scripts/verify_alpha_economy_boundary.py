#!/usr/bin/env python3
"""P0 First Playable: inspect active browser + Rust import entrypoints.

This source-level tripwire does NOT prove live multiplayer or authentication.
It prevents known Economics research hooks from slipping into the active
First Playable browser or server module dependency graph.
"""
from __future__ import annotations

import argparse
from html.parser import HTMLParser
from pathlib import Path
import re
from urllib.parse import urlsplit

# Shipping HTML is the actual browser entrypoint: the Alpha lobby and combat
# page must both be checked, including the JS they themselves load.
ENTRYPOINTS = (
    "server/src/lib.rs", "server/src/main.rs",
    "web/index.html", "web/alpha.html",
)
RUST_MOD = re.compile(
    r"(?m)^\s*(?:(?:pub(?:\([^\n)]*\))?)\s+)?mod\s+([A-Za-z_]\w*)\s*;"
)
RUST_PATH_MOD = re.compile(
    r'(?m)^\s*#\s*\[\s*path\s*=\s*"([^"\n]+)"\s*\]\s*'
    r'(?:(?:pub(?:\([^\n)]*\))?)\s+)?mod\s+([A-Za-z_]\w*)\s*;'
)
JS_IMPORT = re.compile(
    r"\b(?:import|export)\s*(?:[^;\n]*?\bfrom\s*)?['\"]((?:\.{1,2}/|/)[^'\"\n]+)['\"]"
    r"|\bimport\s*\(\s*['\"]((?:\.{1,2}/|/)[^'\"\n]+)['\"]\s*\)"
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


class _HtmlScripts(HTMLParser):
    """Collect scripts served to players, not unrelated docs or test pages."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.sources: list[str] = []
        self.inline_scripts = 0

    def handle_starttag(self, tag: str, attrs):
        if tag.lower() != "script":
            return
        fields = dict(attrs)
        src = fields.get("src")
        if src:
            self.sources.append(src)
        else:
            # Inline executable script is outside this lightweight import
            # walker; fail closed so an owner explicitly reviews the change.
            self.inline_scripts += 1


def _local_path(root: Path, source: Path, specifier: str) -> Path:
    parsed = urlsplit(specifier)
    if parsed.scheme or parsed.netloc or not parsed.path:
        raise ValueError(f"Unreviewed external/empty runtime script in {source.relative_to(root)}")
    if parsed.path.startswith("/"):
        result = root / parsed.path.lstrip("/")
    else:
        result = source.parent / parsed.path
    return result.resolve()


def _relative_imports(src: str) -> tuple[str, ...]:
    return tuple(a or b for a, b in JS_IMPORT.findall(src))


def active_source_files(root: Path, entrypoints=ENTRYPOINTS) -> tuple[Path, ...]:
    """Walk literal local imports from served pages and Rust server roots."""
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
        source = file.read_text(encoding="utf-8")
        if file.suffix == ".html":
            parser = _HtmlScripts()
            parser.feed(source)
            if parser.inline_scripts:
                raise ValueError(f"Unreviewed inline runtime script in {file.relative_to(root)}")
            if not parser.sources:
                raise ValueError(f"No runtime scripts discovered in {file.relative_to(root)}")
            for spec in parser.sources:
                dependency = _local_path(root, file, spec)
                if dependency.suffix not in (".js", ".mjs"):
                    raise ValueError(f"Unreviewed non-JS runtime script in {file.relative_to(root)}")
                queue.append(dependency)
        elif file.suffix == ".rs":
            # Process explicit #[path = "..."] modules before regular mod;
            # without this a nonstandard Rust module could escape the graph.
            path_mods = RUST_PATH_MOD.findall(source)
            for relative, _name in path_mods:
                queue.append(_local_path(root, file, relative))
            source = RUST_PATH_MOD.sub("", source)
            for name in RUST_MOD.findall(source):
                parent = file.parent if file.name in {"lib.rs", "main.rs", "mod.rs"} else file.with_suffix("")
                candidates = (parent / (name + ".rs"), parent / name / "mod.rs")
                for candidate in candidates:
                    if candidate.is_file():
                        queue.append(candidate)
                        break
                else:
                    raise ValueError(f"Unresolved Rust module {name!r} in {file.relative_to(root)}")
        elif file.suffix in {".mjs", ".js"}:
            for spec in _relative_imports(source):
                dependency = _local_path(root, file, spec)
                if dependency.suffix in {".mjs", ".js"}:
                    queue.append(dependency)
                else:
                    raise ValueError(f"Unreviewed local import type in {file.relative_to(root)}: {spec}")
    return tuple(sorted(seen))


def violations(root: Path, entrypoints=ENTRYPOINTS) -> list[str]:
    root = root.resolve()
    findings: list[str] = []
    for file in active_source_files(root, entrypoints):
        path = file.relative_to(root).as_posix()
        if FORBIDDEN_PATH.search(path):
            findings.append(f"{path}: research economy module on active runtime import graph")
        if file.suffix not in {".html"}:
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
    print("PASS: Alpha lobby + combat browser imports and Rust runtime contain no Economics hooks")
    print("Scope: static local source entrypoints; not full security, networking or browser acceptance.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

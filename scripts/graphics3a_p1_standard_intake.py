#!/usr/bin/env python3
"""Read-only offline ZIP safety/provenance audit of owner-selected P1 source packs.

Does not download, extract, vendor, retarget, license-approve, or activate assets.
The final report always says HOLD. Use on publisher's original free Standard ZIP.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import re
import stat
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from zipfile import ZipFile, BadZipFile

PACKS = {
    "quaternius-base": ("Universal Base Characters[Standard].zip", "https://quaternius.itch.io/universal-base-characters"),
    "quaternius-outfits": ("Modular Character Outfits - Fantasy[Standard].zip", "https://quaternius.itch.io/modular-character-outfits-fantasy"),
    "quaternius-ual1": ("Universal Animation Library[Standard].zip", "https://quaternius.itch.io/universal-animation-library"),
    "quaternius-ual2": ("Universal Animation Library 2[Standard].zip", "https://quaternius.itch.io/universal-animation-library-2"),
    "kaykit-animations": ("Free 1.1", "https://kaylousberg.itch.io/kaykit-character-animations"),
}
MODELS = {".gltf", ".glb", ".fbx", ".obj", ".blend", ".dae"}
LICENSE_RE = re.compile(r"(?:^|/)(?:license|licence|copying|cc0)(?:[.\-_]|$)", re.I)
LIMIT_ENTRIES = 50_000
LIMIT_UNCOMPRESSED = 8 * 1024 ** 3


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as inp:
        for block in iter(lambda: inp.read(2 ** 20), b""):
            digest.update(block)
    return digest.hexdigest()


def audit(pack: str, archive: Path) -> dict:
    if pack not in PACKS:
        raise ValueError("Unapproved pack")
    if not archive.is_file():
        raise FileNotFoundError(archive)
    filename, official_url = PACKS[pack]
    digest = sha256_file(archive)
    extensions: Counter[str] = Counter()
    possible_licenses, models, warnings = [], [], []
    seen: set[str] = set()
    total_size = 0
    with ZipFile(archive) as source:
        entries = source.infolist()
        if len(entries) > LIMIT_ENTRIES:
            raise ValueError("Excessive archive entries")
        for entry in entries:
            raw = entry.filename.replace("\\", "/")
            path = PurePosixPath(raw)
            if (raw.startswith("/") or re.match(r"^[A-Za-z]:", raw)
                or ".." in path.parts
                or any(x == "" for x in raw.split("/")[:-1])
                or str(path) == "."):
                raise ValueError(f"Unsafe archive path: {entry.filename!r}")
            mode = (entry.external_attr >> 16) & 0xffff
            if stat.S_ISLNK(mode):
                raise ValueError(f"Symbolic link in archive: {raw}")
            if entry.is_dir():
                continue
            key = str(path).casefold()
            if key in seen:
                raise ValueError(f"Conflicting archive path: {raw}")
            seen.add(key)
            if entry.flag_bits & 1:
                raise ValueError(f"Encrypted file: {raw}")
            total_size += entry.file_size
            if total_size > LIMIT_UNCOMPRESSED:
                raise ValueError("Excessive expanded archive size")
            if (entry.file_size > 10 * 1024 ** 2 and entry.compress_size
                and entry.file_size / entry.compress_size > 2000):
                raise ValueError(f"Suspicious compression ratio: {raw}")
            suffix = path.suffix.lower()
            extensions[suffix or "[no extension]"] += 1
            if suffix in MODELS:
                models.append(str(path))
            if LICENSE_RE.search(str(path)) and entry.file_size <= 1024 ** 2:
                possible_licenses.append(str(path))
    if not models:
        warnings.append("No recognized 3D model/animation files; manually inspect package")
    if not possible_licenses:
        warnings.append("No embedded license file detected; preserve publisher license evidence")
    if archive.name != filename and not (pack == "kaykit-animations" and archive.suffix.lower() == ".zip"):
        warnings.append("Filename differs from publisher-listed free tier; verify archive/version")
    return {
        "project": "myaso.io Graphics 3A P1",
        "pack_id": pack,
        "official_source_url": official_url,
        "publisher_listed_free_filename": filename,
        "archive_name": archive.name,
        "archive_bytes": archive.stat().st_size,
        "archive_sha256": digest,
        "audited_at_utc": datetime.now(timezone.utc).isoformat(),
        "file_count": sum(extensions.values()),
        "expanded_bytes": total_size,
        "file_extensions": dict(sorted(extensions.items())),
        "model_candidate_count": len(models),
        "model_candidate_paths": models,
        "possible_license_paths": possible_licenses,
        "warnings": warnings,
        "release_status": "HOLD_NOT_IMPORTED",
        "limitations": "File metadata only; license text, author provenance, mesh/rigs, art and gameplay unverified",
        "required_gates": [
            "Inspect official archive license and documented CC0 provenance",
            "Inspect skeleton topology, textures and garments in Blender",
            "Retarget and render all eight facing rows at 160px source grid",
            "Check grounded 960x540 2- and 4-player Rust World Chrome/Firefox screenshots",
            "Art Director 3 and Main Orchestrator 0 independent GO",
        ],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pack", choices=tuple(PACKS), required=True)
    parser.add_argument("--zip", dest="archive", type=Path, required=True)
    parser.add_argument("--output", type=Path, help="Optional local JSON output; never extracts")
    args = parser.parse_args()
    try:
        output = audit(args.pack, args.archive)
    except (ValueError, FileNotFoundError, BadZipFile, OSError) as error:
        parser.exit(2, f"Graphics 3A intake rejected: {error}\n")
    json_text = json.dumps(output, indent=2, ensure_ascii=False) + "\n"
    if args.output:
        args.output.write_text(json_text, encoding="utf8")
    else:
        print(json_text, end="")


if __name__ == "__main__":
    main()

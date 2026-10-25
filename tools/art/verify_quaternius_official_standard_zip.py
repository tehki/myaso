#!/usr/bin/env python3
"""Audit creator-uploaded Quaternius Standard ZIP vs pinned community glTF mirror.

Read-only, never extracts untrusted ZIP paths, never copies creator material to
game runtime or declares a mirror official without bytewise evidence.
Run: python3 tools/art/verify_quaternius_official_standard_zip.py --zip path/to/medieval_village_megakitstandard.zip --report .artifacts/quaternius-official-source-audit.json
"""
from __future__ import annotations
import argparse
import hashlib
import json
import sys
from pathlib import Path, PurePosixPath
from zipfile import ZipFile, BadZipFile

ORIGINAL = "https://opengameart.org/sites/default/files/medieval_village_megakitstandard.zip"
PINNED_MIRROR = "21104b4045261c28fc312360841ed1a7b0ac8782"


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--zip", required=True)
    p.add_argument("--report", required=True)
    p.add_argument("--mirror", default="third_party/quaternius/medieval-village-megakit-standard/glTF")
    p.add_argument("--manifest", default="assets/environment/greyhaven/quaternius-standard-preview/manifest.json")
    args = p.parse_args()
    manifest = json.loads(Path(args.manifest).read_text(encoding="utf-8"))
    if (manifest["source"]["license"] != "CC0-1.0"
            or manifest["source"]["mirrorCommit"] != PINNED_MIRROR
            or manifest["source"]["mirroredArchiveByteParityVerified"] is not False):
        raise ValueError("unreviewed license, source commit or unsupported parity claim")
    report = {
        "publisherURL": "https://opengameart.org/content/medieval-village-megakit",
        "publisherArchive": ORIGINAL,
        "mirrorCommit": PINNED_MIRROR,
        "archiveSource": "creator-uploaded public OpenGameArt Standard",
        "licensedAs": "CC0-1.0",
        "completeAll176IdentityEstablished": False,
        "selectedModelIdentityEstablished": False,
        "standardArchiveAvailable": False,
        "sourceHash": None,
        "modelDiffs": [],
        "textureDiffs": [],
        "error": None,
    }
    success = False
    try:
        archive = Path(args.zip)
        if not archive.is_file():
            raise FileNotFoundError("creator Standard ZIP unavailable; DO NOT infer mirror equivalence")
        n = archive.stat().st_size
        if n < 30_000_000 or n > 350_000_000:
            raise ValueError(f"unexpected creator Standard ZIP size {n}")
        report["standardArchiveAvailable"] = True
        # Whole-archive hash identifies precisely which creator upload was checked.
        sha = hashlib.sha256()
        with archive.open("rb") as h:
            for chunk in iter(lambda: h.read(1024 * 1024), b""):
                sha.update(chunk)
        report["sourceHash"] = sha.hexdigest()
        with ZipFile(archive) as z:
            infos = [info for info in z.infolist() if not info.is_dir()]
            if len(infos) > 8000 or any(i.file_size > 50_000_000 for i in infos):
                raise ValueError("unexpected creator ZIP inventory/individual file size")
            index = {}
            for info in infos:
                name = PurePosixPath(info.filename.replace("\\", "/"))
                if ".." in name.parts or name.is_absolute():
                    raise ValueError("unsafe entry in source ZIP")
                index.setdefault(name.name, []).append(info)
            original_gltfs = {k: v for k, v in index.items() if k.endswith(".gltf")}
            report["archiveGltfCount"] = sum(len(v) for v in original_gltfs.values())
            mirror = Path(args.mirror)
            expected_models = sorted(p.name for p in mirror.glob("*.gltf"))
            if len(expected_models) != 176:
                raise ValueError("pinned community source no longer 176 glTF files")
            report["mirrorGltfCount"] = len(expected_models)
            selection = {name + ".gltf" for name in manifest["selection"]}
            report["selectedModels"] = sorted(selection)
            selected_ok = True
            complete_ok = report["archiveGltfCount"] == 176
            for name in expected_models:
                entries = original_gltfs.get(name, [])
                if len(entries) != 1:
                    report["modelDiffs"].append({"name":name,"reason":"original archive name absent or ambiguous"})
                    complete_ok = False
                    if name in selection:
                        selected_ok = False
                    continue
                original_bytes = z.read(entries[0])
                mirror_bytes = (mirror / name).read_bytes()
                if original_bytes != mirror_bytes:
                    report["modelDiffs"].append({
                        "name":name,
                        "originalSha256":digest(original_bytes),
                        "mirrorSha256":digest(mirror_bytes),
                        "reason":"bytes differ",
                    })
                    complete_ok = False
                    if name in selection:
                        selected_ok = False
                if name not in selection:
                    continue
                # Verify actual .bin geometry AND original source PNG maps.
                try:
                    gltf = json.loads(mirror_bytes)
                except ValueError as exc:
                    raise ValueError(f"selected original glTF not parseable {name}: {exc}")
                resources = [b["uri"] for b in gltf.get("buffers", [])]
                resources.extend(im["uri"] for im in gltf.get("images", []) if "uri" in im)
                for resource in resources:
                    filename = PurePosixPath(resource).name
                    if filename != resource or filename.startswith("."):
                        raise ValueError("unexpected external selected texture/buffer URI")
                    possibilities = index.get(filename, [])
                    if len(possibilities) != 1:
                        report["textureDiffs"].append({"name":filename,"reason":"absent or ambiguous"})
                        selected_ok = False
                        continue
                    original_resource = z.read(possibilities[0])
                    pinned_resource = (mirror / filename).read_bytes()
                    if original_resource != pinned_resource:
                        report["textureDiffs"].append({
                            "name":filename,"originalSha256":digest(original_resource),
                            "mirrorSha256":digest(pinned_resource),"reason":"bytes differ"})
                        selected_ok = False
            report["completeAll176IdentityEstablished"] = complete_ok
            report["selectedModelIdentityEstablished"] = selected_ok
            success = complete_ok and selected_ok
            if not success:
                report["error"] = "Official creator archive does not match pinned mirror; release blocked"
    except (OSError,ValueError,BadZipFile,KeyError) as exc:
        report["error"] = str(exc)
    report_path = Path(args.report)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report,indent=2)+"\n",encoding="utf-8")
    print("GRAPHICS3B_OFFICIAL_QUATERNIUS_STANDARD_" + ("BYTE_PARITY_PASS " if success else "HOLD ") +
          json.dumps({k:v for k,v in report.items() if k not in ("modelDiffs","textureDiffs")}))
    if report["modelDiffs"] or report["textureDiffs"]:
        print("GRAPHICS3B_OFFICIAL_SOURCE_MISMATCH_DETAILS "+
              json.dumps({"models":report["modelDiffs"][:7],"resources":report["textureDiffs"][:7]}))
    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())

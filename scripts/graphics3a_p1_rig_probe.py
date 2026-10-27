#!/usr/bin/env python3
"""Offline glTF/GLB humanoid skin/rest-pose compatibility probe.

Does not import, extract, vendor, or execute any third-party asset code.
Matching joint names alone are NOT proof that animation tracks can be assigned
directly: rest/bind transforms must be compared and visually qualified.
"""
from __future__ import annotations

import argparse
import json
import math
import struct
from pathlib import Path
from zipfile import ZipFile

MAX_JSON_BYTES = 64 * 1024 * 1024
DEFAULT_TRANSLATION = [0.0, 0.0, 0.0]
DEFAULT_ROTATION = [0.0, 0.0, 0.0, 1.0]
DEFAULT_SCALE = [1.0, 1.0, 1.0]


def read_model(archive: Path, suffix: str) -> dict:
    if not suffix.endswith((".gltf", ".glb")):
        raise ValueError("Only glTF/GLB JSON metadata may be inspected")
    with ZipFile(archive) as zipfile:
        matches = [n for n in zipfile.namelist() if n.endswith(suffix) and not n.endswith("/")]
        if len(matches) != 1:
            raise ValueError(f"Model suffix is not unique/present: {suffix!r}; matches={len(matches)}")
        info = zipfile.getinfo(matches[0])
        if info.file_size > MAX_JSON_BYTES:
            raise ValueError("Metadata source exceeds read-only limit")
        data = zipfile.read(matches[0])
    if matches[0].endswith(".glb"):
        if len(data) < 20 or data[:4] != b"glTF" or struct.unpack_from("<I", data, 4)[0] != 2:
            raise ValueError("Invalid binary glTF v2")
        declared = struct.unpack_from("<I", data, 8)[0]
        json_length, chunk_type = struct.unpack_from("<II", data, 12)
        if declared != len(data) or chunk_type != 0x4E4F534A or json_length > MAX_JSON_BYTES:
            raise ValueError("Invalid GLB JSON chunk")
        data = data[20:20 + json_length]
    return json.loads(data.decode("utf-8"))


def skin_nodes(document: dict) -> list[dict]:
    skins = document.get("skins", [])
    nodes = document.get("nodes", [])
    if len(skins) != 1 or not skins[0].get("joints"):
        raise ValueError("One nonempty humanoid skin required for this P1 comparison")
    joints = skins[0]["joints"]
    if len(joints) != len(set(joints)):
        raise ValueError("Duplicate skin joint indexes")
    if not all(isinstance(i, int) and 0 <= i < len(nodes) for i in joints):
        raise ValueError("Invalid skin index")
    names = [nodes[i].get("name") for i in joints]
    if not all(isinstance(n, str) and n for n in names) or len(set(names)) != len(names):
        raise ValueError("Missing or duplicate bone names")
    return [nodes[i] for i in joints]


def close_vec(a: list, b: list, tolerance: float) -> bool:
    return len(a) == len(b) and all(
        isinstance(x, (int, float)) and isinstance(y, (int, float))
        and math.isfinite(x) and math.isfinite(y) and abs(x - y) <= tolerance
        for x, y in zip(a, b)
    )


def compare(source: dict, candidate: dict, tolerance: float = 1e-5) -> dict:
    if not (1e-8 <= tolerance <= 1e-2):
        raise ValueError("Tolerance must be between 1e-8 and 1e-2")
    left, right = skin_nodes(source), skin_nodes(candidate)
    left_names = [node["name"] for node in left]
    right_names = [node["name"] for node in right]
    by_name = {node["name"]: node for node in right}
    changed, comparable, non_trs, problems = [], [], [], []
    for node in left:
        name = node["name"]
        other = by_name.get(name)
        if other is None:
            problems.append(name)
            continue
        if "matrix" in node or "matrix" in other:
            non_trs.append(name)
            continue
        translation = close_vec(node.get("translation", DEFAULT_TRANSLATION),
                                other.get("translation", DEFAULT_TRANSLATION), tolerance)
        scale = close_vec(node.get("scale", DEFAULT_SCALE), other.get("scale", DEFAULT_SCALE), tolerance)
        qa = node.get("rotation", DEFAULT_ROTATION)
        qb = other.get("rotation", DEFAULT_ROTATION)
        rotation = close_vec(qa, qb, tolerance) or close_vec(qa, [-v for v in qb], tolerance)
        comparable.append(name)
        if not (translation and rotation and scale):
            changed.append({"joint": name, "translation": not translation,
                            "rotation": not rotation, "scale": not scale})
    return {
        "source_joints": len(left),
        "candidate_joints": len(right),
        "same_joint_names_and_order": left_names == right_names,
        "missing_source_joints": problems,
        "candidate_extra_joints": [name for name in right_names if name not in set(left_names)],
        "compared_trs_joint_count": len(comparable),
        "non_trs_matrix_joint_names": non_trs,
        "different_rest_transform_count": len(changed),
        "different_rest_transform_examples": changed[:20],
        "needs_pose_aware_retarget_review": (
            left_names != right_names or bool(changed) or bool(non_trs)
        ),
        "release_status": "HOLD_OFFLINE_METADATA_ONLY",
        "limits": (
            "No inverse-bind matrix, bone hierarchy, skin deformation, animation "
            "sampling, clips, feet-grounding or Blender visual qualification performed"
        ),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--reference-zip", type=Path, required=True)
    parser.add_argument("--reference-model", required=True)
    parser.add_argument("--candidate-zip", type=Path, required=True)
    parser.add_argument("--candidate-model", required=True)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    source = read_model(args.reference_zip, args.reference_model)
    candidate = read_model(args.candidate_zip, args.candidate_model)
    report = compare(source, candidate)
    report["reference_model"] = args.reference_model
    report["candidate_model"] = args.candidate_model
    result = json.dumps(report, indent=2) + "\n"
    if args.output:
        args.output.write_text(result, encoding="utf-8")
    else:
        print(result, end="")


if __name__ == "__main__":
    main()

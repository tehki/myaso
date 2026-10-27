"""Read-only original Quaternius glTF role audit for new Graphics 3A owner gates.

This is a structural readiness diagnostic: it cannot establish that a source
body is visually undressed, that mesh boundaries are watertight, or that
armor can be swapped in multiplayer. It deliberately never returns GO.
"""
import json
from pathlib import Path
from zipfile import ZipFile


def audit_source_geometry(base_doc, outfit_doc):
    if not isinstance(base_doc, dict) or not isinstance(outfit_doc, dict):
        raise ValueError("Both source glTF JSON objects are required")
    base_nodes = base_doc.get("nodes")
    outfit_nodes = outfit_doc.get("nodes")
    if not isinstance(base_nodes, list) or not isinstance(outfit_nodes, list):
        raise ValueError("Both source glTF documents need node inventories")
    base_meshes = [
        n.get("name","") for n in base_nodes
        if isinstance(n,dict) and isinstance(n.get("mesh"),int)
    ]
    outfit_meshes = [
        n.get("name","") for n in outfit_nodes
        if isinstance(n,dict) and isinstance(n.get("mesh"),int)
    ]
    if not base_meshes or not outfit_meshes:
        raise ValueError("Missing original humanoid and/or outfit mesh nodes")
    base_names = {n.lower() for n in base_meshes if isinstance(n,str)}
    pieces = ("arms","body","legs","feet")
    separate_head = any(n in {"head","head_mesh","separable_head"} for n in base_names)
    combined_base = any(n in {"superhero_male","superhero_female"} for n in base_names)
    outfit_segments = tuple(
        piece for piece in pieces
        if any(isinstance(n,str) and n.lower().endswith("_peasant_"+piece)
               for n in outfit_meshes)
    )
    cut_caps = any("cut_cap" in n or "neck_cap" in n for n in base_names)
    return {
        "source_mesh_names": base_meshes,
        "outfit_mesh_names": outfit_meshes,
        "outfit_segment_roles_found": outfit_segments,
        "separate_head_source_mesh": separate_head,
        "combined_full_body_mesh": combined_base,
        "detached_neck_cap_source_mesh_found": cut_caps,
        # A glTF node inventory cannot prove an anatomically complete nude body
        # or independent armor equip/unequip, regardless of node names.
        "verified_unequipped_body": False,
        "verified_gear_swap": False,
        "verified_head_detachment": False,
        "needs_independent_mesh_visual_art_review": True,
        "status": "ART_HOLD_NO_PRODUCTION_ASSERTION",
    }


def inspect_private_originals(base_archive: Path, base_suffix: str, outfit_gltf: Path):
    if base_suffix not in ("Superhero_Male_FullBody.gltf",
                           "Superhero_Female_FullBody.gltf"):
        raise ValueError("Unapproved original Base Character model suffix")
    if not base_archive.is_file() or not outfit_gltf.is_file():
        raise FileNotFoundError("Required local original source input not found")
    with ZipFile(base_archive) as zip:
        members = [n for n in zip.namelist() if n.endswith(base_suffix)]
        if len(members) != 1:
            raise ValueError("Original Base Character GLTF source ambiguous")
        base = json.loads(zip.read(members[0]))
    outfit = json.loads(outfit_gltf.read_text(encoding="utf-8"))
    result = audit_source_geometry(base,outfit)
    result["approved_base_source_member"] = members[0]
    result["outfit_source_filename"] = outfit_gltf.name
    return result

#!/usr/bin/env python3
"""A2.15: read-only verification of original A3 footwear authoring labels.

This reports whether materials, named objects or vertex groups explicitly
separate an outsole. Foot/ToeBase skin weights are NOT shoe-sole segmentation.
No writes to GLB, animation, meshes, textures or scene occur.
"""
import argparse
import hashlib
import json
from collections import Counter
from pathlib import Path

import bpy

parser = argparse.ArgumentParser()
parser.add_argument("--source", type=Path, required=True)
parser.add_argument("--output", type=Path, required=True)
args = parser.parse_args(__import__("sys").argv[__import__("sys").argv.index("--")+1:])
assert args.source.is_file()
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.scene.render.fps = 60
bpy.ops.import_scene.gltf(filepath=str(args.source.resolve()))
mesh_rows = []
for obj in bpy.data.objects:
    if obj.type != "MESH":
        continue
    materials = [m.name if m else "(none)" for m in obj.data.materials]
    material_polygons = Counter()
    for poly in obj.data.polygons:
        material_polygons[materials[poly.material_index] if materials else "(none)"] += 1
    groups = [group.name for group in obj.vertex_groups]
    has_armature = any(mod.type == "ARMATURE" for mod in obj.modifiers)
    semantic_labels = [label for label in [obj.name, *materials, *groups]
                       if any(term in label.lower()
                              for term in ("outsole", "shoe", "boot", "heel", "sole"))]
    mesh_rows.append({
        "meshName": obj.name,
        "skinned": has_armature,
        "vertices": len(obj.data.vertices),
        "polygons": len(obj.data.polygons),
        "materials": materials,
        "polygonsByMaterial": dict(material_polygons),
        "footSkinGroups": [g for g in groups if "Foot" in g or "Toe" in g],
        "shoeOrSoleSemanticLabels": semantic_labels
    })
skinned = [row for row in mesh_rows if row["skinned"]]
assert len(skinned) == 1, "Unexpected number of original skinned meshes"
sole_labels = [label for row in skinned for label in row["shoeOrSoleSemanticLabels"]]
report = {
    "milestone": "Blood & Iron A2.15 first-party A3 footwear provenance audit",
    "blenderVersion": bpy.app.version_string,
    "sourceName": args.source.name,
    "sourceSHA256": hashlib.sha256(args.source.read_bytes()).hexdigest(),
    "meshInventory": mesh_rows,
    "skinnedMeshCount": len(skinned),
    "skinnedMaterialCount": len(skinned[0]["materials"]),
    "skinnedMeshPolygonCount": skinned[0]["polygons"],
    "hasDedicatedOutsoleLabel": bool(sole_labels),
    "materialBasedBootSoleIsolationSupported": False,
    "reason": ("No separately named outsole/boot material or vertex group. "
               "Foot skin groups exist, but are not an anatomical sole label.")
              if not sole_labels else "Labels need manual geometric validation",
    "authoritativeFloorKnown": False,
    "anatomicalSoleContactValidated": False,
    "a3TimingChanged": False,
    "spritePresentationScaleChanged": False,
    "originalGLBOrBlenderModified": False,
    "productionApproved": False
}
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(json.dumps(report, indent=2, sort_keys=True)+"\n", encoding="utf8")
print("A215_PROVENANCE="+json.dumps({
    "source":report["sourceName"],
    "skinnedPolygons":report["skinnedMeshPolygonCount"],
    "skinnedMaterials":report["skinnedMaterialCount"],
    "soleLabelExists":report["hasDedicatedOutsoleLabel"]
}, sort_keys=True))

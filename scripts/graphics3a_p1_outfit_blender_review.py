#!/usr/bin/env python3
"""Offline Blender-ready 8-way sprite visual probe, NOT an in-game renderer.

Stages only one original Quaternius free Standard outfit and its linked
textures from its private owner-approved ZIP. No external asset execution,
no Rust/Combat changes, no implicit retargeting and no release approval.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import math
import posixpath
import time
from pathlib import Path
from zipfile import ZipFile

ALLOWED = ("Male_Ranger", "Male_Peasant", "Female_Ranger", "Female_Peasant")


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def prepare_source(archive: Path, character: str, directory: Path) -> dict:
    if character not in ALLOWED:
        raise ValueError("Only the four actually downloaded free outfits are supported")
    expected = f"/Outfits/{character}.gltf"
    with ZipFile(archive) as source:
        choices = [name for name in source.namelist() if name.endswith(expected)]
        if len(choices) != 1:
            raise ValueError(f"Expected one official free outfit {expected}, got {len(choices)}")
        model = choices[0]
        obj = json.loads(source.read(model).decode("utf-8"))
        if len(obj.get("skins", [])) != 1 or not obj.get("meshes"):
            raise ValueError("Expected one skinned original outfit")
        refs = [item["uri"] for item in obj.get("buffers", []) + obj.get("images", [])
                if "uri" in item]
        relative = [posixpath.basename(model)] + refs
        if len(set(relative)) != len(relative):
            raise ValueError("Duplicate asset URI")
        for uri in relative:
            if (uri.startswith("/") or "\\" in uri or ":" in uri or "/" in uri
                or uri in (".", "..") or uri.startswith(".")):
                raise ValueError(f"Nonlocal/unsafe glTF asset URI {uri!r}")
        directory.mkdir(parents=True, exist_ok=True)
        files = []
        for uri in relative:
            entry = posixpath.join(posixpath.dirname(model), uri)
            if entry not in source.namelist():
                raise ValueError(f"Missing relative model/texture dependency {uri}")
            contents = source.read(entry)
            target = directory / uri
            if target.exists() and target.read_bytes() != contents:
                raise ValueError(f"Staged dependency has conflicting bytes: {target}")
            target.write_bytes(contents)
            files.append({"file": uri, "bytes": len(contents), "sha256": sha256(contents)})
    return {"character": character, "source_zip": archive.name,
            "model_path": str(directory / f"{character}.gltf"),
            "staged_local_source_files": files,
            "release_status": "HOLD_OFFLINE_VISUAL_REVIEW_ONLY"}


def render_eight(model_path: Path, output: Path, samples: int = 12) -> list[dict]:
    try:
        import bpy
        from mathutils import Vector
    except ImportError as exc:
        raise RuntimeError("Offline Blender Python (bpy) is not installed") from exc
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(model_path))
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    armatures = [obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE"]
    if not meshes or len(armatures) != 1:
        raise RuntimeError("Expected one authentic imported humanoid rig and nonempty meshes")
    corners = [obj.matrix_world @ Vector(v) for obj in meshes for v in obj.bound_box]
    left, right = [min(p[i] for p in corners) for i in range(3)], [max(p[i] for p in corners) for i in range(3)]
    center = Vector(((left[0] + right[0])/2, (left[1] + right[1])/2, left[2]))
    height = right[2] - left[2]
    if not 0.75 <= height <= 5.0:
        raise RuntimeError(f"Unexpected model height {height}m; do not rescale blindly")
    # Rotate the existing original rig/mesh assembly, not the camera, so
    # each facing receives identical screen-space camera/light placement.
    pivot = bpy.data.objects.new("Graphics3A_VisualRotationOnly", None)
    bpy.context.scene.collection.objects.link(pivot)
    for obj in list(bpy.context.scene.objects):
        if obj != pivot and obj.parent is None and obj.type in {"ARMATURE", "MESH", "EMPTY"}:
            world_matrix = obj.matrix_world.copy()
            obj.parent = pivot
            obj.matrix_world = world_matrix
    bpy.ops.mesh.primitive_plane_add(size=200, location=(center.x, center.y, left[2] - 0.015))
    ground = bpy.context.object
    ground.name = "review_ground_not_game_physics"
    mat = bpy.data.materials.new("review_mat_grey")
    mat.diffuse_color = (0.30, 0.32, 0.36, 1)
    ground.data.materials.append(mat)
    camera_data = bpy.data.cameras.new("Original 8-Row Comparison Camera")
    camera = bpy.data.objects.new("Original 8-Row Comparison Camera", camera_data)
    bpy.context.scene.collection.objects.link(camera)
    target = Vector((center.x, center.y, left[2] + height * 0.52))
    camera.location = target + Vector((0, -6, 5.0))
    direction = target - camera.location
    camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = max(height * 1.55, 2.7)
    bpy.context.scene.camera = camera
    for label, position, strength, size in [
        ("key", (3, -3, 7), 600, 4),
        ("fill", (-4, -2, 5), 350, 5),
        ("rim", (1, 4, 6), 450, 4),
    ]:
        light = bpy.data.lights.new(f"Review {label}", "AREA")
        light.energy = strength
        light.shape = "DISK"
        light.size = size
        ob = bpy.data.objects.new(f"Review {label}", light)
        bpy.context.scene.collection.objects.link(ob)
        ob.location = Vector((center.x, center.y, left[2])) + Vector(position)
        ob.rotation_euler = (target - ob.location).to_track_quat("-Z", "Y").to_euler()
    scene = bpy.context.scene
    world = bpy.data.worlds.new("neutral_reviewer_world")
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes.get("Background").inputs["Strength"].default_value = 0.8
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = samples
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.resolution_x = 160
    scene.render.resolution_y = 160
    scene.render.resolution_percentage = 100
    output.mkdir(parents=True, exist_ok=True)
    proofs = []
    for row in range(8):
        pivot.rotation_euler.z = row * math.pi / 4
        scene.render.filepath = str(output / f"rest_{row:02d}.png")
        start = time.monotonic()
        bpy.ops.render.render(write_still=True)
        data = Path(scene.render.filepath).read_bytes()
        if data[:8] != b"\x89PNG\r\n\x1a\n":
            raise RuntimeError("Blender output is not PNG")
        proofs.append({"direction_row": row, "png": str(scene.render.filepath),
                       "sha256": sha256(data), "bytes": len(data),
                       "offline_cpu_render_seconds": round(time.monotonic()-start, 3)})
    return proofs


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--outfits-zip", type=Path, required=True)
    parser.add_argument("--private-output", type=Path, required=True)
    parser.add_argument("--character", choices=ALLOWED, default="Male_Ranger")
    parser.add_argument("--prepare-only", action="store_true")
    parser.add_argument("--samples", type=int, default=12)
    args = parser.parse_args()
    if not 1 <= args.samples <= 128:
        parser.error("samples must be in [1,128]")
    result = prepare_source(args.outfits_zip, args.character,
                            args.private_output / "private_vendor_stage" / args.character)
    if not args.prepare_only:
        result["render_evidence"] = render_eight(
            Path(result["model_path"]), args.private_output / "render_frames" / args.character,
            samples=args.samples)
    result["note"] = "Not gameplay FPS or true eight-dir animation. Static source rest pose only."
    report = args.private_output / (args.character + "-offline-review.json")
    report.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"report": str(report), "status": result["release_status"],
                      "frames": len(result.get("render_evidence", []))}, indent=2))


if __name__ == "__main__":
    main()

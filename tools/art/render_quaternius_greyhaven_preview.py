#!/usr/bin/env python3
"""Graphics 3B: import TRUE Quaternius CC0 Standard glTF pieces into a review-only Blender house.

No World9 map, collision, Combat, items, Red Lion or real-game code is modified.
Usage: blender --background --threads 2 --python tools/art/render_quaternius_greyhaven_preview.py -- --manifest assets/environment/greyhaven/quaternius-standard-preview/manifest.json --source third_party/quaternius/medieval-village-megakit-standard/glTF --output .artifacts/quaternius-greyhaven
"""
import argparse
import hashlib
import json
import math
import os
import sys
from pathlib import Path

try:
    import bpy
    from mathutils import Vector
except ImportError as exc:
    raise SystemExit("Must execute with a real Blender Python runtime: " + str(exc))


def cli():
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--source", required=True)
    parser.add_argument("--output", required=True)
    return parser.parse_args(args)


def digest(path):
    sha = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            sha.update(block)
    return sha.hexdigest()


def light(name, position, energy, size, color):
    data = bpy.data.lights.new(name, "AREA")
    data.energy = energy
    data.shape = "DISK"
    data.size = size
    data.color = color
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = position
    obj.rotation_euler = (Vector((0, 0, 2.5)) - obj.location).to_track_quat("-Z", "Y").to_euler()
    return obj


def install_piece(name, location, yaw, source):
    model_path = source / (name + ".gltf")
    if not model_path.is_file():
        raise FileNotFoundError("Missing genuine free Standard glTF: " + str(model_path))
    present = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(model_path))
    imported = set(bpy.data.objects) - present
    meshes = [item for item in imported if item.type == "MESH"]
    if not meshes:
        raise ValueError(name + " did not import any source mesh")
    pivot = bpy.data.objects.new("QTRN_" + name, None)
    bpy.context.scene.collection.objects.link(pivot)
    for obj in imported:
        if obj.parent is not None and obj.parent in imported:
            continue
        world_matrix = obj.matrix_world.copy()
        obj.parent = pivot
        obj.matrix_world = world_matrix
    pivot.location = Vector(location)
    pivot.rotation_euler[2] = math.radians(yaw)
    return len(meshes), meshes


def mesh_world_bounds(meshes):
    """Imported ORIGINAL Quaternius mesh vertices, never surrogate geometry."""
    corners = []
    for item in meshes:
        corners.extend(item.matrix_world @ Vector(v) for v in item.bound_box)
    if not corners:
        raise ValueError("original imported mesh bounds absent")
    return {name: (min(v[i] for v in corners), max(v[i] for v in corners))
            for i, name in enumerate(("x", "y", "z"))}


def verify_actual_original_door_alignment(spec, imported):
    """Fail-closed on the genuine Blender world-space meshes, not manifest poses."""
    door_name, frame_name = spec["doorModel"], spec["frameModel"]
    if door_name not in imported or frame_name not in imported:
        raise ValueError("original Quaternius door or arched frame missing")
    door = mesh_world_bounds(imported[door_name])
    frame = mesh_world_bounds(imported[frame_name])
    center = lambda bounds, axis: sum(bounds[axis]) / 2.0
    horizontal = abs(center(door, "x") - center(frame, "x"))
    depth = abs(center(door, "y") - center(frame, "y"))
    bottom_gap = door["z"][0] - frame["z"][0]
    above = frame["z"][1] - door["z"][1]
    if horizontal > spec["maximumCenterOffsetMeters"]:
        raise ValueError("real Blender door offset from arched frame center: " + str(horizontal))
    if not 0 <= bottom_gap <= spec["maximumBottomOffsetMeters"]:
        raise ValueError("real door threshold floats or falls below frame: " + str(bottom_gap))
    if depth > spec["maximumDepthOffsetMeters"]:
        raise ValueError("real door leaf protrudes from frame plane: " + str(depth))
    if above < 0:
        raise ValueError("original door top penetrates arched frame")
    return {"verifiedGenuineImportedBlenderMeshes": True,
            "doorModel": door_name, "frameModel": frame_name,
            "doorXWorldCenter": center(door, "x"),
            "frameXWorldCenter": center(frame, "x"),
            "horizontalCenterOffsetMeters": horizontal,
            "depthCenterOffsetMeters": depth,
            "thresholdBottomOffsetMeters": bottom_gap,
            "frameTopClearanceMeters": above,
            "doorMeshWorldBounds": door,
            "frameMeshWorldBounds": frame,
            "unchangedOriginalMeshVertexData": True}


def apply_blood_iron_review_palette():
    """Non-destructive Blender-scene PBR color grade, preserving all original source files.

    Keep the source normal, roughness and base-color maps intact. A downstream
    artist can remove these named shader nodes to recover original Quaternius.
    """
    changed = 0
    for material in bpy.data.materials:
        if not material.name.startswith("MI_RoundTiles") or not material.use_nodes:
            continue
        nodes = material.node_tree.nodes
        bsdf = next((node for node in nodes if node.type == "BSDF_PRINCIPLED"), None)
        base_color = bsdf.inputs.get("Base Color") if bsdf else None
        if base_color is None:
            continue
        original_link = next(iter(base_color.links), None)
        grade = nodes.new("ShaderNodeHueSaturation")
        grade.name = "BloodIron_Roof_RedClay_ReviewOnly"
        grade.label = "Review only: muted/weathered red clay roof"
        grade.inputs["Hue"].default_value = 0.5
        grade.inputs["Saturation"].default_value = 0.62
        grade.inputs["Value"].default_value = 0.72
        grade.inputs["Fac"].default_value = 1.0
        grade.location = (bsdf.location.x - 240, bsdf.location.y - 40)
        grade.inputs["Color"].default_value = base_color.default_value
        if original_link is not None:
            original_node_output = original_link.from_socket
            material.node_tree.links.remove(original_link)
            material.node_tree.links.new(original_node_output, grade.inputs["Color"])
        material.node_tree.links.new(grade.outputs["Color"], base_color)
        changed += 1
    if changed == 0:
        raise ValueError("Quaternius imported roof tile PBR material not found; refuse proxy paint")
    return changed


def render_mood(scene, mood, output, key, fill, environment):
    key.data.energy = 1100 if mood == "day" else 500
    key.data.color = (1.0, 0.87, 0.70) if mood == "day" else (1.0, 0.52, 0.30)
    fill.data.energy = 550 if mood == "day" else 190
    fill.data.color = (0.56, 0.70, 1.0) if mood == "day" else (0.24, 0.37, 0.82)
    background = environment.node_tree.nodes.get("Background")
    background.inputs["Strength"].default_value = 0.55 if mood == "day" else 0.17
    background.inputs["Color"].default_value = (
        (0.45, 0.51, 0.57, 1) if mood == "day" else (0.14, 0.20, 0.35, 1)
    )
    output_file = output / ("greyhaven-quaternius-cottage-" + mood + ".png")
    scene.render.filepath = str(output_file)
    bpy.ops.render.render(write_still=True)
    if not output_file.is_file() or output_file.stat().st_size < 1000:
        raise RuntimeError("Blender did not produce genuine original-asset pixels")
    return {"name": output_file.name, "bytes": output_file.stat().st_size, "sha256": digest(output_file)}


def main():
    args = cli()
    source = Path(args.source).resolve()
    output = Path(args.output).resolve()
    manifest_path = Path(args.manifest).resolve()
    cfg = json.loads(manifest_path.read_text(encoding="utf-8"))
    if cfg["source"]["license"] != "CC0-1.0" or cfg["source"]["officialEdition"].split(" ")[0] != "Standard":
        raise ValueError("Only creator-approved free CC0 Standard glTF architecture is allowed")
    if cfg["scope"]["status"] != "artist-preview-only" or not cfg["scope"]["preserveOriginalRedLion"]:
        raise ValueError("Graphics3B artist-only scope and the original Red Lion must be preserved")
    if not (source / "Wall_Plaster_WoodGrid.gltf").is_file():
        raise FileNotFoundError("Initialize the pinned git submodule before Blender preview")
    output.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    pieces = cfg["sample"]["parts"]
    selected = set(cfg["selection"])
    counts = []
    imported = {}
    for part in pieces:
        if part["model"] not in selected:
            raise ValueError("Model outside the CC0 reviewed Standard selection: " + part["model"])
        count, meshes = install_piece(part["model"], part["at"], part["yawDeg"], source)
        counts.append(count)
        imported.setdefault(part["model"], []).extend(meshes)
    # Geometry evidence is measured in Blender WORLD coordinates after actual
    # original glTF import and parent transforms have been applied.
    door_alignment = verify_actual_original_door_alignment(
        cfg["sample"]["doorFrameAlignment"], imported)
    print("GRAPHICS3B_ORIGINAL_QUATERNIUS_REAL_DOOR_ALIGNMENT_PASS " +
          json.dumps(door_alignment, sort_keys=True))
    review_roof_materials = apply_blood_iron_review_palette()
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 24
    # Minimal Ubuntu Blender builds can lack OpenImageDenoiser.
    # Disable optional CPU denoising instead of changing the imported art.
    if hasattr(scene.cycles, "use_denoising"):
        scene.cycles.use_denoising = False
    if hasattr(bpy.context.view_layer.cycles, "use_denoising"):
        bpy.context.view_layer.cycles.use_denoising = False
    scene.render.resolution_x = 640
    scene.render.resolution_y = 640
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = True
    try:
        scene.view_settings.view_transform = "AgX"
    except TypeError:
        scene.view_settings.view_transform = "Filmic"
    world = bpy.data.worlds.new("MoonGames_Quaternius_Atmosphere")
    scene.world = world
    world.use_nodes = True
    camera_data = bpy.data.cameras.new("Greyhaven review camera (authoring only)")
    camera = bpy.data.objects.new("Greyhaven review camera", camera_data)
    scene.collection.objects.link(camera)
    camera.location = (9, -11, 10)
    camera.rotation_euler = (Vector((0, 0, 2.8)) - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = 12.8
    scene.camera = camera
    key = light("daylight / fire-amber key", (1, -7, 10), 1100, 6, (1, 0.87, 0.70))
    fill = light("blue-gray sky fill", (-6, 2, 7), 550, 7, (0.56, 0.70, 1))
    captures = [render_mood(scene, mood, output, key, fill, world) for mood in ("day", "dusk")]
    scene.render.filepath = ""
    blend_path = output / "greyhaven-quaternius-cottage-source.blend"
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
    report = {
        "status": "ORIGINAL_QUATERNIUS_FREE_STANDARD_BLENDER_ART_PREVIEW",
        "notProduction": True,
        "realSourceMeshes": sum(counts),
        "importedSourceModules": len(pieces),
        "sourceModels": sorted(selected),
        "allMeshesGenuineImportedGlTF": True,
        "allModelsFromPinnedCC0Standard": True,
        "authoritativeWorldCollisionOrPortalChanged": False,
        "originalRedLionOrRoofChanged": False,
        "originalWorld9CoordsUnchanged": True,
        "releasedBuilding": False,
        "captured": captures,
        "editableBlenderSource": blend_path.name,
        "sourceMirrorCommit": cfg["source"]["mirrorCommit"],
        "mirrorVerifiedByteIdenticalToOfficialArchive": False,
        "sourceLicense": cfg["source"]["license"],
        "doorFrameAlignment": door_alignment,
        "sourceTextureFilesOverwritten": False,
        "materialReview": {"roofMaterialNodesChanged": review_roof_materials,
          "roofSaturation": 0.62, "roofValue": 0.72,
          "newShaderGradeOnly": True, "sourcePBRImagesPreserved": True},
        "dayDuskMoodLightingDistinct": True,
        "cyclesSamplesPerFrame": 24,
    }
    (output / "quaternius-greyhaven-review-report.json").write_text(json.dumps(report, indent=2) + "\n")
    print("GRAPHICS3B_QUATERNIUS_ORIGINAL_STANDARD_BLENDER_PREVIEW_PASS " + json.dumps(report))


if __name__ == "__main__":
    main()

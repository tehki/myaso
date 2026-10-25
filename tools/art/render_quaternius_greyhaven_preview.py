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
    return len(meshes)


def render_mood(scene, mood, output, key, fill, environment):
    key.data.energy = 1100 if mood == "day" else 720
    key.data.color = (1.0, 0.87, 0.70) if mood == "day" else (1.0, 0.63, 0.36)
    fill.data.energy = 550 if mood == "day" else 390
    fill.data.color = (0.56, 0.70, 1.0) if mood == "day" else (0.32, 0.45, 0.85)
    background = environment.node_tree.nodes.get("Background")
    background.inputs["Strength"].default_value = 0.55 if mood == "day" else 0.27
    background.inputs["Color"].default_value = (
        (0.45, 0.51, 0.57, 1) if mood == "day" else (0.18, 0.23, 0.34, 1)
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
    for part in pieces:
        if part["model"] not in selected:
            raise ValueError("Model outside the CC0 reviewed Standard selection: " + part["model"])
        counts.append(install_piece(part["model"], part["at"], part["yawDeg"], source))
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 12
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
    }
    (output / "quaternius-greyhaven-review-report.json").write_text(json.dumps(report, indent=2) + "\n")
    print("GRAPHICS3B_QUATERNIUS_ORIGINAL_STANDARD_BLENDER_PREVIEW_PASS " + json.dumps(report))


if __name__ == "__main__":
    main()

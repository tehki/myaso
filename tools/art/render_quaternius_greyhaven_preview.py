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
        grade.inputs["Saturation"].default_value = 0.78
        grade.inputs["Value"].default_value = 0.70
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


def add_authored_gable_infill(imported, spec):
    """Physically close the attic aperture under the real CC0 Quaternius roof.

    Keep original CC0 meshes and PBR textures immutable. New geometry is an
    independent, editable Blender ART assembly using their source materials.
    """
    if (spec.get("treatment") != "plain-plaster-wall"
            or spec.get("noRoofSourceMeshEdits") is not True
            or spec.get("gameplayFootprintUnchanged") is not True):
        raise ValueError("refusing unapproved gable fill/roof source change")
    roof = imported.get("Roof_RoundTiles_4x4", [])
    front_window = imported.get("Wall_Plaster_Window_Wide_Round", [])
    front_door = imported.get("Wall_Plaster_Door_Round", [])
    if not roof or not front_window or not front_door:
        raise ValueError("source roof and both genuine Quaternius front walls required")
    wall_window = mesh_world_bounds(front_window)
    wall_door = mesh_world_bounds(front_door)
    roof_bounds = mesh_world_bounds(roof)
    base_z, apex_z = spec["bottomZ"], spec["apexZ"]
    x_half, front_y = spec["halfWidth"], spec["frontFaceY"]
    if not (2.90 <= base_z <= 3.20 and
            4.80 <= apex_z <= 5.70 and
            1.70 <= x_half <= 1.98 and
            -2.13 <= front_y <= -2.01):
        raise ValueError("gable triangle outside approved original front-wall envelope")
    if (abs(wall_window["z"][1] - wall_door["z"][1]) > 0.01
            or abs(base_z - wall_window["z"][1]) > 0.15):
        raise ValueError("gable base does not meet actual imported original wall crown")
    if (apex_z >= roof_bounds["z"][1] - 0.35 or
            x_half > max(abs(roof_bounds["x"][0]), abs(roof_bounds["x"][1]))):
        raise ValueError("gable infill not contained beneath the original source roof bounds")
    plaster = next((m for m in bpy.data.materials if m.name.startswith("MI_Plaster")), None)
    timber = next((m for m in bpy.data.materials if m.name.startswith("MI_WoodTrim")), None)
    if not plaster or not timber or not plaster.use_nodes or not timber.use_nodes:
        raise ValueError("original Quaternius plaster and timber PBR materials required")
    # The original MI_Plaster atlas expects source-authored UV coordinates.
    # Our new authored triangle has none, so applying it directly causes a
    # skewed/incorrect plaster texture. User chose a PLAIN wall instead.
    # Make a scene-local copy and leave the actual source material untouched.
    uniform_wall_color = spec.get("plainWallRGBA")
    if (not isinstance(uniform_wall_color, list) or len(uniform_wall_color) != 4
            or any(not isinstance(v, (float, int)) for v in uniform_wall_color)
            or not all(0.0 <= v <= 1.0 for v in uniform_wall_color)
            or uniform_wall_color[3] != 1.0):
        raise ValueError("plain plaster color must be validated opaque RGBA")
    flat = plaster.copy()
    flat.name = "BloodIron_Greyhaven_PlainGablePlaster_ReviewOnly"
    flat.use_nodes = True
    principled = next((node for node in flat.node_tree.nodes
                      if node.type == "BSDF_PRINCIPLED"), None)
    if principled is None:
        raise ValueError("original Quaternius plaster lacks a principled PBR shader")
    for input_name in ("Base Color", "Normal", "Roughness"):
        socket = principled.inputs.get(input_name)
        if socket is None:
            raise ValueError("missing original plaster PBR socket: " + input_name)
        for link in list(socket.links):
            flat.node_tree.links.remove(link)
    principled.inputs["Base Color"].default_value = tuple(uniform_wall_color)
    principled.inputs["Roughness"].default_value = 0.90
    principled.inputs["Normal"].default_value = (0.0, 0.0, 0.0)
    flat.diffuse_color = tuple(uniform_wall_color)
    if any(principled.inputs[key].is_linked
           for key in ("Base Color", "Normal", "Roughness")):
        raise ValueError("plain gable shader unexpectedly depends on textured UV")
    # Make the gable an actual double-sided 3D triangular prism, not a
    # billboard/image overlay or browser-side disguise of the roof aperture.
    depth = 0.09
    verts = [
        (-x_half, front_y, base_z), (x_half, front_y, base_z),
        (0.0, front_y, apex_z),
        (-x_half, front_y + depth, base_z), (x_half, front_y + depth, base_z),
        (0.0, front_y + depth, apex_z),
    ]
    faces = [(0, 2, 1), (3, 4, 5), (0, 1, 4, 3),
             (1, 2, 5, 4), (2, 0, 3, 5)]
    infill_data = bpy.data.meshes.new("BloodIron_Greyhaven_Gable_SourcePlasterMesh")
    infill_data.from_pydata(verts, [], faces)
    infill_data.update()
    infill_data.materials.append(flat)
    infill = bpy.data.objects.new("BloodIron_Greyhaven_RealGablePlaster_ReviewOnly", infill_data)
    bpy.context.scene.collection.objects.link(infill)

    def timber_brace(name, start, end, thickness):
        start, end = Vector(start), Vector(end)
        heading = end - start
        if heading.length < 0.3:
            raise ValueError("zero-length timber brace")
        bpy.ops.mesh.primitive_cube_add(size=1, location=(start + end) * 0.5)
        obj = bpy.context.object
        obj.name = name
        obj.dimensions = (thickness, thickness, heading.length)
        obj.rotation_euler = heading.to_track_quat("Z", "Y").to_euler()
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        obj.data.materials.append(timber)
        return obj

    # Deliberately set the narrow weathered timber *inside* the existing
    # original roof eaves, leaving the roof silhouette and original tiles intact.
    beam_y = front_y - 0.045
    beams = [
        timber_brace("BloodIron_Gable_TimberSill_ReviewOnly",
                     (-x_half, beam_y, base_z + 0.04),
                     (x_half, beam_y, base_z + 0.04), 0.12),
        timber_brace("BloodIron_Gable_TimberLeftRafter_ReviewOnly",
                     (-x_half + 0.10, beam_y, base_z + 0.08),
                     (0.0, beam_y, apex_z - 0.12), 0.10),
        timber_brace("BloodIron_Gable_TimberRightRafter_ReviewOnly",
                     (x_half - 0.10, beam_y, base_z + 0.08),
                     (0.0, beam_y, apex_z - 0.12), 0.10),
    ]
    # A solid building cannot have a zero-area attic fill.
    area = x_half * 2.0 * (apex_z - base_z) * 0.5
    if area < 2.0:
        raise ValueError("gable infill too small to close the roof aperture")
    proof = {"sourceRoofModel": "Roof_RoundTiles_4x4",
             "sourceFrontWalls": ["Wall_Plaster_Window_Wide_Round", "Wall_Plaster_Door_Round"],
             "sourcePlasterPBR": plaster.name, "sourceTimberPBR": timber.name,
             "plainGableMaterialName": flat.name,
             "plainPlasterWallRGBA": list(uniform_wall_color),
             "flatBaseColorUnlinked": not principled.inputs["Base Color"].is_linked,
             "flatNormalUnlinked": not principled.inputs["Normal"].is_linked,
             "flatRoughnessUnlinked": not principled.inputs["Roughness"].is_linked,
             "originalSourcePlasterMaterialUnchanged": True,
             "userRequestedPlainWall": True,
             "realBlender3DPrism": True,
             "newGableMeshName": infill.name,
             "worldVertices": [list(v) for v in verts],
             "frontFaceY": front_y, "bottomZ": base_z,
             "apexZ": apex_z, "halfWidth": x_half,
             "gableFaceAreaSquareMeters": area,
             "timberBraceCount": len(beams),
             "originalRoofAndWallMeshesUnchanged": True,
             "unchangedDoorGlassLightingAndSmoke": True,
             "world9PlacementUnchanged": True,
             "gameplayCollisionUnchanged": True}
    print("GRAPHICS3B_QUATERNIUS_REAL_BLENDER_GABLE_INFILL_PASS " +
          json.dumps(proof, sort_keys=True))
    return proof


def glass_world_bounds(meshes):
    """Locate actual glass polygons in source Quaternius imported meshes."""
    verts = []
    for obj in meshes:
        obj.data = obj.data.copy()  # REVIEW only; source glTF bytes remain immutable
        for polygon in obj.data.polygons:
            mat = obj.data.materials[polygon.material_index]
            if mat and mat.name.startswith("MI_WindowGlass"):
                for index in polygon.vertices:
                    verts.append(obj.matrix_world @ obj.data.vertices[index].co)
    if not verts:
        raise ValueError("source model has no genuine Quaternius glass polygons")
    return {axis: (min(v[i] for v in verts), max(v[i] for v in verts))
            for i, axis in enumerate(("x", "y", "z"))}


def prepare_original_glass_dusk_lighting(imported):
    """New Blender scene shaders only; do not edit any original source PBR texture."""
    targets = (("window", "Window_Wide_Round1", 26.0),
               ("door", "Door_1_Round", 12.0))
    proof, switches, lights = {}, [], []
    for kind, source_name, watts in targets:
        meshes = imported.get(source_name, [])
        if not meshes:
            raise ValueError("missing authentic source " + source_name)
        bounds = glass_world_bounds(meshes)
        center = {axis: sum(bounds[axis]) / 2.0 for axis in ("x", "y", "z")}
        changed = 0
        for obj in meshes:
            for index, original in enumerate(obj.data.materials):
                if original is None or not original.name.startswith("MI_WindowGlass"):
                    continue
                lit = original.copy()
                lit.name = "BloodIron_Dusk_" + kind + "_GenuineGlass_ReviewOnly"
                if not lit.use_nodes:
                    raise ValueError("source glass is not PBR-node based: " + kind)
                bsdf = next((n for n in lit.node_tree.nodes
                             if n.type == "BSDF_PRINCIPLED"), None)
                if bsdf is None:
                    raise ValueError("source Quaternius glass lacks Principled shader: " + kind)
                for channel, value in (
                    ("Base Color", (0.94, 0.38, 0.095, 1.0)),
                    ("Emission Color", (1.0, 0.34, 0.07, 1.0)),
                    ("Emission Strength", 2.0 if kind == "window" else 1.6),
                    ("Alpha", 1.0),
                ):
                    inp = bsdf.inputs.get(channel)
                    if inp is None:
                        raise ValueError("Blender Principled socket unavailable: " + channel)
                    for link in list(inp.links):
                        lit.node_tree.links.remove(link)
                    inp.default_value = value
                if hasattr(lit, "surface_render_method"):
                    lit.surface_render_method = "DITHERED"
                elif hasattr(lit, "blend_method"):
                    lit.blend_method = "OPAQUE"
                switches.append((obj, index, original, lit))
                changed += 1
        if changed < 1:
            raise ValueError("source glass material slot absent: " + kind)
        # Lighting is slightly *inside* the wall; the authentic glass emits
        # into the scene while nearby timber/plaster catches a soft warm tint.
        source_light = bpy.data.lights.new("BloodIron_Dusk_" + kind + "_light", "POINT")
        source_light.energy = watts
        source_light.color = (1.0, 0.47, 0.17)
        source_light.shadow_soft_size = 0.65 if kind == "window" else 0.35
        lamp = bpy.data.objects.new(source_light.name, source_light)
        bpy.context.scene.collection.objects.link(lamp)
        lamp.location = (center["x"], center["y"] + 0.09, center["z"])
        lights.append((lamp, watts))
        proof[kind] = {"originalSourceModel": source_name,
                       "genuineGlassBounds": bounds,
                       "genuineGlassMaterialSlots": changed,
                       "emissionColor": [1.0, 0.34, 0.07],
                       "warmLightWatts": watts}
    return switches, lights, proof


def prepare_chimney_smoke(imported):
    """Small author-time procedural smoke volumes, never runtime GPU emitters."""
    actual = imported.get("Prop_Chimney", [])
    if not actual:
        raise ValueError("missing genuine source chimney")
    bounds = mesh_world_bounds(actual)
    base_x = sum(bounds["x"]) / 2.0
    base_y = sum(bounds["y"]) / 2.0
    top_z = bounds["z"][1]
    if top_z < 4.0:
        raise ValueError("chimney smoke cannot anchor to invalid source chimney")
    material = bpy.data.materials.new("BloodIron_Review_ProceduralWarmGraySmoke")
    material.use_nodes = True
    nodes = material.node_tree.nodes
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    volume = nodes.new("ShaderNodeVolumePrincipled")
    volume.inputs["Color"].default_value = (0.60, 0.53, 0.48, 1)
    volume.inputs["Anisotropy"].default_value = 0.10
    # Unbroken homogeneous density would look like a cotton-ball sphere.
    # Blender-native 4D noise gives each original-geometry-anchored wisp a
    # genuinely different irregular density field, with transparent gaps.
    coords = nodes.new("ShaderNodeTexCoord")
    noise = nodes.new("ShaderNodeTexNoise")
    noise.noise_dimensions = "4D"
    noise.inputs["Scale"].default_value = 4.3
    noise.inputs["Detail"].default_value = 2.6
    noise.inputs["Roughness"].default_value = 0.62
    random = nodes.new("ShaderNodeObjectInfo")
    variation = nodes.new("ShaderNodeMath")
    variation.operation = "MULTIPLY"
    variation.inputs[1].default_value = 6.0
    colorramp = nodes.new("ShaderNodeValToRGB")
    colorramp.color_ramp.elements[0].position = 0.33
    colorramp.color_ramp.elements[0].color = (0.0, 0.0, 0.0, 1.0)
    colorramp.color_ramp.elements[1].position = 0.71
    colorramp.color_ramp.elements[1].color = (0.42, 0.42, 0.42, 1.0)
    links = material.node_tree.links
    links.new(coords.outputs["Generated"], noise.inputs["Vector"])
    links.new(random.outputs["Random"], variation.inputs[0])
    links.new(variation.outputs[0], noise.inputs["W"])
    links.new(noise.outputs["Fac"], colorramp.inputs["Fac"])
    links.new(colorramp.outputs["Color"], volume.inputs["Density"])
    links.new(volume.outputs["Volume"], output.inputs["Volume"])
    puff_list = []
    for i in range(6):
        height = 0.20 + 0.26 * i
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1.0,
            location=(base_x + 0.085*i, base_y + 0.035*i, top_z + height))
        puff = bpy.context.object
        puff.name = "BloodIron_Chimney_Smoke_ReviewOnly_" + str(i)
        puff.scale = (0.24 + 0.055*i, 0.26 + 0.057*i, 0.29 + 0.049*i)
        puff.data.materials.append(material)
        puff.hide_render = True
        puff_list.append(puff)
    # Separate tiny volumetric fill light makes authored smoke legible
    # against dark transparent game art without inventing an in-game emitter.
    smoke_lamp = bpy.data.lights.new("BloodIron_Dusk_ActualChimneySmokeFill", "POINT")
    smoke_lamp.energy = 0
    smoke_lamp.color = (1.0, 0.66, 0.46)
    smoke_lamp.shadow_soft_size = 0.85
    smoke_light = bpy.data.objects.new(smoke_lamp.name, smoke_lamp)
    bpy.context.scene.collection.objects.link(smoke_light)
    smoke_light.location = (base_x + 0.10, base_y - 0.18, top_z + 1.02)
    proof = {"anchorOriginalSourceModel": "Prop_Chimney",
             "actualSourceChimneyTopMeters": top_z,
             "actualSourceChimneyCenter": [base_x, base_y],
             "proceduralVolumePuffs": len(puff_list),
             "proceduralVolumeNoise4D": True,
             "renderVolumeDensityMax": 0.42,
             "duskSoftSmokeFillWatts": 46.0,
             "duskOnly": True, "animatedInGame": False,
             "sourceGLTFUnmodified": True}
    return puff_list, [(smoke_light, 46.0)], proof


def render_mood(scene, mood, output, key, fill, environment,
                glass_switches, interior_lights, smoke_objects):
    is_dusk = mood == "dusk"
    for obj, idx, original, lit in glass_switches:
        obj.data.materials[idx] = lit if is_dusk else original
    for lamp, watts in interior_lights:
        lamp.data.energy = watts if is_dusk else 0.0
    for puff in smoke_objects:
        puff.hide_render = not is_dusk
    key.data.energy = 1100 if mood == "day" else 500
    key.data.color = (1.0, 0.87, 0.70) if mood == "day" else (1.0, 0.52, 0.30)
    fill.data.energy = 420 if mood == "day" else 190
    fill.data.color = (0.82, 0.84, 0.86) if mood == "day" else (0.24, 0.37, 0.82)
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
    gable_proof = add_authored_gable_infill(imported, cfg["sample"]["gableInfill"])
    glass_switches, interior_lights, glass_proof = prepare_original_glass_dusk_lighting(imported)
    smoke_objects, smoke_lights, smoke_proof = prepare_chimney_smoke(imported)
    interior_lights.extend(smoke_lights)
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
    # Align the review camera to the original Greyhaven painted sprite:
    # elevated roof/facade balance, front gable foreshortened, slight side visibility.
    # This is isolated asset-bake framing; it never changes the live World9 camera.
    camera_cfg = cfg["sample"]["cameraReview"]
    if (camera_cfg.get("projection") != "ORTHO"
            or camera_cfg.get("liveWorld9CameraChanged") is not False
            or camera_cfg.get("position") != [3, -12, 17]
            or camera_cfg.get("target") != [0, 0, 2.8]
            or camera_cfg.get("orthoScale") != 12.8):
        raise ValueError("unapproved Greyhaven art camera; do not bake a new game camera")
    camera.location = Vector(camera_cfg["position"])
    camera_target = Vector(camera_cfg["target"])
    camera.rotation_euler = (camera_target - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera_data.type = camera_cfg["projection"]
    camera_data.ortho_scale = camera_cfg["orthoScale"]
    scene.camera = camera
    key = light("daylight / fire-amber key", (1, -7, 10), 1100, 6, (1, 0.87, 0.70))
    fill = light("blue-gray sky fill", (-6, 2, 7), 550, 7, (0.56, 0.70, 1))
    captures = [render_mood(scene, mood, output, key, fill, world,
                            glass_switches, interior_lights, smoke_objects)
                for mood in ("day", "dusk")]
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
        "gableInfill": gable_proof,
        "sourceTextureFilesOverwritten": False,
        "duskInteriorAndChimney": {
          "actualSourceGlassLighting": glass_proof,
          "actualSourceChimneySmoke": smoke_proof,
          "dayGlassMaterialAndLightsPreserved": True,
          "originalMeshesAndTexturesUnchanged": True,
          "blenderSceneOnly": True,
          "emittedDoorAndWindowGlassDuskOnly": True
        },
        "materialReview": {"roofMaterialNodesChanged": review_roof_materials,
          "roofHue": 0.5, "roofSaturation": 0.78, "roofValue": 0.70,
          "newShaderGradeOnly": True, "sourcePBRImagesPreserved": True},
        "dayDuskMoodLightingDistinct": True,
        "cameraReview": camera_cfg,
        "cyclesSamplesPerFrame": 24,
    }
    (output / "quaternius-greyhaven-review-report.json").write_text(json.dumps(report, indent=2) + "\n")
    print("GRAPHICS3B_QUATERNIUS_ORIGINAL_STANDARD_BLENDER_PREVIEW_PASS " + json.dumps(report))


if __name__ == "__main__":
    main()

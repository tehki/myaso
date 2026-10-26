#!/usr/bin/env python3
"""Graphics 3B: original Blacksmith Blender asset, CC0 Quaternius + authored forge.

Artist-only asset. No World9 building replacement, server collision, portals,
items, pickups, combat controls or public release. Blender is mandatory.
"""
import argparse
import hashlib
import json
import math
import sys
from pathlib import Path

try:
    import bpy
    from mathutils import Vector
except ImportError as exc:
    raise SystemExit("Real Blender and original glTF importer required") from exc


def cli():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--source", required=True)
    parser.add_argument("--output", required=True)
    return parser.parse_args(argv)


def sha256(path):
    h = hashlib.sha256()
    with path.open("rb") as src:
        for part in iter(lambda: src.read(1 << 20), b""):
            h.update(part)
    return h.hexdigest()


def pbr(name, base, metallic=0.0, roughness=0.8):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = next(node for node in mat.node_tree.nodes
                if node.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = (*base, 1)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    mat.diffuse_color = (*base, 1)
    return mat


def glow(name, color, strength):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    nodes.clear()
    out = nodes.new("ShaderNodeOutputMaterial")
    shader = nodes.new("ShaderNodeEmission")
    shader.inputs["Color"].default_value = (*color, 1)
    shader.inputs["Strength"].default_value = strength
    mat.node_tree.links.new(shader.outputs["Emission"], out.inputs["Surface"])
    return mat


def block(name, position, dimensions, mat, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=position)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        edge = obj.modifiers.new("Hand-built edge wear", "BEVEL")
        edge.width = bevel
        edge.segments = 2
        normals = obj.modifiers.new("Weighted metal and masonry normals", "WEIGHTED_NORMAL")
        normals.keep_sharp = True
    obj.data.materials.append(mat)
    return obj


def beam(name, start, end, radius, mat):
    s, e = Vector(start), Vector(end)
    vec = e - s
    if vec.length <= 0.04:
        raise ValueError("Artist-authored blacksmith tool has degenerate shaft")
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=radius, depth=vec.length,
                                        location=(s + e) / 2)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = vec.to_track_quat("Z", "Y").to_euler()
    obj.data.materials.append(mat)
    return obj


def sphere(name, xyz, radius, mat):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=radius, location=xyz)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    return obj


def source_meshes(name, at, yaw, source):
    original = source / (name + ".gltf")
    if not original.is_file():
        raise FileNotFoundError("Missing approved CC0 Standard source: " + str(original))
    previous = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(original))
    imported = set(bpy.data.objects) - previous
    meshes = [obj for obj in imported if obj.type == "MESH"]
    if not meshes or sum(len(obj.data.vertices) for obj in meshes) < 8:
        raise ValueError("No genuine imported source mesh: " + name)
    pivot = bpy.data.objects.new("Quaternius_Original_" + name, None)
    bpy.context.scene.collection.objects.link(pivot)
    for obj in imported:
        if obj.parent is not None and obj.parent in imported:
            continue
        world = obj.matrix_world.copy()
        obj.parent = pivot
        obj.matrix_world = world
    pivot.location = Vector(at)
    pivot.rotation_euler[2] = math.radians(yaw)
    return ({"model": name, "glTFsha256": sha256(original),
             "meshCount": len(meshes),
             "vertices": sum(len(obj.data.vertices) for obj in meshes)},
            meshes)


def mesh_world_bounds(objects):
    """Real evaluated-world oriented glTF/Blender geometry AABB, NOT authored guesses."""
    if not objects:
        raise ValueError("No genuine source/evaluated meshes to measure")
    bpy.context.view_layer.update()
    pts = [obj.matrix_world @ Vector(corner) for obj in objects if obj.type == "MESH"
           for corner in obj.bound_box]
    if not pts:
        raise ValueError("Empty actual world-space source mesh")
    return {axis: [min(p[i] for p in pts), max(p[i] for p in pts)]
            for i, axis in enumerate(("x", "y", "z"))}


def horizontal_clearance(first, second):
    dx = max(first["x"][0] - second["x"][1],
             second["x"][0] - first["x"][1], 0.0)
    dy = max(first["y"][0] - second["y"][1],
             second["y"][0] - first["y"][1], 0.0)
    return math.hypot(dx, dy)


def make_gable(name, y, sign, cfg, brick, timber):
    """A real double-sided closed 3D triangular brick infill under original tiled roof."""
    x = cfg["halfWidth"]
    bottom, apex = cfg["baseZ"], cfg["apexZ"]
    tip = apex + cfg["hiddenRoofOverlapZ"]
    depth = 0.095
    face_y = y
    inside_y = y + sign * depth
    verts = [(-x, face_y, bottom), (x, face_y, bottom),
             (0, face_y, tip),
             (-x, inside_y, bottom), (x, inside_y, bottom),
             (0, inside_y, tip)]
    faces = [(0, 2, 1), (3, 4, 5), (0, 1, 4, 3),
             (1, 2, 5, 4), (2, 0, 3, 5)]
    mesh = bpy.data.meshes.new(name + "_ActualTriangularPrism")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    mesh.materials.append(brick)
    obj = bpy.data.objects.new(name + "_CloseRoofWallGap", mesh)
    bpy.context.scene.collection.objects.link(obj)
    brace_y = face_y - sign * .035
    for edge, a, b in [
        ("sill", (-x, brace_y, bottom+.045), (x, brace_y, bottom+.045)),
        ("left-rafter", (-x+.12, brace_y, bottom+.10), (0, brace_y, apex-.18)),
        ("right-rafter", (x-.12, brace_y, bottom+.10), (0, brace_y, apex-.18))]:
        # Wood stays under and inside the existing original tiled roof; never edits it.
        start, end = Vector(a), Vector(b)
        direction = end - start
        bpy.ops.mesh.primitive_cube_add(size=1, location=(start+end)*.5)
        piece = bpy.context.object
        piece.name = name + "_RealOak_" + edge
        piece.dimensions = (.11, .11, direction.length)
        piece.rotation_euler = direction.to_track_quat("Z", "Y").to_euler()
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        piece.data.materials.append(timber)
    return obj


def repair_gables(cfg, original):
    """Verify real roof/wall geometry before authoring front AND back closures."""
    roof = mesh_world_bounds(original.get("Roof_RoundTiles_4x4", []))
    left = mesh_world_bounds(original.get("Wall_UnevenBrick_Door_Round", []))
    right = mesh_world_bounds(original.get("Wall_UnevenBrick_Window_Wide_Round", []))
    bottom, tip = cfg["baseZ"], cfg["apexZ"] + cfg["hiddenRoofOverlapZ"]
    if (not (3.00 <= bottom <= 3.20 and 5.25 <= tip <= 5.50)
            or not 1.75 <= cfg["halfWidth"] <= 1.95
            or abs(left["z"][1] - right["z"][1]) > .03
            or abs(bottom - left["z"][1]) > .17
            or roof["z"][1] <= tip + .27
            or roof["x"][0] > -cfg["halfWidth"]
            or roof["x"][1] < cfg["halfWidth"]):
        raise ValueError("Gable is not matched to actual imported Quaternius roof/wall")
    brick = pbr("Smith_Gable_RealWeatheredBrick",
                (0.295, 0.235, 0.192), roughness=.97)
    timber = pbr("Smith_Gable_RoughAgedTimber", (0.19, 0.115, 0.067), roughness=.9)
    front = make_gable("Smith_FrontGable", cfg["frontFaceY"], 1, cfg, brick, timber)
    rear = make_gable("Smith_RearGable", cfg["backFaceY"], -1, cfg, brick, timber)
    if front.type != "MESH" or rear.type != "MESH":
        raise ValueError("Real Blender gable triangular geometry missing")
    return {"frontGableActual3D": front.name, "rearGableActual3D": rear.name,
            "doubleSidedTriangleClosure": True, "realOriginalRoofBounds": roof,
            "realOriginalFrontWallBounds": [left, right],
            "roofSourceMeshUntouched": True,
            "trianglePeakBelowOriginalRoofMeters": roof["z"][1] - tip}


def make_original_glass_visible(original):
    """Use ACTUAL glTF glass, retaining original day material and scene-only dusk clone."""
    meshes = original.get("Window_Wide_Round1", [])
    if not meshes:
        raise ValueError("Blacksmith needs real source window panes")
    replacements = []
    for obj in meshes:
        # Clone mesh data only for this artist scene. Original source files untouched.
        obj.data = obj.data.copy()
        for i, mat in enumerate(obj.data.materials):
            if mat is None or not mat.name.startswith("MI_WindowGlass"):
                continue
            lit = mat.copy()
            lit.name = "Smith_OriginalGlass_AmberDusk_SceneOnly"
            if not lit.use_nodes:
                raise ValueError("Original Quaternius window glass is not PBR")
            bsdf = next((n for n in lit.node_tree.nodes
                         if n.type == "BSDF_PRINCIPLED"), None)
            if not bsdf:
                raise ValueError("No actual original Quaternius glass shader")
            for channel, value in (
                ("Base Color", (.95, .47, .16, 1)),
                ("Emission Color", (1., .36, .08, 1)),
                ("Emission Strength", 1.7),
                ("Alpha", 1.)):
                socket = bsdf.inputs.get(channel)
                if socket is None:
                    raise ValueError("Original glass lacks " + channel)
                for link in list(socket.links):
                    lit.node_tree.links.remove(link)
                socket.default_value = value
            replacements.append((obj, i, mat, lit))
    if not replacements:
        raise ValueError("Original Quaternius transparent window glass missing")
    data = bpy.data.lights.new("Smith_RealGlazedWindow_IndoorDuskGlow", "POINT")
    data.energy = 0
    data.color = (1., .49, .18)
    data.shadow_soft_size = .62
    lamp = bpy.data.objects.new(data.name, data)
    bpy.context.scene.collection.objects.link(lamp)
    lamp.location = (1., -1.81, 1.49)
    return replacements, lamp


def forge_and_tools(cfg):
    if cfg.get("excludeItemsAndEquipmentAuthority") is not True or cfg.get("fireCosmeticOnly") is not True:
        raise ValueError("Blacksmith asset may never grant equipment, swords or gameplay fire")
    fx, fy = cfg["forgeX"], cfg["forgeY"]
    ax, ay = cfg["anvilX"], cfg["anvilY"]
    if not (3.20 <= fx <= 3.70 and -4.35 <= fy <= -3.85
            and 1.35 <= ax <= 1.70 and -4.35 <= ay <= -3.85):
        raise ValueError("Blacksmith r2 forge/anvil cannot return beneath original roof")
    separation = math.hypot(fx-ax, fy-ay)
    if separation > 2.2 or separation < 1.50:
        raise ValueError("Anvil must stand at a workable distance beside the forge")
    stone = pbr("BloodIron_Forge_RoughMasonry", (0.28, 0.26, 0.23))
    stone_top = pbr("BloodIron_Forge_SootedStone", (0.115, 0.105, 0.095))
    iron = pbr("BloodIron_HandForged_Iron", (0.115, 0.13, 0.14), metallic=0.85, roughness=0.52)
    wood = pbr("BloodIron_AgedOak", (0.23, 0.125, 0.067), roughness=0.91)
    charcoal = pbr("BloodIron_Charcoal", (0.052, 0.043, 0.038))
    ember = glow("BloodIron_HotEmbers", (1.0, 0.22, 0.024), 3.0)
    fire = glow("BloodIron_ForgeFlame", (1.0, 0.43, 0.055), 7.0)

    # Distinct, physically modeled stone forge, not a flattened painting.
    # The yard and forge do not correspond to an authoritative map coordinate.
    block("Smith_ForgingYard_StoneApron", (.45, -3.92, -0.10),
          (9.7, 2.8, .18), stone, .07)
    for dx, dz, length in [(-0.68, .28, 1.9), (0.68, .28, 1.9),
                           (-0.68, .77, 1.9), (0.68, .77, 1.9)]:
        block("Smith_Forge_ActualStoneCourse", (fx+dx, fy+.30, dz),
              (.43, length, .40), stone, .045)
    block("Smith_Forge_RecessedCharcoalHearth", (fx, fy+.28, .72),
          (1.9, 1.45, .20), stone_top, .04)
    block("Smith_Forge_HeatHood_Back", (fx, fy+.88, 1.53),
          (2.1, .30, 1.40), stone, .06)
    block("Smith_Forge_ActualChimneyStack", (fx, fy+.94, 2.47),
          (.95, .72, 1.1), stone_top, .045)

    # Original hand-authored anvil: horn, hardy-face, waist, foot.
    block("Smith_Anvil_HeavyIronFoot", (ax, ay, .17), (.81, .45, .28), iron, .065)
    block("Smith_Anvil_Waist", (ax, ay, .43), (.31, .25, .43), iron, .035)
    block("Smith_Anvil_ProperTop", (ax, ay, .71), (.72, .36, .17), iron, .035)
    bpy.ops.mesh.primitive_cone_add(vertices=16, radius1=.185, radius2=.015,
                                     depth=.62,
                                     location=(ax+.57, ay, .715),
                                     rotation=(0, math.pi/2, 0))
    horn = bpy.context.object
    horn.name = "Smith_Anvil_TaperedIronHorn"
    horn.data.materials.append(iron)

    # Smith's tool chest, genuine three-dimensional tongs and hammer.
    bx, by = cfg["toolbenchX"], cfg["toolbenchY"]
    if abs(bx + 2.) > .01 or abs(by + 4.04) > .01:
        raise ValueError("Blacksmith r2 toolbench must be clear of creator crate")
    block("Smith_Toolbench_Oak", (bx, by, .74), (1.25, .62, .15), wood, .04)
    for dx in (-.42, .42):
        for dy in (-.20, .20):
            block("Smith_Toolbench_Leg", (bx+dx, by+dy, .34),
                  (.095, .095, .68), wood, .01)
    beam("Smith_Hammer_OakHandle", (bx-.18, by+.05, .96),
         (bx+.40, by+.10, 1.02), .043, wood)
    block("Smith_Hammer_Hammerhead", (bx+.42, by+.10, 1.03),
          (.19, .35, .16), iron, .023)
    beam("Smith_Tongs_LeftIronArm", (bx-.34, by-.12, .85),
         (bx+.23, by-.22, .88), .017, iron)
    beam("Smith_Tongs_RightIronArm", (bx-.34, by-.12, .85),
         (bx+.21, by+.06, .88), .017, iron)
    block("Smith_IronBillet_OnAnvil", (ax-.04, ay-.03, .86),
          (.35, .12, .08), iron, .015)

    # Distinct visible hearth, low-poly native Blender geometry with actual
    # emission material and lights. No game item, hitbox or particle emitter.
    count = cfg["ashCount"]
    if not isinstance(count, int) or count != 6:
        raise ValueError("Invalid approved static forge ember count")
    for i in range(count):
        dx = (i % 3 - 1)*.29
        dy = (i // 3 - .5)*.29
        sphere("Smith_Hearth_GlowingEmber", (fx+dx, fy+.2+dy, .88),
               .09, ember if i % 2 else charcoal)
    for i, height in enumerate((.36, .47, .27)):
        bpy.ops.mesh.primitive_cone_add(vertices=10, radius1=.16,
                                         radius2=.012, depth=height,
                                         location=(fx+(i-1)*.29, fy+.2, .92+height/2))
        flame = bpy.context.object
        flame.name = "Smith_Hearth_OriginalBlenderFire_" + str(i)
        flame.data.materials.append(fire)
    light_data = bpy.data.lights.new("Smith_Forge_WarmEmberPractical", "POINT")
    light_data.energy = 115
    light_data.color = (1, .35, .095)
    light_data.shadow_soft_size = .4
    lamp = bpy.data.objects.new(light_data.name, light_data)
    bpy.context.scene.collection.objects.link(lamp)
    lamp.location = (fx, fy+.3, 1.4)

    return {"originalAuthoredAnvil": True, "anvilMetalWorkpieces": 4,
            "originalAuthoredForge": True, "originalAuthoredHammerAndTongs": True,
            "staticEmberCount": count, "cosmeticForgeHeat": True,
            "anvilForgeCenterDistanceMeters": separation,
            "serverItemsGranted": False, "serverCollisionModified": False,
            "world9ReplacementAuthorized": False}, lamp


def audit_artist_intersections(original, cfg):
    """Fail hard on actual imported roof/forge and original box/tool overlap."""
    roof = mesh_world_bounds(original["Roof_RoundTiles_4x4"])
    forge = mesh_world_bounds([o for o in bpy.data.objects
                               if o.type == "MESH" and o.name.startswith("Smith_Forge_")])
    crate = mesh_world_bounds(original["Prop_Crate"])
    hammer = mesh_world_bounds([o for o in bpy.data.objects
                                if o.type == "MESH" and o.name.startswith("Smith_Hammer_")])
    bench = mesh_world_bounds([o for o in bpy.data.objects
                               if o.type == "MESH" and o.name.startswith("Smith_Toolbench_")])
    roof_gap = horizontal_clearance(roof, forge)
    crate_hammer_gap = horizontal_clearance(crate, hammer)
    crate_bench_gap = horizontal_clearance(crate, bench)
    if roof_gap < cfg["minimumForgeRoofAabbClearanceMeters"]:
        raise ValueError("ACTUAL source roof intersects forge/hood/stack: " + str(roof_gap))
    if min(crate_hammer_gap, crate_bench_gap) < cfg["minimumCrateWorkbenchAabbClearanceMeters"]:
        raise ValueError("ACTUAL original creator crate still intersects bench or hammer")
    return {"actualImportedRoofBounds": roof,
            "originalCreatorCrateBounds": crate,
            "blenderForgeBounds": forge,
            "roofVsForgeClearanceMeters": roof_gap,
            "crateVsHammerClearanceMeters": crate_hammer_gap,
            "crateVsWorkbenchClearanceMeters": crate_bench_gap,
            "usingActualEvaluatedWorldMeshBounds": True,
            "noForgeRoofIntersection": True, "noCreatorBoxToolIntersection": True}


def area_light(name, pos, target, watts, size, color):
    data = bpy.data.lights.new(name, "AREA")
    data.energy = watts
    data.shape = "DISK"
    data.size = size
    data.color = color
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = Vector(pos)
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()
    return obj


def run():
    args = cli()
    manifest = Path(args.manifest).resolve()
    source = Path(args.source).resolve()
    output = Path(args.output).resolve()
    cfg = json.loads(manifest.read_text(encoding="utf-8"))
    if cfg.get("schema") != 1 or cfg.get("license") != "CC0-1.0" or \
            cfg.get("sourceCommit") != "21104b4045261c28fc312360841ed1a7b0ac8782" or \
            cfg.get("reviewOnly") is not True or cfg.get("authoritativePlacementApproved") is not False or \
            cfg.get("gameplayChanges") is not False:
        raise ValueError("Missing CC0 source or no-authority Blacksmith authoring contract")
    world = cfg["worldReference"]
    if (world.get("mapId") != "moonvale-overworld" or world.get("candidateAuthoredId") != "smith"
            or [world.get(k) for k in ("x", "y", "w", "h")] != [3710, 3850, 182, 162]):
        raise ValueError("Historical World9 Blacksmith reference drifted; do not invent placement")
    cam = cfg["camera"]
    if cam.get("kind") != "ORTHO" or cam.get("originalRuntimeCameraUnchanged") is not True:
        raise ValueError("Blacksmith review cannot replace game camera")
    parts = cfg["parts"]
    selected = set(cfg["modelSelection"])
    if len(parts) != 15 or len(selected) != 11:
        raise ValueError("Unexpected corrected original-source Blacksmith assembly")
    correction = cfg["geometryCorrection"]
    if not (correction.get("requestedByOwner") is True
            and correction.get("requiresActualSourceDoor") is True
            and correction.get("requiresActualSourceWindowShutters") is True
            and correction.get("includesOriginalSourceGlassDuskLighting") is True
            and correction.get("worldRuntimeUnchanged") is True):
        raise ValueError("Missing owner-requested real Blender architectural repairs")
    output.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)

    genuine = []
    original = {}
    for part in parts:
        if part["model"] not in selected:
            raise ValueError("Unlicensed or unreviewed source model " + part["model"])
        report, meshes = source_meshes(part["model"], part["at"], part["yawDeg"], source)
        genuine.append(report)
        original.setdefault(part["model"], []).extend(meshes)
    if sum(p["vertices"] for p in genuine) < 100:
        raise ValueError("Authentic source geometry missing")
    if not original.get("Door_1_Round") or not original.get("WindowShutters_Wide_Round_Open"):
        raise ValueError("Actual imported wooden door and open window shutters required")
    gable_report = repair_gables(correction["gables"], original)
    glass_switches, window_lamp = make_original_glass_visible(original)
    authored, furnace = forge_and_tools(cfg["authoredDetails"])
    intersection_report = audit_artist_intersections(original, correction)
    print("GRAPHICS3B_BLACKSMITH_ACTUAL_3D_CLEARANCE_PASS " +
          json.dumps({"roofForgeMeters": intersection_report["roofVsForgeClearanceMeters"],
                      "crateHammerMeters": intersection_report["crateVsHammerClearanceMeters"],
                      "crateBenchMeters": intersection_report["crateVsWorkbenchClearanceMeters"],
                      "realGables": 2, "originalDoorAndWindowShutters": True},
                     sort_keys=True))
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 24
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

    sky = bpy.data.worlds.new("BloodIron_Greyhaven_Blacksmith_ArtOnly")
    sky.use_nodes = True
    scene.world = sky
    camera_data = bpy.data.cameras.new("Blacksmith Orthographic review-only")
    camera = bpy.data.objects.new("Blacksmith review Camera", camera_data)
    scene.collection.objects.link(camera)
    camera.location = Vector(cam["position"])
    camera.rotation_euler = (Vector(cam["target"]) - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera_data.type = cam["kind"]
    camera_data.ortho_scale = cam["orthoScale"]
    scene.camera = camera
    key = area_light("Warm Daylight", (1, -7, 10), (0, -1, 2), 1100, 6, (1, .84, .68))
    fill = area_light("Blue Sky Fill", (-6, 2, 8), (0, -1, 2), 440, 7, (.67, .76, 1))

    captures = []
    for mood in ("day", "dusk"):
        is_dusk = mood == "dusk"
        for obj, slot, original_material, lit_material in glass_switches:
            obj.data.materials[slot] = lit_material if is_dusk else original_material
        window_lamp.data.energy = 42 if is_dusk else 0.
        key.data.energy = 1100 if mood == "day" else 330
        fill.data.energy = 440 if mood == "day" else 175
        furnace.data.energy = 115 if mood == "day" else 245
        bg = sky.node_tree.nodes.get("Background")
        bg.inputs["Strength"].default_value = .58 if mood == "day" else .16
        bg.inputs["Color"].default_value = (
            (.46, .50, .56, 1) if mood == "day" else (.12, .18, .28, 1))
        render_path = output / cfg["output"][mood]
        scene.render.filepath = str(render_path)
        bpy.ops.render.render(write_still=True)
        if not render_path.is_file() or render_path.stat().st_size < 1000:
            raise RuntimeError("Genuine original-geometry Blender frame missing: " + mood)
        captures.append({"mood": mood, "name": render_path.name, "sha256": sha256(render_path),
                         "bytes": render_path.stat().st_size})
    scene.render.filepath = ""
    blend = output / cfg["output"]["sourceBlend"]
    bpy.ops.wm.save_as_mainfile(filepath=str(blend))
    if blend.stat().st_size < 1000:
        raise RuntimeError("Editable original Blacksmith Blender source missing")

    report = {"kind": "graphics3b-original-blacksmith-p1-review",
              "sourceLicense": "CC0-1.0", "pinnedSourceCommit": cfg["sourceCommit"],
              "realImportedModuleCount": len(genuine),
              "realImportedVertexCount": sum(g["vertices"] for g in genuine),
              "genuineOriginalGlTF": genuine,
              "artistAuthoredParts": authored,
              "ownerRequestedBlenderGeometryFix": {
                  "realGables": gable_report,
                  "actualCollisionFreeGeometry": intersection_report,
                  "authenticDoorMeshCount": len(original["Door_1_Round"]),
                  "authenticWindowShutterMeshCount": len(original["WindowShutters_Wide_Round_Open"]),
                  "authenticWindowGlassMaterialSlots": len(glass_switches),
                  "originalRealGlazingWithDuskOnlyLight": True,
                  "anvilCloserToForge": True,
                  "forgeRoofAndToolCrateNonintersectionChecked": True,
                  "ownerVisualAcceptanceStillRequired": True},
              "captured": captures,
              "sourceBlendSha256": sha256(blend),
              "originalCottagePreserved": True, "originalRedLionPreserved": True,
              "world9ExistingBlacksmithIdForReviewOnly": "smith",
              "sourceOnly": True, "placedInRuntime": False,
              "productionAuthorized": False, "actualNetworkOrPortalsChanged": False,
              "goreImplementationAdded": False, "originalGameCameraChanged": False}
    (output / cfg["output"]["report"]).write_text(
        json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print("GRAPHICS3B_ORIGINAL_QUATERNIUS_BLACKSMITH_BLENDER_SOURCE_PASS " +
          json.dumps({"sourceModules": len(genuine), "vertexCount": report["realImportedVertexCount"],
                      "captured": captures, "sourceBlendSha256": report["sourceBlendSha256"],
                      "gameplayRuntimeUnchanged": True}, sort_keys=True))


if __name__ == "__main__":
    run()

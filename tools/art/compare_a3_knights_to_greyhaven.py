#!/usr/bin/env python3
"""A2 visual QA: combine ORIGINAL owner's A3 GLBs with the reviewed Greyhaven Blender scene.

Never modifies the A3 source .blend or .glb. Does not alter game physics, sprite
logic, browser runtime, authoritative positions or project asset licensing.
Both model GLBs and the combined output .blend remain on the workstation.
Only reviewed, non-redistributable stills and a numerical comparison report
may be attached to the art PR.

blender --background --python tools/art/compare_a3_knights_to_greyhaven.py -- \
  --scene /path/blood_iron_greyhaven_a2.blend --silver /path/silver-knight-roll-A3.glb \
  --sentinel /path/t1-sentinel-roll-A3.glb --out-dir /tmp/a2-review --render
"""
import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

args_from_cli = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
parser = argparse.ArgumentParser()
parser.add_argument("--scene", type=Path, required=True)
parser.add_argument("--silver", type=Path, required=True)
parser.add_argument("--sentinel", type=Path, required=True)
parser.add_argument("--out-dir", type=Path, required=True)
parser.add_argument("--render", action="store_true")
parser.add_argument("--samples", type=int, default=4)
parser.add_argument("--roll-frame", type=int, default=5)  # Blender 4.5 glTF roll range 0.4–8.8
args = parser.parse_args(args_from_cli)
assert all(path.is_file() for path in (args.scene, args.silver, args.sentinel))
args.out_dir.mkdir(parents=True, exist_ok=True)

# Rebuild review from clean baseline rather than repeatedly importing copies.
bpy.ops.wm.open_mainfile(filepath=str(args.scene.resolve()))
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = max(4, min(args.samples, 32))
scene.render.resolution_x = 1120
scene.render.resolution_y = 720
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.frame_set(1)
camera = bpy.data.objects.get("A2 / Red Lion hero / 3-4 angle")
assert camera and camera.type == "CAMERA", "A2 Red Lion scene camera missing"
scene.camera = camera
camera.data.ortho_scale = 14.4

# Source GLBs use distinct unit origins; match at the real mesh-feet bounds,
# rather than moving the armature's origin or changing the animation keys.
def is_proxy(ob):
    # The supplied GLBs both include a 42-vertex, untextured Icosphere
    # (2 m bounding diameter). It is NOT the skinned knight body and must
    # not determine fighter scale, floor contact or review renders.
    return (ob.type == "MESH" and ob.name.startswith("Icosphere")
            and len(ob.data.vertices) <= 64
            and not any(ob.data.materials))

def bounds(objects):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    points = []
    for ob in objects:
        if ob.type != "MESH" or is_proxy(ob):
            continue
        ev = ob.evaluated_get(depsgraph)
        mesh = ev.to_mesh()
        try:
            points.extend(ev.matrix_world @ v.co for v in mesh.vertices)
        finally:
            ev.to_mesh_clear()
    assert points, "Imported A3 model has no skinned meshes"
    return {
        "mins": [min(v[i] for v in points) for i in range(3)],
        "maxs": [max(v[i] for v in points) for i in range(3)],
    }

def load_character(label, source, world_xy, target_height_m):
    old = set(scene.objects)
    old_actions = set(bpy.data.actions)
    bpy.ops.import_scene.gltf(filepath=str(source.resolve()))
    imported = [o for o in scene.objects if o not in old]
    assert imported and any(o.type == "ARMATURE" for o in imported), (
        f"{label} lacks expected owner-authored 22-bone Mixamo rig"
    )
    rigs = [o for o in imported if o.type == "ARMATURE"]
    assert sum(len(r.data.bones) for r in rigs) >= 22, label
    proxies = [ob for ob in imported if is_proxy(ob)]
    assert len(proxies) == 1, f"{label}: expected one non-character Icosphere proxy"
    for ob in proxies:
        ob.hide_render = True
        ob.hide_set(True)
    new_actions = [a for a in bpy.data.actions if a not in old_actions]
    idle = next((a for a in new_actions if a.name == "idle"
                 or a.name.startswith("idle.")), None)
    roll = next((a for a in new_actions if a.name == "roll"
                 or a.name.startswith("roll.")), None)
    assert idle is not None and roll is not None, f"{label}: missing idle/roll clips"
    assert roll.frame_range[0] <= args.roll_frame <= roll.frame_range[1], (
        f"{label}: roll preview frame outside approved animation clip"
    )
    for rig in rigs:
        if rig.animation_data is None:
            rig.animation_data_create()
        # Imported NLA tracks can otherwise play death instead of idle.
        for track in rig.animation_data.nla_tracks:
            track.mute = True
        rig.animation_data.action = idle
    scene.frame_set(1)
    before = bounds(imported)
    width = before["maxs"][0]-before["mins"][0]
    depth = before["maxs"][1]-before["mins"][1]
    height = before["maxs"][2]-before["mins"][2]
    assert .25 <= height <= 10 and math.isfinite(height), (
        f"{label}: unexpected mesh bounds {before}"
    )
    scale = target_height_m / height
    cx = (before["mins"][0]+before["maxs"][0])/2
    cy = (before["mins"][1]+before["maxs"][1])/2
    dz = before["mins"][2]
    world_transform = (Matrix.Translation(Vector((world_xy[0],world_xy[1],0))) @
        Matrix.Scale(scale, 4) @ Matrix.Translation(Vector((-cx,-cy,-dz))))
    roots = [o for o in imported if o.parent is None or o.parent not in imported]
    assert roots
    for root in roots:
        root.matrix_world = world_transform @ root.matrix_world
    bpy.context.view_layer.update()
    after = bounds(imported)
    floor_z = after["mins"][2]
    assert abs(floor_z) < 1e-3, f"{label}: incorrect feet alignment: {floor_z}"
    assert abs(after["maxs"][2]-target_height_m) < 1e-3
    for ob in imported:
        ob["a2_preview_only"] = True
    return {
        "name": label,
        "source": source.name,
        "importedObjects": len(imported),
        "rigBoneCount": sum(len(r.data.bones) for r in rigs),
        "originalMeshHeightMeters": round(height, 5),
        "originalMeshWidthMeters": round(width, 5),
        "originalMeshDepthMeters": round(depth, 5),
        "nonAuthoritativeVisualScale": round(scale, 5),
        "reviewHeightMeters": target_height_m,
        "feetZ": round(floor_z, 6),
        "worldXYForCompositionMeters": list(world_xy),
        "newActionNames": sorted(a.name for a in new_actions),
        "proxyObjectsHidden": len(proxies),
        "idleAction": idle.name,
        "rollAction": roll.name,
        "rollClipFrameRange": [round(v,2) for v in roll.frame_range],
        "objects": imported,
        "rigs": rigs,
        "roll": roll,
    }

# Red Lion entrance steps (A1 +Y facing) are at approx Y=-1.1m.
# Fighters are intentionally set on *ground in front of the building*, with
# scale based on an independent plausible adult height. These are NOT
# canonical map/camera transforms and must be tested against browser overlay.
silver = load_character("Silver Knight A3", args.silver, (-1.48, -.31), 1.80)
sentinel = load_character("T1 Sentinel A3", args.sentinel, (1.48, -.31), 1.84)
assert math.hypot(silver["worldXYForCompositionMeters"][0]-
                  sentinel["worldXYForCompositionMeters"][0],
                  silver["worldXYForCompositionMeters"][1]-
                  sentinel["worldXYForCompositionMeters"][1]) > .90
report = {
    "status": "A2 preliminary knight/building scale review only",
    "scene": args.scene.name,
    "modelSourcesStoredInRepository": False,
    "nativeBlenderSceneCommitted": False,
    "actualBrowserSpriteComparisonDone": False,
    "a1TavernDoorHeightMeters": 2.20,
    "metersPerGameWorldUnitArtConvention": .025,
    "rollDurationVisualMs": 350,
    "rollAuthoritativeMs": 170,
    "recoveryAuthoritativeMs": 180,
    "silver": {k:v for k,v in silver.items() if k not in ("objects","rigs","roll")},
    "sentinel": {k:v for k,v in sentinel.items() if k not in ("objects","rigs","roll")},
    "renderEngine": "Cycles CPU",
    "renderSamples": scene.cycles.samples,
    "targetRollFrame": args.roll_frame,
    "rollReview": "Two separate single-character stills to prevent visual overlap",
    "changesGameplay": False
}
# This review blend contains owner-provided character models; never push it
# into the GitHub repo before their asset provenance is explicitly cleared.
scene.frame_set(1)
scene.camera = camera
bpy.ops.wm.save_as_mainfile(filepath=str(args.out_dir/"blood_iron_knights_local_review.blend"))
if args.render:
    scene.render.filepath = str(args.out_dir/"blood_iron_knights_scale_a2.png")
    bpy.ops.render.render(write_still=True)
    # Render each approved roll independently. When both glTF root-motion
    # actions play at once they overlap near the inn, hiding shoulder/hand
    # articulation. The QA is about pose and scale, NOT multiplayer combat.
    for hero, companion, name in (
        (silver, sentinel, "blood_iron_silver_roll_a2.png"),
        (sentinel, silver, "blood_iron_sentinel_roll_a2.png"),
    ):
        for ob in companion["objects"]:
            if ob.type == "MESH":
                ob.hide_render = True
        for rig in hero["rigs"]:
            rig.animation_data.action = hero["roll"]
        scene.frame_set(args.roll_frame)
        scene.render.filepath = str(args.out_dir/name)
        bpy.ops.render.render(write_still=True)
        for ob in companion["objects"]:
            if ob.type == "MESH" and not is_proxy(ob):
                ob.hide_render = False
        for rig in hero["rigs"]:
            rig.animation_data.action = next(
                (a for a in bpy.data.actions if a.name == hero["idleAction"]), None
            )
        scene.frame_set(1)

(args.out_dir/"blood_iron_knights_scale_report.json").write_text(
    json.dumps(report, indent=2) + "\n", encoding="utf8")
print("A2_KNIGHT_QA=" + json.dumps(report, sort_keys=True))

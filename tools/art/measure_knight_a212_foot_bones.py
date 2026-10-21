#!/usr/bin/env python3
"""A2.12: measured LEFT/RIGHT FOOT JOINTS projected into original A3 roll bake.

Read-only GLB rig and camera measurement. Does not author geometry, edit GLB,
render replacement textures or infer authoritative ground/contact physics.

Blender 4.5.14 LTS background example:
 blender -b --factory-startup --python tools/art/measure_knight_a212_foot_bones.py -- \
    --source "path/to/silver-knight-roll-A3.glb" --clip silver_roll \
    --output "path/to/silver_roll_a212_foot_report.json"
"""
import argparse
import hashlib
import json
import math
import sys
from pathlib import Path

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
p = argparse.ArgumentParser()
p.add_argument("--source", type=Path, required=True)
p.add_argument("--clip", choices=("silver_roll", "t1_roll"), required=True)
p.add_argument("--output", type=Path, required=True)
args = p.parse_args(argv)
assert args.source.is_file()

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = 60  # glTF frame conversion MUST precede import.
bpy.ops.import_scene.gltf(filepath=str(args.source.resolve()))
rigs = [o for o in bpy.data.objects if o.type == "ARMATURE"]
assert len(rigs) == 1, len(rigs)
rig = rigs[0]
assert len(rig.data.bones) == 22
assert rig.animation_data, "A3 roll action/animation required"
action = bpy.data.actions.get("roll")
assert action is not None
rig.animation_data.action = action
if action.slots:
    rig.animation_data.action_slot = action.slots[0]
for track in rig.animation_data.nla_tracks:
    track.mute = True

feet = ("mixamorig:LeftFoot", "mixamorig:RightFoot")
assert all(name in rig.pose.bones for name in feet), list(rig.pose.bones)
camera_data = bpy.data.cameras.new("A3 original 8-way CPU sprite camera")
camera = bpy.data.objects.new("A3 original 8-way CPU sprite camera", camera_data)
scene.collection.objects.link(camera)
scene.camera = camera
camera_data.type = "ORTHO"
camera_data.ortho_scale = 1.66
scene.render.resolution_x = 160
scene.render.resolution_y = 160
scene.render.resolution_percentage = 100
offset = 0.0 if args.clip == "silver_roll" else 0.67
focus = Vector((0, 0, -0.07 + offset))
frames = (1, 3, 5, 7, 9, 11, 15, 22)
observations = []

def image_px(world):
    uv = world_to_camera_view(scene, camera, world)
    return [round(uv.x * 160, 4), round((1 - uv.y) * 160, 4)]

for direction in range(8):
    angle = math.tau * direction / 8
    camera.location = (3.25 * math.sin(angle), -3.25 * math.cos(angle),
                       2.65 + offset)
    camera.rotation_euler = (focus - Vector(camera.location)).to_track_quat(
        "-Z", "Y").to_euler()
    for column, frame in enumerate(frames):
        scene.frame_set(frame)
        bpy.context.view_layer.update()
        bones = {}
        for name in feet:
            pb = rig.pose.bones[name]
            head = rig.matrix_world @ pb.head
            tail = rig.matrix_world @ pb.tail
            hp = image_px(head)
            tp = image_px(tail)
            # This is an ankle/foot JOINT projection, not shoe sole contact.
            # Exact approved draw destination rectangle: 134x134 at (-67,-78).
            x_offset = -67.0
            y_offset = -78.0
            bones[name.split(":")[-1]] = {
                "headWorldXYZ": [round(v, 5) for v in head],
                "tailWorldXYZ": [round(v, 5) for v in tail],
                "headAtlasFramePx": hp,
                "tailAtlasFramePx": tp,
                "headPresentationOffsetPx": [
                    round(x_offset + hp[0] * 134 / 160, 4),
                    round(y_offset + hp[1] * 134 / 160, 4)],
                "tailPresentationOffsetPx": [
                    round(x_offset + tp[0] * 134 / 160, 4),
                    round(y_offset + tp[1] * 134 / 160, 4)]
            }
        observations.append({"direction": direction, "atlasColumn": column,
                             "sourceFrame60fps": frame, "bones": bones})

assert len(observations) == 64
out = {
    "milestone": "Blood & Iron A2.12 actual A3 rig foot-bone pixel projection",
    "blender": bpy.app.version_string,
    "sourceGLBBasename": args.source.name,
    "sourceSha256": hashlib.sha256(args.source.read_bytes()).hexdigest(),
    "clip": args.clip,
    "sourceFrames60fps": list(frames),
    "directionRows": 8,
    "samples": len(observations),
    "spriteCameraOrthoScale": 1.66,
    "modelHeightOffsetForBake": offset,
    "canvas": [160, 160],
    "renderedRollDimensionsPx": [134, 134],
    "renderedRollOffsetFromFighterOriginPx": [-67, -78],
    "boneJointNames": list(feet),
    "observations": observations,
    "footOrSoleContactMeasured": False,
    "meshIntersectionOrGroundClearanceMeasured": False,
    "authoritativeWorldPivotApproved": False,
    "blenderOrOriginalGLBModified": False,
    "originalAtlasesModified": False,
    "gameCombatOrNetworkChanged": False,
    "productionApproved": False
}
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(json.dumps(out, indent=2, sort_keys=True) + "\n",
                       encoding="utf8")
print("A212_FOOT_REPORT=" + json.dumps({
    "clip": args.clip, "samples": len(observations),
    "sha256": out["sourceSha256"],
    "frame0SouthFootOffsets": observations[0]["bones"]
}, sort_keys=True))

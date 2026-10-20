"""myaso.io roll A3: staged forward shoulder-roll, source-only animation draft.
Source models / prior A0 files / live game are never overwritten.
Use Blender 4.5 in --background mode. Original locomotion comes from server.
"""
import bpy, math, json, pathlib
from mathutils import Vector, Quaternion
from math import radians
import argparse
import sys
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
parser = argparse.ArgumentParser()
parser.add_argument("--source", required=True, help="Original owner-supplied GLB")
parser.add_argument("--output-dir", required=True)
args = parser.parse_args(argv)
src = pathlib.Path(args.source)
out = pathlib.Path(args.output_dir)
assert src.is_file(), src
out.mkdir(parents=True, exist_ok=True)
name = src.stem
blend = out / (name + "-roll-A3.blend")
glb = out / (name + "-roll-A3.glb")
report = out / (name + "-roll-A3-diagnostics.json")
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(src))
rig=next(obj for obj in bpy.data.objects if obj.type=="ARMATURE")
rig.rotation_mode="QUATERNION"
bpy.context.scene.render.fps=60
bpy.context.scene.frame_start=1
bpy.context.scene.frame_end=22
existing={a.name for a in bpy.data.actions}
assert {"idle","walk_loop"}<=existing
for track in rig.animation_data.nla_tracks:track.mute=True
bpy.context.scene.frame_set(1)
reference={}
for bone in rig.pose.bones:
    bone.rotation_mode="QUATERNION"
    reference[bone.name]=(bone.rotation_quaternion.copy(),bone.location.copy(),bone.scale.copy())
ref_q=rig.rotation_quaternion.copy()
ref_xyz=rig.location.copy()
action=bpy.data.actions.new("roll")
rig.animation_data.action=action
rig.animation_data.action_slot=None
k="mixamorig:"
# frame, tumble-deg, forward-m, side-m, knee-bend, curl, arm-support,
# follow-through, head-tuck, root-crouch-depth, shoulder-tilt-deg
# Active from frame 1 to 11 (167 ms), recovery from frame 11 to 22 (183 ms).
poses=[
    (1,0.0,0.00,0.00,0.06,0.00,0.02,0.0,0.00,0.00,0.0),
    (2,3.0,0.00,0.00,0.48,0.23,0.35,0.1,0.26,0.10,0.0),
    (3,11.0,0.03,0.00,0.88,0.55,0.78,0.3,0.55,0.17,3.0),
    (4,24.0,0.08,-0.02,1.00,0.72,1.00,0.55,0.72,0.22,9.0),
    (5,55.0,0.13,-0.03,1.00,0.78,1.00,0.95,0.84,0.16,17.0),
    (6,101.0,0.17,-0.04,1.00,0.79,1.00,1.00,0.84,0.09,22.0),
    (7,151.0,0.19,-0.05,1.00,0.78,0.93,1.00,0.84,0.07,20.0),
    (8,201.0,0.19,-0.05,1.00,0.78,0.84,0.95,0.82,0.07,15.0),
    (9,244.0,0.15,-0.04,0.95,0.75,0.78,0.9,0.76,0.09,11.0),
    (10,274.0,0.13,-0.03,0.90,0.72,0.74,0.85,0.68,0.11,7.0),
    (11,302.0,0.09,-0.02,0.82,0.65,0.68,0.7,0.59,0.12,3.0),
    (12,327.0,0.06,-0.01,0.77,0.60,0.64,0.55,0.50,0.13,1.0),
    (14,360.0,0.00,0.00,0.62,0.46,0.71,0.3,0.38,0.17,0.0),
    (17,360.0,0.00,0.00,0.25,0.18,0.36,0.1,0.19,0.08,0.0),
    (22,360.0,0.00,0.00,0.06,0.00,0.02,0.0,0.00,0.00,0.0),
]
keybones=[
    k+"Hips",k+"Spine",k+"Spine1",k+"Spine2",k+"Head",
    k+"Neck",k+"LeftUpLeg",k+"RightUpLeg",k+"LeftLeg",k+"RightLeg",
    k+"LeftFoot",k+"RightFoot",k+"LeftArm",k+"RightArm",
    k+"LeftForeArm",k+"RightForeArm",k+"LeftShoulder",k+"RightShoulder"
]
# Parent-space compensated rest-space axis pose, to keep named bones
# consistent across compatible Mixamo skeletons.
def turn(name,axis,deg):
    pb=rig.pose.bones[k+name]
    orient=pb.bone.matrix_local.to_quaternion()
    # In Blender pose transforms are relative to rest-bone axes.
    q=orient.inverted()@Quaternion(Vector(axis),radians(deg))@orient
    pb.rotation_quaternion=q@reference[pb.name][0]
def restore():
    for pb in rig.pose.bones:
        rot,loc,scale=reference[pb.name]
        pb.rotation_quaternion=rot.copy()
        pb.location=loc.copy()
        pb.scale=scale.copy()
def skin_limits():
    deps=bpy.context.evaluated_depsgraph_get()
    # The original file also includes a loose mesh bounding volume, skip
    # that auxiliary object. geometry_0 has the actual skinned knight body.
    best=None
    for ob in bpy.data.objects:
        if ob.type!="MESH" or not any(m.type=="ARMATURE" for m in ob.modifiers):
            continue
        evaluated=ob.evaluated_get(deps)
        mesh=evaluated.to_mesh()
        points=[evaluated.matrix_world@v.co for v in mesh.vertices]
        bounds=[[min(p[i] for p in points),max(p[i] for p in points)] for i in range(3)]
        evaluated.to_mesh_clear()
        if best is None or len(ob.data.vertices)>best[0]:
            best=(len(ob.data.vertices),bounds)
    assert best is not None,"missing deforming humanoid mesh"
    return best[1]
# The imported idle knight stands on a ground plane at about z=-0.53.
bpy.context.view_layer.update()
ground=skin_limits()[2][0]
# Original Mixamo toe bone direction confirms facing -Y (important for roll).
for side_name in ("Left","Right"):
    foot=rig.data.bones[k+side_name+"Foot"].head_local
    toe=rig.data.bones[k+side_name+"ToeBase"].head_local
    assert toe.y < foot.y-0.05, "rig facing convention changed"
info=[]
for frame,angle,fwd,side,knee,curl,arms,follow,head,depth,tilt in poses:
    bpy.context.scene.frame_set(frame)
    restore()
    # Deliberate knee flex, shin counter-flex, hip squat BEFORE the roll.
    # Both thighs and lower legs move, so the legs really fold at the knee.
    for name in ("LeftUpLeg","RightUpLeg"):
        turn(name,(1,0,0),-knee*61)
    for name in ("LeftLeg","RightLeg"):
        turn(name,(1,0,0),knee*102)
    for name in ("LeftFoot","RightFoot"):
        turn(name,(1,0,0),-knee*27)
    # Spine flexion and chin to chest (a compact tuck).
    turn("Spine",(1,0,0),curl*34)
    turn("Spine1",(1,0,0),curl*26)
    turn("Spine2",(1,0,0),curl*20)
    turn("Neck",(1,0,0),head*18)
    turn("Head",(1,0,0),head*22)
    # Hands plant ahead of the shoulders; leading left hand takes load,
    # the right guides across the body to lead over a shoulder.
    turn("LeftShoulder",(0,1,0),arms*12)
    turn("RightShoulder",(0,1,0),-arms*14)
    turn("LeftArm",(1,0,0),-arms*91)
    turn("RightArm",(1,0,0),-(arms*77+follow*18))
    turn("LeftForeArm",(1,0,0),arms*62)
    turn("RightForeArm",(1,0,0),arms*70)
    # Forward of this Mixamo mesh is -Y (verified by toe bones). Positive X pitch
    # takes head/shoulders toward -Y; inverse pitch had rolled backward.
    # Use true armature-space rotation, NOT the belly/hips pivot.
    # The whole crouched rig transitions over its contact points.
    rig.rotation_quaternion=Quaternion(Vector((1,0,0)),radians(angle)) @ Quaternion(Vector((0,1,0)),radians(tilt)) @ ref_q
    rig.location=ref_xyz+Vector((side,-fwd,0))
    hips=rig.pose.bones[k+"Hips"]
    orient=hips.bone.matrix_local.to_quaternion()
    hips.location=reference[hips.name][1]+orient.inverted()@Vector((0,0,-depth))
    bpy.context.view_layer.update()
    # Floor-aware animation! Maintain stable skinned-mesh floor clearance.
    # This adjusts root height, so shoulders/hands/back can become contact
    # points rather than the pelvis passing through the floor.
    bounds=skin_limits()
    rig.location.z+=ground-bounds[2][0]
    bpy.context.view_layer.update()
    after=skin_limits()
    assert abs(after[2][0]-ground)<.012,(frame,after,ground)
    for pb in rig.pose.bones:
        for prop in ("location","rotation_quaternion"):
            pb.keyframe_insert(data_path=prop,frame=frame,group=pb.name)
    rig.keyframe_insert(data_path="location",frame=frame,group="root_contact")
    rig.keyframe_insert(data_path="rotation_quaternion",frame=frame,group="root_contact")
    point=lambda name: [round(q,4) for q in rig.matrix_world@rig.pose.bones[k+name].head]
    info.append({
        "frame":frame,"roll_degrees":angle,"knee_flex":knee,
        "arm_support":arms,"body_curl":curl,"root_xyz":[round(v,4) for v in rig.location],
        "mesh_ground":round(after[2][0],4),
        "hips":point("Hips"),"left_hand":point("LeftHand"),
        "right_hand":point("RightHand"),"head":point("Head"),
        "left_knee":point("LeftLeg"),"left_foot":point("LeftFoot")
    })
    print("POSE",frame,"ROLL",angle,"KNEE",round(knee,2),"HANDS",round(arms,2),
          "MESH_Z",round(after[2][0],3),"HIP_Z",info[-1]["hips"][2],flush=True)

# Ensure quaternion samples don't oversteer via BÃ©zier vector interpolation;
# original 360Â° is intentionally broken into <90Â° neighboring keys.
action=bpy.data.actions["roll"]
for fc in action.fcurves:
    for key in fc.keyframe_points:
        key.interpolation="LINEAR"
bpy.context.scene.frame_set(1)
bpy.context.view_layer.update()
bpy.ops.wm.save_as_mainfile(filepath=str(blend))
print("BLEND_SAVE",blend,blend.stat().st_size,flush=True)
bpy.ops.export_scene.gltf(
    filepath=str(glb),export_format="GLB",
    export_animations=True,export_animation_mode="ACTIONS",
    export_force_sampling=True
)
print("GLB_EXPORT",glb,glb.stat().st_size,flush=True)
report.write_text(json.dumps({"app":"Blender "+bpy.app.version_string,
    "source":str(src),"blend":str(blend),"glb":str(glb),
    "ground":ground,"sampled_poses":info},indent=2),encoding="utf8")
print("DONE",report,flush=True)

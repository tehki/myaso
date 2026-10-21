"""Original Graphics 3A A2 adult forward tumble, pure source/art bake.

Blender 4.5.14, 60 FPS source frames 1..22 = 350ms. Gameplay Combat
timing remains authoritative (170ms dodge + 180ms recovery).
Source GLB comes from A1 (22-bone original adult rig), not any Knight asset.
"""
import argparse, pathlib, sys, math, json
import bpy
from mathutils import Vector, Quaternion
from math import pi, radians, sin, cos
args=sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
p=argparse.ArgumentParser()
p.add_argument("--body",required=True,choices=("adult-masculine","adult-feminine"))
p.add_argument("--source-root",default="assets/characters/adult-body-a1")
p.add_argument("--output-root",default="assets/characters/adult-body-a2")
p.add_argument("--frames-root",default=".a2-frames")
p.add_argument("--smoke",action="store_true")
a=p.parse_args(args)
source=pathlib.Path(a.source_root).resolve()/(a.body+"-locomotion-a1.glb")
out=pathlib.Path(a.output_root).resolve();out.mkdir(parents=True,exist_ok=True)
frames=pathlib.Path(a.frames_root).resolve()/a.body;frames.mkdir(parents=True,exist_ok=True)
assert source.is_file(),source
bpy.ops.wm.read_factory_settings(use_empty=True)
sc=bpy.context.scene;sc.render.fps=60
bpy.ops.import_scene.gltf(filepath=str(source))
rig=next(obj for obj in bpy.data.objects if obj.type=="ARMATURE")
skin=[obj for obj in bpy.data.objects if obj.type=="MESH" and any(m.type=="ARMATURE" for m in obj.modifiers)]
assert len(rig.data.bones)==22 and len(skin)==1
assert {"idle","walk","run"} <= {action.name for action in bpy.data.actions},list(bpy.data.actions)
for track in rig.animation_data.nla_tracks:track.mute=True
rig.animation_data.action=None
for bone in rig.pose.bones:bone.rotation_mode="QUATERNION"
reference={b.name:(b.location.copy(),b.scale.copy()) for b in rig.pose.bones}
def rotate_world(name,axis,angle):
    pb=rig.pose.bones[name]
    orient=pb.bone.matrix_local.to_quaternion()
    pb.rotation_quaternion=orient.inverted()@Quaternion(axis,angle)@orient
def reset_pose():
    for pb in rig.pose.bones:
        pb.location=reference[pb.name][0].copy()
        pb.rotation_quaternion=Quaternion((1,0,0,0))
        pb.scale=reference[pb.name][1].copy()
roll=bpy.data.actions.new("roll")
rig.animation_data.action=roll
rig.animation_data.action_slot=None
# 22 frames @60Hz: total 350 ms, authoring convention same as Knight A3.
# Entry -> shoulder transfer -> inverted tumble -> forearm landing -> rise.
# Frame, forward rotation degrees (world X), shoulder tuck, knee tuck,
# elbow bracing, hip offset ahead toward -Y, hip drop from standing, head tuck.
poses=[
 (1,0,0,0,0,0.00,0.00,0.00),
 (2,9,.12,.20,.10,-.01,-.08,.10),
 (3,24,.30,.43,.28,-.03,-.20,.27),
 (4,47,.43,.70,.48,-.07,-.33,.36),
 (5,77,.56,.95,.70,-.12,-.44,.45),
 (6,105,.62,1.08,.85,-.17,-.49,.49),
 (7,145,.65,1.12,.86,-.21,-.51,.53),
 (8,185,.65,1.12,.88,-.23,-.53,.53),
 (9,222,.60,1.06,.86,-.21,-.50,.50),
 (10,254,.56,.98,.82,-.18,-.43,.46),
 (11,284,.50,.85,.78,-.13,-.35,.42),
 (12,309,.44,.76,.72,-.10,-.29,.33),
 (14,336,.34,.56,.57,-.05,-.22,.24),
 (17,354,.18,.26,.27,-.01,-.09,.10),
 (22,360,0,0,0,0.00,0.00,0.00),
]
bone_names=[
 "Hips","Spine","Spine1","Spine2","Neck","Head",
 "LeftShoulder","LeftArm","LeftForeArm","LeftHand",
 "RightShoulder","RightArm","RightForeArm","RightHand",
 "LeftUpLeg","LeftLeg","LeftFoot","LeftToeBase",
 "RightUpLeg","RightLeg","RightFoot","RightToeBase"]
assert set(bone_names)=={x.name for x in rig.pose.bones}
unit_x=Vector((1,0,0))
for frame,degrees,shoulder,knee,elbow,forward,drop,head_tuck in poses:
    reset_pose()
    rotate_world("Hips",unit_x,radians(degrees))
    hip=rig.pose.bones["Hips"]
    # Local rig presentation only: not a physical movement/hitbox instruction.
    hip.location.y=forward
    hip.location.z=drop
    rotate_world("Spine",unit_x,-shoulder*.22)
    rotate_world("Spine1",unit_x,-shoulder*.43)
    rotate_world("Spine2",unit_x,-shoulder*.36)
    rotate_world("Head",unit_x,-head_tuck*.56)
    for side in ("Left","Right"):
        rotate_world(side+"UpLeg",unit_x,-knee*.36)
        rotate_world(side+"Leg",unit_x,knee*.85)
        rotate_world(side+"Foot",unit_x,-knee*.26)
        rotate_world(side+"Arm",unit_x,elbow*.53)
        rotate_world(side+"ForeArm",unit_x,-elbow*.75)
    for pb in rig.pose.bones:
        pb.keyframe_insert(data_path="rotation_quaternion",frame=frame,group=pb.name)
    hip.keyframe_insert(data_path="location",frame=frame,group="Hips")
# Ensure smooth deterministic interpolation between source poses.
for curve in roll.fcurves:
    for key in curve.keyframe_points:key.interpolation="BEZIER"
roll.use_fake_user=True
sc.frame_start=1;sc.frame_end=22
# Editable model/rig + the actual four authored actions preserved in the artifact.
blend=out/(a.body+"-roll-a2.blend")
bpy.ops.wm.save_as_mainfile(filepath=str(blend))
glb=out/(a.body+"-roll-a2.glb")
bpy.ops.export_scene.gltf(filepath=str(glb),export_format="GLB",
    export_animations=True,export_nla_strips=False,export_animation_mode="ACTIONS")
assert blend.is_file() and glb.is_file()
# Same first-party A0/A1 studio lighting/projection.
world=bpy.data.worlds.new("A2 neutral workshop");sc.world=world;world.use_nodes=True
world.node_tree.nodes["Background"].inputs["Color"].default_value=(.40,.47,.55,1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value=.75
def lamp(name,location,power):
    ld=bpy.data.lights.new(name,"AREA")
    ob=bpy.data.objects.new(name,ld);sc.collection.objects.link(ob)
    ob.location=location;ob.rotation_euler=(Vector((0,0,.99))-ob.location).to_track_quat("-Z","Y").to_euler()
    ld.energy=power;ld.shape="DISK";ld.size=3
lamp("A2 key",(2,-3,4),300)
lamp("A2 fill",(-2,2.2,3),240)
camera_data=bpy.data.cameras.new("Eight facing roll")
cam=bpy.data.objects.new("Eight facing roll",camera_data);sc.collection.objects.link(cam);sc.camera=cam
camera_data.type="ORTHO";camera_data.ortho_scale=2.22
sc.render.engine="CYCLES";sc.cycles.device="CPU";sc.cycles.samples=2
sc.render.threads_mode="FIXED";sc.render.threads=2
sc.render.resolution_x=160;sc.render.resolution_y=160;sc.render.resolution_percentage=100
sc.render.film_transparent=True
sc.render.image_settings.file_format="PNG";sc.render.image_settings.color_mode="RGBA"
sc.render.image_settings.color_depth="8";sc.view_settings.view_transform="Standard"
rig.animation_data.action=roll
rig.animation_data.action_slot=roll.slots[0]
sample_frames=(1,3,5,7,9,11,15,22)
num=0
for direction in range(8):
    if a.smoke and direction not in (0,3):continue
    azimuth=direction*pi/4
    position=Vector((3.5*sin(azimuth),-3.5*cos(azimuth),2.55))
    cam.location=position;cam.rotation_euler=(Vector((0,0,.95))-position).to_track_quat("-Z","Y").to_euler()
    for index,source_frame in enumerate(sample_frames):
        if a.smoke and index not in (0,2,3,4,7):continue
        sc.frame_set(source_frame)
        target=frames/f"roll_row{direction:02d}_frame{index:02d}.png"
        sc.render.filepath=str(target)
        bpy.ops.render.render(write_still=True)
        assert target.stat().st_size>400,target
        num+=1
        print("A2_ROLL_FRAME",a.body,direction,index,source_frame,target.stat().st_size,flush=True)
report={
 "bodyPresentation":a.body,"sourceOriginal":"first-party A1 Blender/GLB",
 "modelBlend":blend.name,"modelGlb":glb.name,
 "preservedActions":["idle","walk","run"],"newAction":"roll",
 "sourceFps":60,"startFrame":1,"endFrame":22,
 "sourceRollDurationMs":350,"combatActiveMs":170,"combatRecoveryMs":180,
 "rollSampleFrames":sample_frames,"directions":8,"framesPerDirection":8,
 "sourceFramePx":160,"renderedFrames":num,"smoke":a.smoke,
 "rigBoneCount":22,"authoritativeCombatChanged":False,
 "gameplayMovementChanged":False,"noArmorOrWeapons":True,
 "footContactVerified":False,"worldGroundingVerified":False,
 "productionReady":False
}
(out/(a.body+"-roll-a2.json")).write_text(json.dumps(report,indent=2),encoding="utf8")
print("A2_ROLL_COMPLETE",json.dumps(report),flush=True)

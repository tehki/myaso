"""myaso.io Graphics 3A A1 — author new walk/run actions and render original 8-way atlases.

Runs in Blender 4.5.14 LTS. Imports only the A0 first-party GLB; preserves A0
sources, Knight/Combat authority, appearance and equipment slots unchanged.
Directional gait is an early skinned form study; contact needs art review.
"""
import bpy, argparse, pathlib, sys, math, json
from mathutils import Vector, Quaternion
from math import sin, cos, pi
argv=sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
p=argparse.ArgumentParser()
p.add_argument("--body",choices=["adult-masculine","adult-feminine"],required=True)
p.add_argument("--input-root",default="assets/characters/adult-body")
p.add_argument("--output-root",default="assets/characters/adult-body-a1")
p.add_argument("--frames-root",default=".a1-frames")
p.add_argument("--smoke",action="store_true")
args=p.parse_args(argv)
source=pathlib.Path(args.input_root).resolve()/(args.body+".glb")
out=pathlib.Path(args.output_root).resolve();out.mkdir(parents=True,exist_ok=True)
frames=pathlib.Path(args.frames_root).resolve()/args.body
frames.mkdir(parents=True,exist_ok=True)
assert source.is_file(),source
bpy.ops.wm.read_factory_settings(use_empty=True)
sc=bpy.context.scene;sc.render.fps=60
bpy.ops.import_scene.gltf(filepath=str(source))
rig=next(x for x in bpy.data.objects if x.type=="ARMATURE")
skin=[x for x in bpy.data.objects if x.type=="MESH" and any(m.type=="ARMATURE" for m in x.modifiers)]
assert len(skin)==1 and len(rig.data.bones)==22
original_actions=list(bpy.data.actions)
assert len(original_actions)==1,[(x.name) for x in original_actions]
original_actions[0].name="idle"
for tr in rig.animation_data.nla_tracks:tr.mute=True
# Explicitly author named actions from the same 22-bone compatible rest rig.
rig.animation_data.action=None
reference={b.name:(b.location.copy(),b.rotation_quaternion.copy(),b.scale.copy()) for b in rig.pose.bones}
for b in rig.pose.bones:b.rotation_mode="QUATERNION"
world_x=Vector((1,0,0));world_y=Vector((0,1,0))
def world_bone_rotation(name,axis,angle):
    pb=rig.pose.bones[name]
    rest=pb.bone.matrix_local.to_quaternion()
    pb.rotation_quaternion=rest.inverted()@Quaternion(axis,angle)@rest
def reset_pose():
    for b in rig.pose.bones:
        b.location=reference[b.name][0].copy()
        b.rotation_quaternion=Quaternion((1,0,0,0))
        b.scale=reference[b.name][2].copy()
clips={
    "walk":{"stride":.35,"knee":.30,"arm":.28,"bob":.012,"spine":.033,"frames":(1,5,9,13,17)},
    "run":{"stride":.62,"knee":.54,"arm":.50,"bob":.025,"spine":.075,"frames":(1,5,9,13,17)},
}
for clip,settings in clips.items():
    action=bpy.data.actions.new(clip)
    rig.animation_data.action=action
    rig.animation_data.action_slot=None
    for k,frame in enumerate(settings["frames"]):
        phase=k*pi/2
        reset_pose()
        for sign,side in ((1,"Left"),(-1,"Right")):
            swing=sin(phase)*sign
            world_bone_rotation(side+"UpLeg",world_x,-settings["stride"]*swing)
            # Bend knee on forward swing; ensure recovery to nearly straight at stance.
            knee=max(0,-swing)*settings["knee"] + (.10 if clip=="run" else .06)*(1-cos(2*phase))/2
            world_bone_rotation(side+"Leg",world_x,knee)
            world_bone_rotation(side+"Foot",world_x,settings["stride"]*swing*.35-knee*.18)
            world_bone_rotation(side+"Arm",world_x,settings["arm"]*swing)
            world_bone_rotation(side+"ForeArm",world_x,-.22 if clip=="walk" else -.48)
        world_bone_rotation("Spine1",world_x,settings["spine"]*sin(2*phase))
        world_bone_rotation("Spine2",world_x,settings["spine"]*.7 + (.03 if clip=="run" else 0))
        world_bone_rotation("Head",world_y,.015*sin(phase))
        hip=rig.pose.bones["Hips"]
        hip.location.z=settings["bob"]*(1-cos(2*phase))/2
        for pb in rig.pose.bones:
            pb.keyframe_insert(data_path="rotation_quaternion",frame=frame,group=pb.name)
        hip.keyframe_insert(data_path="location",frame=frame,group="Hips")
    for fc in action.fcurves:
        for pt in fc.keyframe_points:pt.interpolation="BEZIER"
    action.use_fake_user=True
    print("LOCOMOTION_ACTION",args.body,clip,len(action.slots),flush=True)
sc.frame_start=1;sc.frame_end=17
bpy.context.view_layer.update()
# Store complete source with all three independent actions.
blend=out/(args.body+"-locomotion-a1.blend")
bpy.ops.wm.save_as_mainfile(filepath=str(blend))
glb=out/(args.body+"-locomotion-a1.glb")
bpy.ops.export_scene.gltf(filepath=str(glb),export_format="GLB",
    export_animations=True,export_nla_strips=False,export_animation_mode="ACTIONS")
assert blend.is_file() and glb.is_file()
# Match A0 render pipeline/camera/light for visual comparison.
world=bpy.data.worlds.new("A1 daylight source");sc.world=world;world.use_nodes=True
world.node_tree.nodes["Background"].inputs["Color"].default_value=(.40,.47,.55,1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value=.75
def light(name,location,power):
    ld=bpy.data.lights.new(name,"AREA");ob=bpy.data.objects.new(name,ld);sc.collection.objects.link(ob)
    ob.location=location;ob.rotation_euler=(Vector((0,0,.99))-ob.location).to_track_quat("-Z","Y").to_euler()
    ld.energy=power;ld.shape="DISK";ld.size=3.0
light("soft warm key",(2,-3,4),300)
light("soft cool fill",(-2,2.2,3),240)
cam_data=bpy.data.cameras.new("8-way A1 bake")
cam=bpy.data.objects.new("8-way A1 bake",cam_data);sc.collection.objects.link(cam);sc.camera=cam
cam_data.type="ORTHO";cam_data.ortho_scale=2.22
sc.render.engine="CYCLES";sc.cycles.device="CPU";sc.cycles.samples=2
sc.render.threads_mode="FIXED";sc.render.threads=2
sc.render.resolution_x=160;sc.render.resolution_y=160;sc.render.resolution_percentage=100
sc.render.film_transparent=True
sc.render.image_settings.file_format="PNG";sc.render.image_settings.color_mode="RGBA"
sc.render.image_settings.color_depth="8";sc.view_settings.view_transform="Standard"
num=0
for clip in clips:
    action=bpy.data.actions[clip]
    rig.animation_data.action=action
    if len(action.slots):rig.animation_data.action_slot=action.slots[0]
    for direction in range(8):
        if args.smoke and direction not in (0,4):continue
        a=direction*pi/4
        position=Vector((3.5*sin(a),-3.5*cos(a),2.55))
        cam.location=position;cam.rotation_euler=(Vector((0,0,.95))-position).to_track_quat("-Z","Y").to_euler()
        for col,frame in enumerate((1,5,9,13)):
            if args.smoke and col not in (0,1):continue
            sc.frame_set(frame)
            filename=frames/("%s_row%02d_frame%02d.png"%(clip,direction,col))
            sc.render.filepath=str(filename)
            bpy.ops.render.render(write_still=True)
            assert filename.stat().st_size>400,filename
            num+=1
            print("A1_FRAME",args.body,clip,direction,col,filename.stat().st_size,flush=True)
report={"bodyPresentation":args.body,"sourceOriginal":"first-party Blender A0 mesh and rig",
 "sourceBlend":blend.name,"sourceGlb":glb.name,"originalA0Unchanged":True,
 "rigBones":22,"sourceFrames":[1,5,9,13],"clips":["walk","run"],
 "directions":8,"frameSize":160,"renderedFrames":num,
 "smoke":args.smoke,"footGroundContactVerified":False,
 "networkedGameVerified":False,"productionReady":False,
 "authoritativeCombatChanged":False}
(out/(args.body+"-locomotion-a1.json")).write_text(json.dumps(report,indent=2),encoding="utf8")
print("A1_LOCOMOTION_COMPLETE",json.dumps(report),flush=True)

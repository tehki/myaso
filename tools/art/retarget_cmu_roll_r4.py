"""Graphics 3A R4 — retarget unrestricted CMU 128_10 real human motion onto CC0 human mesh.

Research draft/preview only. No animation approved, no authority or hitbox edit.
Motion capture is from CMU 128_10 Run Dive Over Roll Run (all-use dataset),
not SFU's noncommercial-only data. Frame subset is aggressively compressed
into 350ms and thus MUST pass human visual review before becoming game art.
"""
import argparse,bpy,json,math,sys,pathlib
from mathutils import Vector,Quaternion
from math import pi,sin,cos
args=sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
p=argparse.ArgumentParser()
p.add_argument("--body",required=True,choices=("adult-masculine","adult-feminine"))
p.add_argument("--r3-root",default="assets/characters/adult-anatomy-r3")
p.add_argument("--mocap",default="assets/characters/upstream-cmu-r4/128_10.bvh")
p.add_argument("--out-root",default="assets/characters/adult-mocap-r4")
p.add_argument("--frames-root",default=".r4-frames")
p.add_argument("--smoke",action="store_true")
a=p.parse_args(args)
source=pathlib.Path(a.r3_root).resolve()/(a.body+"-anatomical-shoulderroll-r3.glb")
bvh=pathlib.Path(a.mocap).resolve()
out=pathlib.Path(a.out_root).resolve();out.mkdir(parents=True,exist_ok=True)
frames=pathlib.Path(a.frames_root).resolve()/a.body;frames.mkdir(parents=True,exist_ok=True)
assert source.is_file() and bvh.is_file()
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(source))
target=next(o for o in bpy.data.objects if o.type=="ARMATURE")
body=[o for o in bpy.data.objects if o.type=="MESH" and any(m.type=="ARMATURE" for m in o.modifiers)]
assert len(body)==1
old_actions={x.name:x for x in bpy.data.actions}
assert {"idle","walk","run"}<=set(old_actions)
bpy.ops.import_anim.bvh(filepath=str(bvh),global_scale=.01)
skeletons=[o for o in bpy.data.objects if o.type=="ARMATURE" and o!=target]
assert len(skeletons)==1
mocap=skeletons[0]
for track in target.animation_data.nla_tracks:track.mute=True
target.animation_data.action=None
for b in target.pose.bones:b.rotation_mode="QUATERNION"
name_map={
 "Hips":"Hips","Spine":"Spine","Spine1":"Spine1",
 "Spine2":"Neck","Neck":"Neck1","Head":"Head",
 "LeftShoulder":"LeftShoulder","LeftArm":"LeftArm",
 "LeftForeArm":"LeftForeArm","LeftHand":"LeftHand",
 "RightShoulder":"RightShoulder","RightArm":"RightArm",
 "RightForeArm":"RightForeArm","RightHand":"RightHand",
 "LeftUpLeg":"LeftUpLeg","LeftLeg":"LeftLeg",
 "LeftFoot":"LeftFoot","LeftToeBase":"LeftToeBase",
 "RightUpLeg":"RightUpLeg","RightLeg":"RightLeg",
 "RightFoot":"RightFoot","RightToeBase":"RightToeBase",
}
assert set(name_map).issubset({x.name for x in target.pose.bones})
assert set(name_map.values()).issubset({x.name for x in mocap.pose.bones})
# Motion capture original 120Hz, full 428 frames: sequence #128_10.
# Captured roll from crouch to inverted to feet; sample preserving chronological
# asymmetry. A 350ms 8-source-frame game art compression is a candidate only.
sampling=[37,73,97,121,157,193,253,313]
source_start,soure_end=sampling[0],sampling[-1]
sc=bpy.context.scene;sc.frame_set(source_start)
src_start=mocap.matrix_world@mocap.pose.bones["Hips"].head
sc.frame_set(soure_end)
src_end=mocap.matrix_world@mocap.pose.bones["Hips"].head
assert src_end.y>src_start.y,(src_start,src_end)
# Bone-local rest orientation corrections, not simple unconverted Euler copy.
rest_corrections={}
for dst,src in name_map.items():
    qsrc=mocap.data.bones[src].matrix_local.to_quaternion()
    qdst=target.data.bones[dst].matrix_local.to_quaternion()
    rest_corrections[dst]=qdst.inverted()@qsrc
roll=bpy.data.actions.new("roll_r4_real_mocap_candidate")
target.animation_data.action=roll
if roll.slots:target.animation_data.action_slot=roll.slots[0]
target.rotation_mode="XYZ"
deg=target
samples=[]
def evaluated_skin_min_z():
    bpy.context.view_layer.update()
    deps=bpy.context.evaluated_depsgraph_get()
    ob=body[0].evaluated_get(deps)
    mesh=ob.to_mesh()
    try:
        trans=ob.matrix_world
        step=max(1,len(mesh.vertices)//3500)
        return min((trans@mesh.vertices[i].co).z
            for i in range(0,len(mesh.vertices),step))
    finally:ob.to_mesh_clear()
for index,bvh_frame in enumerate(sampling):
    sc.frame_set(bvh_frame)
    sourcehip=mocap.matrix_world@mocap.pose.bones["Hips"].head
    t=(sourcehip.y-src_start.y)/(src_end.y-src_start.y)
    t=max(0,min(1,t))
    target.location=(0,-t*1.0,0)
    target.rotation_euler=(0,0,0)
    for dst,src in name_map.items():
        src_pb=mocap.pose.bones[src]
        qsrc=src_pb.matrix_basis.to_quaternion()
        basis=rest_corrections[dst]
        qdst=basis@qsrc@basis.inverted()
        target.pose.bones[dst].rotation_quaternion=qdst.normalized()
    # adjust to actually evaluated skinned body against isolated floor,
    # unlike old Hips-only rotation / rest-mesh bounding surrogate.
    contact=evaluated_skin_min_z()
    target.location.z=.035-contact
    real_contact=evaluated_skin_min_z()
    key_frame=(1,3,5,7,9,11,15,22)[index]
    for pb in target.pose.bones:
        pb.keyframe_insert(data_path="rotation_quaternion",frame=key_frame,group=pb.name)
    target.keyframe_insert(data_path="location",frame=key_frame,group="CMU root displacement")
    target.keyframe_insert(data_path="rotation_euler",frame=key_frame,group="CMU local pose")
    samples.append({"keyframe":key_frame,"sourceBVH":bvh_frame,
      "rootTravelMeters":round(t,4),"contactZ":round(real_contact,4),
      "hipOriginal":list(round(v,4) for v in sourcehip)})
for fc in roll.fcurves:
    for k in fc.keyframe_points:k.interpolation="BEZIER"
roll.use_fake_user=True
sc.frame_start=1;sc.frame_end=22
# Remove mocap reference rig from exported source scene while keeping baked
# R4 target animation and external provenance report.
bpy.data.objects.remove(mocap,do_unlink=True)
blend=out/(a.body+"-mocap-roll-r4.blend")
bpy.ops.wm.save_as_mainfile(filepath=str(blend))
glb=out/(a.body+"-mocap-roll-r4.glb")
bpy.ops.export_scene.gltf(filepath=str(glb),export_format="GLB",
    export_animations=True,export_nla_strips=False,export_animation_mode="ACTIONS")
assert blend.is_file() and glb.is_file()
# A4 minimalist source proof: original CC0 detailed mesh, neutral studio.
world=bpy.data.worlds.new("R4 daytime neutral studio");sc.world=world;world.use_nodes=True
world.node_tree.nodes["Background"].inputs["Color"].default_value=(.48,.50,.53,1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value=.77
def light(name,loc,power):
    d=bpy.data.lights.new(name,"AREA")
    o=bpy.data.objects.new(name,d)
    sc.collection.objects.link(o);o.location=loc
    o.rotation_euler=(Vector((0,-.50,.95))-o.location).to_track_quat("-Z","Y").to_euler()
    d.energy=power;d.size=3
light("key",(2,-3,4),310);light("fill",(-2,2.2,3),230)
cd=bpy.data.cameras.new("eight-way mocap source")
camera=bpy.data.objects.new("eight-way mocap source",cd)
sc.collection.objects.link(camera);sc.camera=camera
cd.type="ORTHO";cd.ortho_scale=2.22
sc.render.engine="CYCLES";sc.cycles.device="CPU";sc.cycles.samples=2
sc.render.threads_mode="FIXED";sc.render.threads=4
sc.render.resolution_x=160;sc.render.resolution_y=160;sc.render.resolution_percentage=100
sc.render.film_transparent=True
sc.render.image_settings.file_format="PNG";sc.render.image_settings.color_mode="RGBA"
sc.view_settings.view_transform="Standard"
target.animation_data.action=roll
if roll.slots:target.animation_data.action_slot=roll.slots[0]
cnt=0
for direction in range(8):
    if a.smoke and direction not in (0,2):continue
    phi=direction*pi/4
    center=Vector((0,-.48,.95))
    camloc=center+Vector((3.5*sin(phi),-3.5*cos(phi),1.55))
    camera.location=camloc
    camera.rotation_euler=(center-camloc).to_track_quat("-Z","Y").to_euler()
    for index,fr in enumerate((1,3,5,7,9,11,15,22)):
        if a.smoke and index not in (0,2,3,4,7):continue
        sc.frame_set(fr)
        image=frames/f"roll_row{direction:02d}_frame{index:02d}.png"
        sc.render.filepath=str(image);bpy.ops.render.render(write_still=True)
        assert image.is_file() and image.stat().st_size>300
        cnt+=1;print("R4_CAPTURED",a.body,direction,index,image.stat().st_size,flush=True)
report={"body":a.body,"source":"CMU Motion Capture Database 128_10 roll",
 "sourceLicense":"CMU free for all uses","sourceBVH":"128_10.bvh",
 "sourceArchive":"Shriinivas/cmubvh Sequence-113-128/128/Data/128_10.zip",
 "selectedBVHFrames":sampling,"sampledRootContact":samples,
 "humanModel":"CC0 MakeHuman R3 anatomical",
 "rollTargetMs":350,"dodgeActiveMs":170,"recoveryMs":180,
 "retargetMethod":"bone-local rest basis quaternion correction",
 "separateSkinMesh":True,"framesRendered":cnt,"smoke":a.smoke,
 "poseApproval":False,"liveGroundContactVerified":False,
 "gameplayChanged":False,"productionActive":False}
(out/(a.body+"-mocap-roll-r4.json")).write_text(json.dumps(report,indent=2),encoding="utf8")
print("R4_MOCAP_REVIEW_CANDIDATE_DONE",json.dumps({"body":a.body,"frames":cnt,"travel":samples[-1]["rootTravelMeters"],"contacts":[s["contactZ"] for s in samples]}),flush=True)

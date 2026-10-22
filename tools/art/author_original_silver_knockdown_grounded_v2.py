"""Source-only Blender 22-bone owner Silver victim knockdown/recovery concept.
8 original facing directions x 8 real rig action samples. No production game change.
The actor object/root remains unmoved; floor/ragdoll physics NOT proven.
"""
import bpy, math, sys, argparse, json, hashlib
from pathlib import Path
from mathutils import Quaternion, Vector
v=sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
p=argparse.ArgumentParser()
p.add_argument("--source",required=True)
p.add_argument("--output",required=True)
p.add_argument("--no-render",action="store_true")
p.add_argument("--samples",type=int,default=1)
p.add_argument("--engine",default="CYCLES",choices=["CYCLES","BLENDER_EEVEE_NEXT"])
args=p.parse_args(v)
source=Path(args.source).resolve();out=Path(args.output).resolve()
assert source.is_file()
out.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene;scene.render.fps=60
bpy.ops.import_scene.gltf(filepath=str(source))
arm=next(x for x in bpy.data.objects if x.type=="ARMATURE")
assert len(arm.pose.bones)==22
idle=bpy.data.actions.get("idle")
assert idle and len(idle.slots)>0,"Must use original owner Silver idle rig"
arm.animation_data.action=idle;arm.animation_data.action_slot=idle.slots[0]
for t in arm.animation_data.nla_tracks:t.mute=True
scene.frame_set(3);bpy.context.view_layer.update()
actorRootAtImport=arm.matrix_world.copy()
basis={b.name:b.rotation_quaternion.copy() for b in arm.pose.bones}
baseLoc={b.name:b.location.copy() for b in arm.pose.bones}
def pose(rot=None,shift=(0,0,0)):
 for b in arm.pose.bones:
  b.rotation_mode="QUATERNION"
  b.rotation_quaternion=basis[b.name].copy()
  b.location=baseLoc[b.name].copy()
 for short,xyz in (rot or {}).items():
  bone=arm.pose.bones["mixamorig:"+short]
  ax,ay,az=xyz
  bone.rotation_quaternion=basis[bone.name]@(Quaternion((1,0,0),ax)@Quaternion((0,1,0),ay)@Quaternion((0,0,1),az))
 hips=arm.pose.bones["mixamorig:Hips"]
 hips.location=baseLoc[hips.name]+Vector(shift)

# Controlled collapse and recovery in an original skeletal source action.
# NO actor-root translation, gameplay knockdown, ragdoll or contact signal.
arms={"RightArm":(-.45,-.20,.11),"RightForeArm":(.42,0,-.10),
      "LeftArm":(-.28,.18,-.11),"LeftForeArm":(.26,0,.11)}
impact={**arms,"Spine":(-.32,0,-.03),"Spine1":(-.24,0,-.02),
 "Neck":(.10,0,.02),"RightUpLeg":(-.22,0,-.06),"LeftUpLeg":(.13,0,.05),
 "RightLeg":(.24,0,0),"LeftLeg":(-.15,0,0)}
buckle={**impact,"Spine":(-.65,0,-.04),"Spine1":(-.31,0,.02),
 "Hips":(-.12,0,.02),"RightUpLeg":(-.38,0,-.05),
 "LeftUpLeg":(.47,0,.06),"LeftLeg":(-.67,0,0),
 "RightArm":(-.84,0,.08),"LeftArm":(-.50,0,-.10)}
fall={**buckle,"Spine":(-1.42,0,-.06),"Spine1":(-.48,0,.03),
 "Hips":(-.26,0,.03),"RightUpLeg":(-.56,0,-.11),
 "LeftUpLeg":(.71,0,.11),"RightLeg":(.48,0,0),
 "LeftLeg":(-.89,0,0),"RightArm":(-1.18,0,.10),
 "LeftArm":(-.85,0,-.04),"Neck":(.23,0,0)}
down={**fall,"Spine":(-1.70,0,-.06),"Spine1":(-.54,0,.03),
 "Hips":(-.31,0,.03),"LeftUpLeg":(.82,0,.12),
 "LeftLeg":(-.92,0,0),"RightUpLeg":(-.61,0,-.13),
 "RightLeg":(.53,0,0),"RightArm":(-1.33,0,.11),
 "LeftArm":(-1.02,0,-.06)}
getup={**impact,"Spine":(-.68,0,-.03),"Spine1":(-.34,0,0),
 "RightArm":(-.72,0,.08),"LeftArm":(-.52,0,-.03),
 "RightUpLeg":(-.20,0,-.05),"LeftUpLeg":(.40,0,.07),
 "LeftLeg":(-.50,0,0)}
keys=[(1.0,{},(0,0,0)),(3.0,impact,(0,0,-.025)),
 (5.4,buckle,(0,0,-.085)),(8.0,fall,(0,0,-.17)),
 (10.6,down,(0,0,-.24)),(14.2,down,(0,0,-.24)),
 (18.2,getup,(0,0,-.10)),(22.6,{},(0,0,0))]
action=bpy.data.actions.new("Graphics3A_Silver_Victim_Knockdown_360ms_GroundedV2")
arm.animation_data.action=action
for frame,rot,shift in keys:
 scene.frame_set(int(frame),subframe=frame-int(frame))
 pose(rot,shift)
 for b in arm.pose.bones:
  b.keyframe_insert(data_path="rotation_quaternion",frame=frame,group=b.name)
  if b.name.endswith(":Hips"):b.keyframe_insert(data_path="location",frame=frame,group=b.name)
assert action.slots
arm.animation_data.action_slot=action.slots[0]
def bone_z(name):
 bpy.context.view_layer.update()
 return (arm.matrix_world @ arm.pose.bones["mixamorig:"+name].head).z
scene.frame_set(1);bpy.context.view_layer.update()
head_start=bone_z("Head");spine_start=bone_z("Spine")
scene.frame_set(10,subframe=.6);bpy.context.view_layer.update()
head_down=bone_z("Head");spine_down=bone_z("Spine")
assert head_down<head_start-0.08,(head_start,head_down)
assert math.isfinite(spine_down) and math.isfinite(spine_start)
assert max(abs(arm.matrix_world[row][col]-actorRootAtImport[row][col]) for row in range(4) for col in range(4))<1e-9
# Measure ORIGINAL evaluated *skinned armor mesh*, excluding the imported
# static Icosphere helper. This is genuine Blender-source 3D geometry contact
# relative to the rig's original resting floor. It is NOT the game terrain.
skinned=[x for x in bpy.data.objects if x.type=="MESH" and
  (x.parent==arm or any(m.type=="ARMATURE" for m in x.modifiers))]
assert len(skinned)==1 and skinned[0].name=="geometry_0",(len(skinned),[o.name for o in skinned])
def actual_armor_floor():
 deps=bpy.context.evaluated_depsgraph_get()
 return min((obj_eval.matrix_world@vert.co).z
   for original in skinned
   for obj_eval in [original.evaluated_get(deps)]
   for vert in obj_eval.data.vertices)
measurements=[]
for frame,_,_ in keys:
 scene.frame_set(int(frame),subframe=frame-int(frame))
 bpy.context.view_layer.update()
 measurements.append({"sourceFrame":frame,
   "lowestOriginalArmorZ":round(actual_armor_floor(),6),
   "headJointWorldZ":round(bone_z("Head"),6)})
floor=measurements[0]["lowestOriginalArmorZ"]
worst=max(abs(x["lowestOriginalArmorZ"]-floor) for x in measurements)
assert worst<=.025,("original Skinned-Silver lowest-point left source floor",worst,measurements)
low=next(x for x in measurements if x["sourceFrame"]==10.6)
head_gap=low["headJointWorldZ"]-low["lowestOriginalArmorZ"]
assert .16<head_gap<.25,("not genuinely more horizontal near original mesh support",head_gap)
assert abs(measurements[-1]["headJointWorldZ"]-measurements[0]["headJointWorldZ"])<.006
print("ORIGINAL_SILVER_GROUNDED_V2_SOURCE_MESH",json.dumps({
 "sourceArmorFloorAtGuard":floor,"sourceFloorMaxDeviation":round(worst,6),
 "lowestPoseHeadToLowestSkinnedArmor":round(head_gap,6),
 "allEightRealSourceContactSamples":measurements,
 "actorRootUnchanged":True,"actualGreyhavenGroundContactVerified":False}),flush=True)

print("SOURCE_KNOCKDOWN_BODY_COLLAPSE",
 json.dumps({"headStartWorldZ":head_start,"headDownWorldZ":head_down,
 "spineStartZ":spine_start,"spineDownZ":spine_down}),flush=True)
scene.render.engine=args.engine
if args.engine=="CYCLES":
 scene.cycles.device="CPU";scene.cycles.samples=args.samples
scene.render.threads_mode="FIXED";scene.render.threads=2
scene.render.film_transparent=True
scene.render.resolution_x=160;scene.render.resolution_y=160
scene.render.resolution_percentage=100
scene.render.image_settings.file_format="PNG"
scene.render.image_settings.color_mode="RGBA"
scene.render.image_settings.color_depth="8"
scene.render.image_settings.compression=15
scene.view_settings.view_transform="Standard"
scene.view_settings.look="Medium High Contrast"
world=scene.world or bpy.data.worlds.new("Silver original source preview")
scene.world=world;world.use_nodes=True
world.node_tree.nodes.get("Background").inputs["Color"].default_value=(.45,.5,.57,1)
world.node_tree.nodes.get("Background").inputs["Strength"].default_value=.65
for name,loc,power,col in [
 ("Key",(1.4,-1.7,3.3),210,(1,.90,.78)),
 ("Fill",(-1.4,1.1,2.7),180,(.73,.82,1))]:
 light=bpy.data.lights.new(name,"AREA")
 obj=bpy.data.objects.new(name,light);scene.collection.objects.link(obj)
 obj.location=loc
 obj.rotation_euler=(Vector((0,0,-.08))-obj.location).to_track_quat("-Z","Y").to_euler()
 light.energy=power;light.color=col;light.shape="DISK";light.size=3.6
cam_data=bpy.data.cameras.new("Original Silver eight-way 1.66 orthographic")
cam=bpy.data.objects.new("Original Silver eight-way 1.66 orthographic",cam_data)
scene.collection.objects.link(cam);scene.camera=cam
cam_data.type="ORTHO";cam_data.ortho_scale=1.66
focus=Vector((0,0,-.07))
rendered=[]
for direction in range(8):
 angle=math.tau*direction/8
 cam.location=(3.25*math.sin(angle),-3.25*math.cos(angle),2.65)
 cam.rotation_euler=(focus-Vector(cam.location)).to_track_quat("-Z","Y").to_euler()
 arm.animation_data.action=action;arm.animation_data.action_slot=action.slots[0]
 for index,(frame,_,_) in enumerate(keys):
  if args.no_render:continue
  scene.frame_set(int(frame),subframe=frame-int(frame))
  output=out/f"silver_knockdown_dir{direction}_frame{index}.png"
  scene.render.filepath=str(output)
  bpy.ops.render.render(write_still=True)
  assert output.is_file() and output.stat().st_size>400
  rendered.append({"direction":direction,"frame":index,
   "blenderFrame":frame,"bytes":output.stat().st_size})
  print("SILVER_KNOCKDOWN_ORIGINAL_SOURCE",direction,index,flush=True)
for ob in tuple(bpy.data.objects):
 if ob.type=="MESH":bpy.data.objects.remove(ob,do_unlink=True)
arm.animation_data.action=action;arm.animation_data.action_slot=action.slots[0]
action.use_fake_user=True
blend=out/"Graphics3A_Original_Silver_Victim_Knockdown_360ms_GroundedV2_source.blend"
bpy.ops.wm.save_as_mainfile(filepath=str(blend))
assert blend.stat().st_size>30000
manifest={"sourceSha256":hashlib.sha256(source.read_bytes()).hexdigest(),
 "originalRigBones":22,
 "blenderKnockdownClipMs":360,
 "authoritativeKickKnockdownMs":360,
 "sourceEditableBlend":True,
 "actorRootTranslationChanged":False,
 "ownerApprovedGameplay":False,
 "authoritativeStateChanged":False,
 "originalMeshRedistributed":False,
 "worldFloorBootSoleValidated":False,
 "sourceMeshMinZAlignedToOriginalStandingContact":True,
 "sourceFloorMaxDeviation":round(worst,6),
 "lowestPoseHeadToArmorFloor":round(head_gap,6),
 "sourceContactMeasurements":measurements,
 "originalMeshRedistributed":False,
 "impactMeshCollisionValidated":False,
 "normalGameRendererUnchanged":True,
 "rendered":rendered,
 "sourceKeyframes":[{"frame":f,"ms":round((f-1)/60*1000,3)} for f,_,_ in keys],
 "sourceRigMeasurements":{"headStartZ":head_start,"headDownZ":head_down,
 "spineStartZ":spine_start,"spineDownZ":spine_down}}
(out/"original_silver_knockdown_source_manifest.json").write_text(json.dumps(manifest,indent=2)+"\n")
print("SILVER_KNOCKDOWN_SOURCE_DONE",json.dumps({"rendered":len(rendered),"frames":len(keys)}),flush=True)

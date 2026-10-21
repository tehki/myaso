"""Graphics 3A P0 — editable Blender 4.5 original Silver kick+dash pose actions.
SOURCE ART CANDIDATE ONLY: no production atlas, movement, hitbox, or Combat edit.
Inputs are the authorized owner Silver GLB; output action-only .blend and renders.
"""
import bpy,math,sys,argparse,json,hashlib
from pathlib import Path
from mathutils import Vector,Quaternion
argv=sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
p=argparse.ArgumentParser()
p.add_argument("--source",required=True)
p.add_argument("--output",required=True)
p.add_argument("--smoke",action="store_true")
p.add_argument("--smoke-fast",action="store_true")
p.add_argument("--samples",type=int,default=1)
p.add_argument("--engine",choices=["CYCLES","BLENDER_EEVEE_NEXT"],default="CYCLES")
args=p.parse_args(argv)
source=Path(args.source).resolve();out=Path(args.output).resolve()
assert source.is_file()
out.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
sc=bpy.context.scene;sc.render.fps=60
bpy.ops.import_scene.gltf(filepath=str(source))
arm=next(o for o in bpy.data.objects if o.type=="ARMATURE")
assert len(arm.pose.bones)==22
assert bpy.data.actions.get("idle"),"Original Silver GLB idle is required"
rigKey="mixamorig:"
original=bpy.data.actions["idle"]
arm.animation_data.action=original
if original.slots:arm.animation_data.action_slot=original.slots[0]
for tr in arm.animation_data.nla_tracks:tr.mute=True
sc.frame_set(3)
bpy.context.view_layer.update()
basis={b.name:b.rotation_quaternion.copy() for b in arm.pose.bones}
positions={b.name:b.location.copy() for b in arm.pose.bones}
def source_pose(rotations=None,hipShift=(0,0,0)):
 rotations=rotations or {}
 for b in arm.pose.bones:
  b.rotation_mode="QUATERNION"
  b.rotation_quaternion=basis[b.name].copy()
  b.location=positions[b.name].copy()
 for bone,xyz in rotations.items():
  assert rigKey+bone in arm.pose.bones
  b=arm.pose.bones[rigKey+bone]
  # Local XYZ animated in action channel; no root transform motion.
  rx,ry,rz=xyz
  angle=(Quaternion((1,0,0),rx)@Quaternion((0,1,0),ry)@Quaternion((0,0,1),rz))
  b.rotation_quaternion=basis[b.name]@angle
 hip=arm.pose.bones[rigKey+"Hips"]
 hip.location=positions[hip.name]+Vector(hipShift)
def key_pose(action,frame,pose,shift=(0,0,0)):
 sc.frame_set(int(frame),subframe=frame-int(frame));bpy.context.view_layer.update()
 source_pose(pose,shift)
 for b in arm.pose.bones:
  b.keyframe_insert(data_path="rotation_quaternion",frame=frame,group=b.name)
  if b.name.endswith(":Hips"):b.keyframe_insert(data_path="location",frame=frame,group=b.name)
def new_action(name,keys):
 act=bpy.data.actions.new(name)
 arm.animation_data.action=act
 # Blender 4.5 creates suitable action slot when inserting new bone keys.
 if act.slots:arm.animation_data.action_slot=act.slots[0]
 for fr,rotations,shift in keys:
  key_pose(act,fr,rotations,shift)
 assert act.slots and len(act.slots)>0,(name,len(act.slots))
 print("AUTHORED_ACTION",name,"keys",len(keys),"range",list(act.frame_range),"slots",len(act.slots),flush=True)
 return act
# 60 fps. Kick: 90ms windup, 70ms active, 220ms recovery (total 380ms).
# Pose family is additive to real 22-bone source idle. L/R refer to original
# skeleton anatomy; the actual sprite camera faces all eight directions.
guard={"RightArm":(-.43,-.20,.10),"RightForeArm":(.30,0,-.18),
       "LeftArm":(-.20,.20,-.16),"LeftForeArm":(.22,0,.17)}
anticipation={**guard,"RightUpLeg":(.42,.06,-.10),"RightLeg":(-.65,0,0),
 "LeftUpLeg":(-.14,0,-.05),"LeftLeg":(.23,0,0),
 "Spine":(.09,0,-.12),"Spine1":(-.08,0,-.06),"Hips":(.05,0,-.10)}
active={**guard,"RightUpLeg":(1.10,-.08,-.12),"RightLeg":(-.15,0,0),
 "RightFoot":(-.08,.10,0),"LeftUpLeg":(-.16,0,-.04),"LeftLeg":(.22,0,0),
 "Spine":(-.22,0,.03),"Spine1":(-.18,0,-.04),"Hips":(-.09,0,.08)}
contact={**guard,"RightUpLeg":(1.02,-.02,-.12),"RightLeg":(-.08,0,0),
 "LeftUpLeg":(-.19,0,-.06),"LeftLeg":(.25,0,0),
 "Spine":(-.28,0,.04),"Spine1":(-.15,0,-.08),"Hips":(-.09,0,.07)}
retract={**guard,"RightUpLeg":(.48,0,-.12),"RightLeg":(-.46,0,0),
 "LeftUpLeg":(-.17,0,0),"Spine":(.02,0,0),"Hips":(0,0,-.03)}
# Dash: separate 140ms short forward lean. No rig root translation;
# true movement is always server authoritative (750 world unit/s).
dashReady={"Spine":(.12,0,0),"Spine1":(.11,0,-.02),
 "RightArm":(.28,0,.12),"LeftArm":(-.22,0,-.08),
 "RightUpLeg":(-.21,0,-.04),"LeftUpLeg":(.29,0,.04),
 "RightLeg":(.33,0,0),"LeftLeg":(-.15,0,0)}
dashPeak={"Spine":(.25,0,-.02),"Spine1":(.14,0,0),"Neck":(-.12,0,0),
 "RightArm":(.35,0,.18),"LeftArm":(-.35,0,-.14),
 "RightUpLeg":(-.45,0,-.06),"LeftUpLeg":(.55,0,.10),
 "RightLeg":(.56,0,0),"LeftLeg":(-.40,0,0),"Hips":(.12,0,0)}
dashExit={"Spine":(.15,0,0),"Spine1":(.08,0,0),
 "RightArm":(.12,0,.08),"LeftArm":(-.10,0,0),
 "RightUpLeg":(-.06,0,0),"LeftUpLeg":(.12,0,0),"Hips":(.02,0,0)}
# authored animation key times from verified Combat millisecond budgets;
# no artificial displacement or iframe changes.
kickKeys=[(1,{},(0,0,0)),
 (3.7,anticipation,(0,0,-.015)),
 (6.4,anticipation,(0,0,-.045)),
 (8.5,active,(0,0,-.023)),
 (10.6,contact,(0,0,-.018)),
 (13.5,retract,(0,0,-.025)),
 (18.0,guard,(0,0,-.007)),
 (23.8,{},(0,0,0))]
dashKeys=[(1,{},(0,0,0)),
 (2.1,dashReady,(0,0,-.025)),
 (3.7,dashPeak,(0,0,-.05)),
 (6.0,dashPeak,(0,0,-.038)),
 (7.6,dashExit,(0,0,-.01)),
 (9.4,{},(0,0,0))]
kick=new_action("Graphics3A_P0_Silver_Kick_380ms",kickKeys)
dash=new_action("Graphics3A_P0_Silver_Dash_140ms",dashKeys)
actions={"silver_kick_p0":kick,"silver_dash_p0":dash}
# Preserve original source mesh in Blender only for rendering; output action-
# only .blend with original source 22-bone skeleton and both actual editable
# keyframed action blocks, not redistributing original owner GLB art.
sc.render.engine=args.engine
if args.engine=="CYCLES":
 sc.cycles.device="CPU";sc.cycles.samples=args.samples
sc.render.threads_mode="FIXED";sc.render.threads=2
sc.render.film_transparent=True
sc.render.resolution_x=160;sc.render.resolution_y=160
sc.render.resolution_percentage=100
sc.render.image_settings.file_format="PNG"
sc.render.image_settings.color_mode="RGBA"
sc.render.image_settings.color_depth="8"
sc.render.image_settings.compression=15
sc.view_settings.view_transform="Standard"
sc.view_settings.look="Medium High Contrast"
world=sc.world or bpy.data.worlds.new("P0 source-asset preview studio")
sc.world=world;world.use_nodes=True
bg=world.node_tree.nodes.get("Background")
bg.inputs["Color"].default_value=(.45,.5,.57,1)
bg.inputs["Strength"].default_value=.65
for name,loc,power,color in [
 ("Key",(1.4,-1.7,3.3),210,(1,.90,.78)),
 ("Fill",(-1.4,1.1,2.7),180,(.73,.82,1))]:
 light=bpy.data.lights.new(name,"AREA")
 ob=bpy.data.objects.new(name,light);sc.collection.objects.link(ob)
 ob.location=loc
 ob.rotation_euler=(Vector((0,0,-.08))-ob.location).to_track_quat("-Z","Y").to_euler()
 light.energy=power;light.color=color;light.shape="DISK";light.size=3.6
cameraData=bpy.data.cameras.new("Original 8-way 1.66-ortho")
cam=bpy.data.objects.new("Original 8-way 1.66-ortho",cameraData)
sc.collection.objects.link(cam);sc.camera=cam
cameraData.type="ORTHO";cameraData.ortho_scale=1.66
focus=Vector((0,0,-.07))
# Production 160 source atlases must represent 8 source-facing and 8 motion
# time samples, not renaming existing walk/sprint frames.
samples={"silver_kick_p0":[1,3.7,6.4,8.5,10.6,13.5,18.0,23.8],
         "silver_dash_p0":[1,2.1,3.7,4.9,6.0,7.6,8.3,9.4]}
rendered=[]
for clip,frames in samples.items():
 act=actions[clip]
 arm.animation_data.action=act
 arm.animation_data.action_slot=act.slots[0]
 for d in range(8):
  if args.smoke_fast and d not in (0,2):continue
  if args.smoke and not args.smoke_fast and d not in (0,2,4,6):continue
  angle=math.tau*d/8
  cam.location=(3.25*math.sin(angle),-3.25*math.cos(angle),2.65)
  cam.rotation_euler=(focus-Vector(cam.location)).to_track_quat("-Z","Y").to_euler()
  for col,fr in enumerate(frames):
   if args.smoke_fast and col not in (0,4):continue
   if args.smoke and not args.smoke_fast and col not in (0,2,4,6):continue
   sc.frame_set(round(fr))
   target=out/f"{clip}_dir{d}_frame{col}.png"
   sc.render.filepath=str(target)
   bpy.ops.render.render(write_still=True)
   assert target.stat().st_size>400,(target,target.stat().st_size if target.exists() else "missing")
   rendered.append({"clip":clip,"direction":d,"phase":col,
    "sourceFrame":fr,"sampledBlenderFrame":round(fr),"bytes":target.stat().st_size})
   print("KICK_DASH_RENDER",clip,d,col,flush=True)
# Save source editable rig actions into separate verified content-rich blend:
# remove original user mesh, retain 22-bone skeleton and authored keyframes.
if not (args.smoke or args.smoke_fast):
 for ob in tuple(bpy.data.objects):
  if ob.type=="MESH":bpy.data.objects.remove(ob,do_unlink=True)
 # Source rig remains for action editing; save while one action attached.
 arm.animation_data.action=kick
 arm.animation_data.action_slot=kick.slots[0]
 for act in actions.values():act.use_fake_user=True
 blend=out/"Graphics3A_Silver_Kick_Dash_action_source.blend"
 bpy.ops.wm.save_as_mainfile(filepath=str(blend))
 assert blend.stat().st_size>30000
 print("ACTION_BLEND_SOURCE",blend.stat().st_size,flush=True)
(out/"kick_dash_blender_bake_report.json").write_text(json.dumps({
 "source":"Owner Silver original 22-bone GLB (not bundled or modified)",
 "sourceSha256":hashlib.sha256(source.read_bytes()).hexdigest(),
 "clipKeyframesMs":{"silver_kick_p0":[0,45,90,125,160,208,283,380],
                     "silver_dash_p0":[0,18,45,65,83,110,122,140]},
 "authoritativePhases":{"kickMs":[90,70,220],"dashMs":140},
 "framesPerDirection":8,"directions":8,"sourceFramePx":160,
 "sourceRigBones":22,"worldGroundValidated":False,
 "originalArtReplaced":False,"realGreyhaven":False,"humanVisualApproved":False,
 "trueServerEvent":False,"sourceEditableBlend":not args.smoke,
 "rendered":rendered},indent=2)+"\n")
print("KICK_DASH_BAKE_COMPLETED",len(rendered),flush=True)

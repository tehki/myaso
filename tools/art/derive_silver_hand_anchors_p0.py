"""Graphics 3A QA-only anatomical wrist-anchor authoring.
Reads owner-supplied Silver GLBs (not committed) and projects right-hand joint
using camera originally employed by A3 eight-direction art bake. Coordinates
are approximate for pre-A3 320px bakes; human visual acceptance required.
"""
import bpy,sys,math,json,pathlib
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
a=sys.argv[sys.argv.index("--")+1:]
model=pathlib.Path(a[0]);rolled=pathlib.Path(a[1]);dest=pathlib.Path(a[2])
frames={"silver_idle":4,"silver_walk":8,"silver_sprint":8,"silver_jump":6,"silver_roll":8}
names={"silver_idle":"idle","silver_walk":"walk_loop","silver_sprint":"sprint_loop","silver_jump":"jump_loop","silver_roll":"roll"}
sampleRoll=(1,3,5,7,9,11,15,22)
def collect(path,clips):
 bpy.ops.wm.read_factory_settings(use_empty=True)
 sc=bpy.context.scene;sc.render.fps=60;sc.render.resolution_x=160;sc.render.resolution_y=160
 bpy.ops.import_scene.gltf(filepath=str(path))
 arm=next(x for x in bpy.data.objects if x.type=="ARMATURE")
 assert len(arm.data.bones)==22
 hand=next(x for x in arm.pose.bones if x.name.endswith("RightHand"))
 for tr in arm.animation_data.nla_tracks:tr.mute=True
 cameraData=bpy.data.cameras.new("A3 original-facing projection")
 camera=bpy.data.objects.new("A3 original-facing projection",cameraData)
 sc.collection.objects.link(camera);sc.camera=camera
 cameraData.type="ORTHO";cameraData.ortho_scale=1.66
 focus=Vector((0,0,-.07))
 result={}
 for clip in clips:
  act=bpy.data.actions[names[clip]]
  arm.animation_data.action=act
  if act.slots:arm.animation_data.action_slot=act.slots[0]
  rng=list(act.frame_range)
  if clip=="silver_roll":sample=sampleRoll
  else:sample=[rng[0]+(rng[1]-rng[0])*k/frames[clip] for k in range(frames[clip])]
  rows=[]
  for direction in range(8):
   angle=2*math.pi*direction/8
   camera.location=(3.25*math.sin(angle),-3.25*math.cos(angle),2.65)
   camera.rotation_euler=(focus-Vector(camera.location)).to_track_quat("-Z","Y").to_euler()
   points=[]
   for f in sample:
    sc.frame_set(round(f))
    bpy.context.view_layer.update()
    xyz=arm.matrix_world@hand.head
    u=world_to_camera_view(sc,camera,xyz)
    px=[round(u.x*160,2),round((1-u.y)*160,2)]
    points.append(px)
   rows.append(points)
  result[clip]=rows
  print("HAND_ANCHOR",clip,"frameRange",rng,"first",rows[0][0],flush=True)
 return result
anchors=collect(model,["silver_idle","silver_walk","silver_sprint","silver_jump"])
anchors.update(collect(rolled,["silver_roll"]))
assert set(anchors)==set(frames)
for clip,rows in anchors.items():
 assert len(rows)==8
 assert all(len(row)==frames[clip] for row in rows)
 assert all(-30<xy[0]<190 and -30<xy[1]<190 for row in rows for xy in row),clip
dest.parent.mkdir(parents=True,exist_ok=True)
dest.write_text(json.dumps({"purpose":"QA wrist anchors calculated from owner-original GLB right-hand joints; never movement/authorization",
"generation":"Blender 4.5, original bake 1.66 ortho / source 160px sprite; pre-A3 alignment only approximate",
"modelBundled":False,"sourceBone":"mixamorig:RightHand",
"originalSilverAtlasModified":False,"humanArtApproved":False,"actualGameplayValidated":False,
"anchors":anchors},indent=2)+"\n",encoding="utf8")
print("SILVER_HAND_ANCHORS_READY",dest,len(dest.read_bytes()),flush=True)

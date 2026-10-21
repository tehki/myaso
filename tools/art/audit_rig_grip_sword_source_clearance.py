"""Graphics 3A art-only sword/ground envelope from original first-party meshes.
This is NOT World collision or authoritative gameplay contact.
"""
import argparse,json,math,sys,hashlib
from pathlib import Path
import bpy
from mathutils import Matrix
p=argparse.ArgumentParser()
p.add_argument("--knight",required=True)
p.add_argument("--sword-blend",required=True)
p.add_argument("--sword-manifest",required=True)
p.add_argument("--out",required=True)
p.add_argument("--sword-scale",type=float,default=.42)
args=p.parse_args(sys.argv[sys.argv.index("--")+1:])
manifest=json.loads(Path(args.sword_manifest).read_text("utf8"))
assert hashlib.sha256(Path(args.sword_blend).read_bytes()).hexdigest()==manifest["sourceBlendSha256"]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.scene.render.fps=60
bpy.ops.import_scene.gltf(filepath=args.knight)
arm=next(o for o in bpy.data.objects if o.type=="ARMATURE")
hand=arm.pose.bones["mixamorig:RightHand"]
act=bpy.data.actions["roll"];arm.animation_data.action=act
if act.slots:arm.animation_data.action_slot=act.slots[0]
for t in arm.animation_data.nla_tracks:t.mute=True
with bpy.data.libraries.load(args.sword_blend,link=False) as (src,dst):
 dst.objects=[name for name in src.objects if name.startswith("Sword ")]
sword=[o for o in dst.objects if o and o.type=="MESH"]
assert len(sword)==6
skinned=[o for o in bpy.data.objects if o.type=="MESH" and
         any(m.type=="ARMATURE" for m in o.modifiers)]
assert skinned
poseSamples=(1,3,5,7,9,11,15,22)
measurements=[]
for col,frame in enumerate(poseSamples):
 bpy.context.scene.frame_set(frame);bpy.context.view_layer.update()
 deps=bpy.context.evaluated_depsgraph_get()
 bodyZ=[]
 for skin in skinned:
  ob=skin.evaluated_get(deps)
  mesh=ob.to_mesh()
  bodyZ.extend((ob.matrix_world@v.co).z for v in mesh.vertices)
  ob.to_mesh_clear()
 handWorld=arm.matrix_world@hand.matrix
 m=(handWorld@Matrix.Translation((0,.06,0))
   @Matrix.Rotation(-math.pi/2,4,"X")
   @Matrix.Scale(args.sword_scale,4)
   @Matrix.Translation((0,0,-.42)))
 z=[]
 for o in sword:
  transform=m@Matrix(manifest["objects"][o.name]["worldMatrix"])
  z.extend((transform@v.co).z for v in o.data.vertices)
 measurements.append({"frameIndex":col,"sourceFrame":frame,
  "swordMinSourceZ":round(min(z),4),"swordMaxSourceZ":round(max(z),4),
  "rightHandSourceZ":round((arm.matrix_world@hand.head).z,4),
  "bodyLowestSourceZ":round(min(bodyZ),4),
  "swordLowerThanBodyBottomBy":round(min(z)-min(bodyZ),4),
  "swordBelowSourceZ0":min(z)<-.02})
out=Path(args.out).resolve();out.parent.mkdir(parents=True,exist_ok=True)
data={"kind":"Art-only relative Z envelope — cannot prove Greyhaven physical clearance",
 "sourceSwordBlendSha256":manifest["sourceBlendSha256"],"noLiveGame":True,
 "worldCollisionVerified":False,"characterRootMotionVerified":False,
 "sourceReferencePlaneZ":0,"sourceZ0IsVerifiedGround":False,
 "reference":"Relative skinned-geometry lowest Z is useful only as studio diagnostic, not floor",
 "sourceFrames":list(poseSamples),
 "poseSamples":measurements,
 "belowReferencePlaneCount":sum(q["swordBelowSourceZ0"] for q in measurements)}
out.write_text(json.dumps(data,indent=2)+"\n",encoding="utf8")
print("BONE_GRIP_CONTACT_PROXY",json.dumps({"below":data["belowReferencePlaneCount"],
 "perFrameMinZ":[x["swordMinSourceZ"] for x in measurements],
 "swordToBodyBottom":[x["swordLowerThanBodyBottomBy"] for x in measurements]}),flush=True)

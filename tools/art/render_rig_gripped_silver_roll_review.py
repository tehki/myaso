"""Graphics 3A experimental true bone-bound sword roll preview (NOT gameplay).
Exact source: original Silver Knight A3 roll GLB + original Graphics 3B sword
Blender .blend. Source files are locally supplied; not bundled or modified.
This source preview uses real mesh occlusion instead of a 2D wrist decal.
"""
import argparse,math,sys,json,hashlib
from pathlib import Path
import bpy
from mathutils import Vector,Matrix

def run():
 a=sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
 p=argparse.ArgumentParser()
 p.add_argument("--knight",required=True)
 p.add_argument("--sword-blend",required=True)
 p.add_argument("--sword-manifest",required=True)
 p.add_argument("--output",required=True)
 p.add_argument("--smoke",action="store_true")
 p.add_argument("--samples",type=int,default=3)
 p.add_argument("--engine",choices=("CYCLES","BLENDER_EEVEE_NEXT"),default="CYCLES")
 p.add_argument("--sword-scale",type=float,default=.42)
 p.add_argument("--inspect-only",action="store_true")
 args=p.parse_args(a)
 for name in ("knight","sword_blend","sword_manifest"):
  assert Path(getattr(args,name)).is_file(),getattr(args,name)
 manifest=json.loads(Path(args.sword_manifest).read_text(encoding="utf8"))
 assert hashlib.sha256(Path(args.sword_blend).read_bytes()).hexdigest()==manifest["sourceBlendSha256"]
 assert len(manifest["objects"])==6
 out=Path(args.output).resolve();out.mkdir(parents=True,exist_ok=True)
 bpy.ops.wm.read_factory_settings(use_empty=True)
 sc=bpy.context.scene;sc.render.fps=60
 bpy.ops.import_scene.gltf(filepath=args.knight)
 arm=next(o for o in bpy.data.objects if o.type=="ARMATURE")
 assert len(arm.data.bones)==22
 hand=arm.pose.bones.get("mixamorig:RightHand")
 assert hand, list(arm.pose.bones)
 act=bpy.data.actions["roll"]
 arm.animation_data.action=act
 arm.animation_data.action_slot=act.slots[0]
 for tr in arm.animation_data.nla_tracks:tr.mute=True
 for o in bpy.data.objects:
  if o.type=="MESH" and not any(m.type=="ARMATURE" for m in o.modifiers):
   o.hide_render=True
 # Load EXACT original Graphics3B sword mesh data by its first-party names.
 with bpy.data.libraries.load(args.sword_blend,link=False) as (src, dst):
  dst.objects=[name for name in src.objects if name.startswith("Sword ")]
 sword=[o for o in dst.objects if o and o.type=="MESH"]
 assert len(sword)==6,(len(sword),[o.name for o in sword])
 base={}
 for o in sword:
  sc.collection.objects.link(o)
  o.hide_render=False
  assert o.name in manifest["objects"]
  assert len(o.data.vertices)==manifest["objects"][o.name]["vertices"]
  # bpy.data.libraries.load() does NOT transfer original Object transforms.
  # Exact verified first-party 3B source matrices restore pommel scale,
  # tang and guard origins (never edit underlying sword mesh geometry).
  base[o.name]=Matrix(manifest["objects"][o.name]["worldMatrix"])
  print("SWORD_SOURCE",o.name,"restoredScale",[round(v,3) for v in base[o.name].to_scale()],flush=True)
 if args.inspect_only:return
 sc.render.engine=args.engine
 if args.engine=="CYCLES":sc.cycles.device="CPU"
 if args.engine=="CYCLES":sc.cycles.samples=args.samples
 sc.render.threads_mode="FIXED";sc.render.threads=2
 sc.render.film_transparent=True
 sc.render.resolution_x=224;sc.render.resolution_y=224
 sc.render.resolution_percentage=100
 sc.render.image_settings.file_format="PNG"
 sc.render.image_settings.color_mode="RGBA"
 sc.render.image_settings.color_depth="8"
 sc.render.image_settings.compression=15
 sc.view_settings.view_transform="Standard"
 sc.view_settings.look="Medium High Contrast"
 w=sc.world or bpy.data.worlds.new("Knight preview studio")
 sc.world=w;w.use_nodes=True
 w.node_tree.nodes.get("Background").inputs["Color"].default_value=(.45,.5,.57,1)
 w.node_tree.nodes.get("Background").inputs["Strength"].default_value=.65
 def lamp(name,loc,power,color):
  data=bpy.data.lights.new(name,"AREA");ob=bpy.data.objects.new(name,data)
  sc.collection.objects.link(ob);ob.location=loc
  ob.rotation_euler=(Vector((0,0,-.08))-ob.location).to_track_quat("-Z","Y").to_euler()
  data.energy=power;data.color=color;data.shape="DISK";data.size=3.6
 lamp("key",(1.4,-1.7,3.3),210,(1,.90,.78))
 lamp("fill",(-1.4,1.1,2.7),180,(.73,.82,1))
 ca=bpy.data.cameras.new("8-way bone-grip rig preview")
 cam=bpy.data.objects.new("8-way bone-grip rig preview",ca)
 sc.collection.objects.link(cam);sc.camera=cam
 ca.type="ORTHO";ca.ortho_scale=2.3
 focus=Vector((0,0,-.07))
 frames=[1,3,5,7,9,11,15,22]
 result=[]
 for direction in range(8):
  if args.smoke and direction not in (2,6):continue
  angle=math.tau*direction/8
  cam.location=(3.25*math.sin(angle),-3.25*math.cos(angle),2.65)
  cam.rotation_euler=(focus-Vector(cam.location)).to_track_quat("-Z","Y").to_euler()
  for col,frame in enumerate(frames):
   if args.smoke and col not in (0,4):continue
   sc.frame_set(frame);bpy.context.view_layer.update()
   # Exact armature pose matrix: grip translates and rotates with hand
   # through true animation; real mesh occludes behind/against armor.
   rigHand=arm.matrix_world @ hand.matrix
   grip=(rigHand @ Matrix.Translation((0,.06,0))
      @ Matrix.Rotation(-math.pi/2,4,"X")
      @ Matrix.Scale(args.sword_scale,4)
      @ Matrix.Translation((0,0,-.42)))
   for o in sword:o.matrix_world=grip@base[o.name]
   bpy.context.view_layer.update()
   file=out/f"row{direction:02d}_frame{col:02d}.png"
   sc.render.filepath=str(file)
   bpy.ops.render.render(write_still=True)
   assert file.is_file() and file.stat().st_size>512,file
   result.append({"direction":direction,"frameIndex":col,"sourceFrame":frame,
      "bytes":file.stat().st_size})
   print("GRIP_RENDER",direction,col,frame,file.stat().st_size,flush=True)
 (out/"source-review.json").write_text(json.dumps({
  "kind":"Experimental right-hand-bone Sword source render; NOT real in-game",
  "model":"Original owner-supplied Silver Knight A3 roll GLB, not committed",
  "sword":"Original Graphics 3B blacksmith_armory_p0_source.blend; six Sword meshes",
  "swordScale":args.sword_scale,"renderPx":[224,224],"orthoScale":2.3,
  "facingCount":8,"sourceFrames":frames,
  "combatVisualBudgetMs":350,"humanArtApproved":False,
  "serverItemsPresent":False,"realGameplay":False,
  "samples":args.samples,"images":result
 },indent=2)+"\n")
 print("SOURCE_GRIP_DONE",len(result),flush=True)
if __name__=="__main__":run()

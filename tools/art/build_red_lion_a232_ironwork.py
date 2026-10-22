#!/usr/bin/env python3
"""Graphics 3B A2.32: original Blender Red Lion non-roof forged hardware.

Source: frozen original A2.30 *editable* geometry, no procedural substitute.
Author original hand-forged door straps, knocker and window shutter fasteners.
Blender 5.2, deterministic 640 source-pixel Cycles review, no game integration.
"""
import bpy,sys,math,json,hashlib
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
args=sys.argv[sys.argv.index("--")+1:]
out=Path(args[0]).resolve();out.mkdir(parents=True,exist_ok=True)
source=Path(bpy.data.filepath).resolve()
root=Path(args[1]).resolve()
proof=json.loads((root/"assets/environment/greyhaven/a230-review/greyhaven_a230_geometry_proof.json").read_text("utf8"))
digest=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
assert digest(source)==proof["derivedBlenderSha256"]
old_source={o.name:o.hide_render for o in bpy.context.scene.objects if o.type=="MESH"}
oldmesh=[o for o in bpy.context.scene.objects if o.type=="MESH" and (o.name.startswith("Red Lion /") or o.name.startswith("Red Lion A2.1 /") or o.name.startswith("A2.30 facade depth /"))]
assert sum(n.startswith("A2.30 facade depth /") for n in old_source)>=30
iron=bpy.data.materials.get("A2 | forged black iron")
assert iron is not None
prefix="A2.32 wrought fittings / "
details=[]
def bar(name,loc,dim,bevel=.011):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=prefix+name
 o.dimensions=dim;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 o.data.materials.append(iron)
 m=o.modifiers.new("Soft forged edge",type="BEVEL");m.width=bevel;m.segments=2
 bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=m.name)
 o.modifiers.new("Weighted edge normal",type="WEIGHTED_NORMAL")
 details.append(o)
 return o
def rivet(name,xyz,r=.022):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=6,radius=r,location=xyz)
 o=bpy.context.object;o.name=prefix+name;o.data.materials.append(iron);details.append(o)
# Real Red Lion / door_front face is at WORLD Y=-2.030 (Blender A2.30
# source mesh inspected directly), NOT Y=-1.4. Fasteners must physically
# intersect that wood: faceward (negative Y) straps back to -2.0175 (12.5mm
# embedded); barrels cross that face; peens bite into the real iron straps.
DOOR_FACE_Y=-2.030
HINGE_STRAP_Y=DOOR_FACE_Y-.015
HINGE_BARREL_Y=DOOR_FACE_Y-.020
HINGE_PEEN_Y=DOOR_FACE_Y-.045
for label,z in (("lower",.72),("upper",1.88)):
 # Keep original left-edge X, upper/lower Z, width, thickness, and silhouette.
 bar("door hinge strap "+label,(-.36,HINGE_STRAP_Y,z),(.61,.055,.072),.012)
 bar("hinge barrel "+label,(-.70,HINGE_BARREL_Y,z),(.075,.084,.16),.016)
 for i,x in enumerate((-.51,-.32,-.13)):
  rivet("hinge peen "+label+" "+str(i),(x,HINGE_PEEN_Y,z),.018)
# A single forged door pull/knocker on the real door face; XZ plane.
bpy.ops.mesh.primitive_torus_add(major_radius=.112,minor_radius=.017,major_segments=28,minor_segments=8,location=(.29,-1.376,1.37),rotation=(math.pi/2,0,0))
o=bpy.context.object;o.name=prefix+"door knocker ring";o.data.materials.append(iron);details.append(o)
bar("knocker upper plate",(.29,-1.399,1.51),(.17,.055,.11),.018)
for label,cx in (("west",-1.73),("east",1.73)):
 # Original window mullions/shutters are existing 3D geometry.
 for side,offset in (("left",-.405),("right",.405)):
  for level,z in (("lower",1.88),("upper",2.34)):
   bar("shutter corner "+label+" "+side+" "+level,(cx+offset,-1.44,z),(.135,.035,.039),.007)
assert len(details)==20,len(details)
original_source_sha=digest(source)
outblend=out/"red_lion_a232_wrought_ironwork.blend"
bpy.ops.wm.save_as_mainfile(filepath=str(outblend),check_existing=False,compress=True)
assert digest(source)==original_source_sha
scene=bpy.context.scene;scene.render.engine="CYCLES";scene.cycles.device="CPU"
scene.cycles.samples=4;scene.render.film_transparent=True
scene.render.image_settings.file_format="PNG";scene.render.image_settings.color_mode="RGBA"
scene.render.image_settings.color_depth="8"
scene.render.resolution_x=scene.render.resolution_y=640;scene.render.resolution_percentage=100
scene.render.threads_mode="FIXED";scene.render.threads=2
camdata=bpy.data.cameras.new("A2.32 source-XY projection camera")
camera=bpy.data.objects.new("A2.32 source-XY projection camera",camdata);scene.collection.objects.link(camera)
camdata.type="ORTHO";camdata.ortho_scale=640/33.6
camera.location=(0,-1.865,30);camera.rotation_euler=(0,0,0);scene.camera=camera
def deform(v,name):
 lift=.85*max(0,v.z)
 if (name.startswith("Red Lion / roof_") or name.startswith("Red Lion A2.1 / batched individually coloured clay roof tiles") or name=="Red Lion / gables") and v.z>3.45:
  lift=.85*(3.45+.45*(v.z-3.45))
 # The saved editable 3D .blend retains REAL mounted -2.03-door geometry.
 # The existing 2.5D Cycles sprite projection is intentionally flattened:
 # without this render-ONLY compensation, moving the source hinges onto the
 # real 3D door shifts their projected pixels downward behind the wall.
 # Restore source-art visual height and bring hinge silhouettes 8cm inboard.
 # This changes neither the .blend locations nor World collision/portal.
 if name.startswith(prefix):
  part=name[len(prefix):]
  if part.startswith("door hinge strap "):
   return Vector((v.x+.08,v.y-lift+.648,v.z*.05))
  if part.startswith("hinge barrel "):
   return Vector((v.x+.08,v.y-lift+.683,v.z*.05))
  if part.startswith("hinge peen "):
   return Vector((v.x+.08,v.y-lift+.716,v.z*.05))
 return Vector((v.x,v.y-lift,v.z*.05))
for ob in oldmesh+details:
 inv=ob.matrix_world.inverted();ob.data=ob.data.copy()
 for v in ob.data.vertices: v.co=inv@deform(ob.matrix_world@v.co,ob.name)
bpy.context.view_layer.update()
before_hidden=dict(old_source)
render_proof={}
for phase,visible in (("baseline",False),("ironwork",True)):
 for ob in scene.objects:
  if ob.type!="MESH":continue
  ob.hide_render=(
    ob.name.startswith("Red Lion / roof_") or
    ob.name.startswith("Red Lion A2.1 / batched individually coloured clay roof tiles") or
    (ob in oldmesh and before_hidden.get(ob.name,True)) or
    (ob in details and not visible) or
    (ob not in oldmesh and ob not in details))
 path=out/("red_lion_a232_"+phase+"_640.png")
 scene.render.filepath=str(path);bpy.ops.render.render(write_still=True)
 assert path.stat().st_size>2000
 render_proof[phase]={"file":path.name,"bytes":path.stat().st_size,"sha256":digest(path)}
report={"name":"Original 3B A2.32 ironwork","sourceBlend":source.name,"sourceSha256":original_source_sha,
 "sourceUntouched":digest(source)==original_source_sha,"derivedBlend":outblend.name,
 "derivedSha256":digest(outblend),"addedMeshes":len(details),"objectNames":[o.name for o in details],
 "originalNonroofMeshes":len(oldmesh),"roofSourceEdited":False,
 "render640":render_proof,"dayNightOrWorldChanged":False,
 "gameplayGeometryOrPortalChanged":False,"liveGameIntegrated":False,"artApproved":False}
(out/"red_lion_a232_blender_source.json").write_text(json.dumps(report,indent=2)+"\n","utf8")
print("ORIGINAL_3B_A232_IRONWORK="+json.dumps({"addedMeshes":len(details),"render":render_proof,"sourceUnchanged":True}))

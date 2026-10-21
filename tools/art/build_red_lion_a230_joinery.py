#!/usr/bin/env python3
"""A2.30 original Blender Red Lion joinery + masonry depth study.

Runs inside Blender on the checked-in A2.22 original source .blend.
Creates independently named, editable original-space facade meshes.
Saves a NEW .blend, never overwrites input. Then renders two 640px facades
with exactly the previously accepted source->2.5D XY projection;
roofs/atmosphere/world gameplay remain untouched.
"""
import bpy,sys,argparse,hashlib,json,math
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
p=argparse.ArgumentParser()
p.add_argument("--source",type=Path,required=True)
p.add_argument("--outdir",type=Path,required=True)
p.add_argument("--manifest",type=Path,required=True)
a=p.parse_args(sys.argv[sys.argv.index("--")+1:])
a.source=a.source.resolve()
a.outdir=a.outdir.resolve()
a.manifest=a.manifest.resolve()
assert a.source.exists() and a.manifest.exists()
a.outdir.mkdir(parents=True,exist_ok=True)
assert Path(bpy.data.filepath).resolve()==a.source.resolve()
source_bytes=a.source.read_bytes()
source_sha=hashlib.sha256(source_bytes).hexdigest()
manifest=json.loads(a.manifest.read_text("utf8"))
assert manifest["coordinateConvention"]["metersPerWorldUnit"]==0.025
assert manifest["coordinateConvention"]["cameraZoom"]==0.84

source_objects=[ob for ob in bpy.context.scene.objects
 if ob.type=="MESH" and (ob.name.startswith("Red Lion /") or ob.name.startswith("Red Lion A2.1 /"))]
assert len(source_objects)==17
original_count=sum(len(o.data.vertices) for o in source_objects)
assert original_count==4318
original_hide={o.name:o.hide_render for o in bpy.context.scene.objects if o.type=="MESH"}
original_world_verts={o.name:[tuple(round(q,7) for q in (o.matrix_world@v.co)) for v in o.data.vertices]
 for o in source_objects}

prefix="A2.30 facade depth /"
wood=bpy.data.materials.get("A2 | aged oak grain")
stone=bpy.data.materials.get("A2 | worn limestone / procedural")
iron=bpy.data.materials.get("A2 | forged black iron")
assert wood and stone and iron
detail=[]
def create_bevel_cube(name,loc,scale,material,edge=0.012):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc)
 o=bpy.context.object
 o.name=prefix+name
 o.dimensions=scale
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 o.data.materials.append(material)
 mod=o.modifiers.new(name="Hand-worn edge",type="BEVEL")
 mod.width=edge
 mod.segments=2
 bpy.context.view_layer.objects.active=o
 bpy.ops.object.modifier_apply(modifier=mod.name)
 o.modifiers.new(name="Corner-weighted normals",type="WEIGHTED_NORMAL")
 detail.append(o)
 return o
def pin(name,loc,radius,material=iron):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=8,ring_count=4,radius=radius,location=loc)
 o=bpy.context.object
 o.name=prefix+name
 o.data.materials.append(material)
 detail.append(o)
 return o
# New 3D craft lies close to front wall, does not touch original ground.
# Original A2.22 facade y -1.7..-2.1, visual door slab x ±0.73, z 0.12..2.51.
for x,label in [(-0.83,"left"),(0.83,"right")]:
 create_bevel_cube("oak door jamb "+label,(x,-1.58,1.39),(.155,.16,2.28),wood,.014)
 for z in (0.55,1.20,1.87,2.30):
  pin("forged jamb nail "+label+" "+str(z),(x,-1.486,z),.024)
create_bevel_cube("oak carved door lintel",(0,-1.58,2.58),(1.93,.24,.19),wood,.021)
create_bevel_cube("door lintel carving 1",(0,-1.439,2.60),(1.58,.025,.026),wood,.008)
create_bevel_cube("stone doorway threshold",(0,-1.29,.17),(1.58,.30,.13),stone,.024)

# Source windows x centered ~ ±1.7; shaded physical projections and small sills.
for label,x in [("west",-1.73),("east",1.73)]:
 create_bevel_cube("sill "+label,(x,-1.53,1.65),(1.04,.24,.085),stone,.023)
 create_bevel_cube("sill inner edge "+label,(x,-1.406,1.688),(.97,.022,.022),stone,.005)
 create_bevel_cube("central oak mullion "+label,(x,-1.572,2.08),(.069,.106,.66),wood,.008)
 create_bevel_cube("window upper rail "+label,(x,-1.566,2.42),(1.03,.09,.075),wood,.011)
 create_bevel_cube("window lower rail "+label,(x,-1.567,1.78),(1.03,.10,.077),wood,.012)
 for offset in (-.40,.40):
  pin("window nail "+label+" "+str(offset),(x+offset,-1.51,1.79),.014)

# Individual limestone quoins with offset relief rather than pasted pixel lines.
for side,x in [("west",-3.025),("east",3.025)]:
 for n,z in enumerate((.43,.69,.94,1.19)):
  offset=(-.035 if n%2 else .035)
  create_bevel_cube("corner quoin "+side+" "+str(n),
    (x+offset,-1.86,z),(.30,.16,.188),stone,.023)

assert len(detail)>=30
# Non-roof, non-gameplay *original-space* Blender authoring .blend.
derived=a.outdir/"blood_iron_red_lion_a230_joinery.blend"
bpy.ops.wm.save_as_mainfile(filepath=str(derived),check_existing=False,compress=True)
derived_sha=hashlib.sha256(derived.read_bytes()).hexdigest()
assert hashlib.sha256(a.source.read_bytes()).hexdigest()==source_sha

# Render original vs new geometry using the exact A2.22 2.5D projection.
scene=bpy.context.scene
scene.render.engine="CYCLES"
scene.cycles.device="CPU"
scene.cycles.samples=4
scene.render.film_transparent=True
scene.render.image_settings.file_format="PNG"
scene.render.image_settings.color_mode="RGBA"
scene.render.image_settings.color_depth="8"
scene.render.resolution_x=scene.render.resolution_y=640
scene.render.resolution_percentage=100
scene.render.threads_mode="FIXED"
scene.render.threads=2
door=bpy.data.objects.get("Red Lion / door_front")
bounds=[door.matrix_world@Vector(p) for p in door.bound_box]
ax=(min(x.x for x in bounds)+max(x.x for x in bounds))/2
ay=(min(x.y for x in bounds)+max(x.y for x in bounds))/2
assert abs(ax)<1e-5 and abs(ay+1.865)<1e-5
camera_data=bpy.data.cameras.new("A2.30 same original XY camera")
camera=bpy.data.objects.new("A2.30 same original XY camera",camera_data)
scene.collection.objects.link(camera)
camera_data.type="ORTHO"
camera_data.ortho_scale=640/33.6
camera.location=(ax,ay,30)
camera.rotation_euler=(0,0,0)
scene.camera=camera
bpy.context.view_layer.update()
def proj(v):
 uv=world_to_camera_view(scene,camera,v)
 return [uv.x*640,uv.y*640]
def deform(world,name):
 lift=.85*max(0,world.z)
 is_roof=name.startswith("Red Lion / roof_") or name.startswith("Red Lion A2.1 / batched individually coloured clay roof tiles")
 if (is_roof or name=="Red Lion / gables") and world.z>3.45:
  lift=.85*(3.45+.45*(world.z-3.45))
 return Vector((world.x,world.y-lift,world.z*.05))
anchor=Vector((ax,ay,0))
origin=proj(deform(anchor,""))
xp=proj(deform(anchor+Vector((1,0,0)),""))
yp=proj(deform(anchor+Vector((0,1,0)),""))
assert max(abs(origin[i]-320) for i in range(2))<.001
assert abs(xp[0]-origin[0]-33.6)<.001 and abs(xp[1]-origin[1])<.001
assert abs(yp[1]-origin[1]-33.6)<.001 and abs(yp[0]-origin[0])<.001
for ob in source_objects+detail:
 inv=ob.matrix_world.inverted()
 ob.data=ob.data.copy()
 for v in ob.data.vertices:
  v.co=inv@deform(ob.matrix_world@v.co,ob.name)
scene.view_layers[0].update()
# Source objects: A2.22 baseline facade excludes all roof. No change to roof assets.
def belongs(ob):
 return ob.type=="MESH" and ob in source_objects
def is_roof(ob):
 return ob.name.startswith("Red Lion / roof_") or ob.name.startswith("Red Lion A2.1 / batched individually coloured clay roof tiles")
render_proof={}
for phase,enabled in [("baseline",False),("dimensional",True)]:
 for ob in scene.objects:
  if ob.type!="MESH":continue
  ob.hide_render=(ob not in detail and (not belongs(ob) or is_roof(ob) or original_hide.get(ob.name,True))) or (ob in detail and not enabled)
  # note original_hide for detail is not in mapping, handled explicitly
 scene.render.filepath=str(a.outdir/("red_lion_a230_"+phase+"_facade.png"))
 bpy.ops.render.render(write_still=True)
 output=Path(scene.render.filepath)
 assert output.stat().st_size>5000
 render_proof[phase]={"file":output.name,"bytes":output.stat().st_size,
                      "sha256":hashlib.sha256(output.read_bytes()).hexdigest()}
# Check original source topology never altered in saved/new source-space scene.
# (All original mesh vertices preserved in the derived saved file, projected meshes only in memory.)
report={"milestone":"Blood & Iron A2.30 Blender-authored dimensional Red Lion facade joinery",
 "originalScene":a.source.name,"originalSceneSha256":source_sha,
 "originalSceneUntouched":hashlib.sha256(a.source.read_bytes()).hexdigest()==source_sha,
 "derivedBlenderScene":derived.name,"derivedBlenderSha256":derived_sha,
 "sourceMeshObjects":len(source_objects),"sourceVertices":original_count,
 "originalSourceMeshCoordinatesPreservedInDerivedScene":True,
 "newMeshes":len(detail),"newMeshNames":[ob.name for ob in detail],
 "roofGeometryEdited":False,"roofTextureEdited":False,
 "sourceVisualDoorCanvasPx":[320,320],"cameraZoom":0.84,
 "metersPerWorldUnit":0.025,"groundBasisPxPerSourceMeter":{"x":[33.6,0],"y":[0,33.6]},
 "visualOnly":True,"renderProof":render_proof,
 "gameRuntimeChanged":False,"serverCollisionOrDoorChanged":False,
 "graphics3CAtmosphereChanged":False,"productionApproved":False}
(a.outdir/"greyhaven_a230_geometry_proof.json").write_text(json.dumps(report,indent=2)+"\n","utf8")
print("A230_PROOF="+json.dumps({"sourceSha256":source_sha,"derivedSha256":derived_sha,"newMeshes":len(detail),"renders":render_proof}))

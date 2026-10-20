#!/usr/bin/env python3
"""A2.22 visually elevated Red Lion with EXACT ground-world XY screen basis.

Do NOT shear/reproject walkable ground: ground vertices keep native X/Y.
Only elevated (source +Z) art is sheared towards image-top (-Y) under
an exact vertical ortho projection: screen=(x, y - lift*z).
This creates a 2.5D *decorative* facade/roof with game-compatible XY
ground coordinates, not physically accurate eye-level 3D or collision.
Original Blender .blend is only loaded and NEVER saved. Preview only.
"""
import argparse,json,re,sys
from pathlib import Path
import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector

a=argparse.ArgumentParser()
a.add_argument("--scene",type=Path,required=True)
a.add_argument("--manifest",type=Path,required=True)
a.add_argument("--viewport-source",type=Path,required=True)
a.add_argument("--outdir",type=Path,required=True)
a.add_argument("--pixels",type=int,default=640)
a.add_argument("--samples",type=int,default=6)
a.add_argument("--height-lift",type=float,default=.85)
a.add_argument("--roof-pitch-compression",type=float,default=.45)
a.add_argument("--roof-eave-z",type=float,default=3.45)
args=a.parse_args(sys.argv[sys.argv.index("--")+1:])
assert all(x.is_file() for x in [args.scene,args.manifest,args.viewport_source])
assert args.pixels==640 and 4<=args.samples<=16
assert .3<=args.height_lift<=1.25
assert .25<=args.roof_pitch_compression<=.9
assert 3.2<=args.roof_eave_z<=3.55
args.outdir.mkdir(parents=True,exist_ok=True)
manifest=json.loads(args.manifest.read_text(encoding="utf8"))
met=float(manifest["coordinateConvention"]["metersPerWorldUnit"])
source=args.viewport_source.read_text(encoding="utf8")
match=re.search(r"export const ARENA_VIEW_ZOOM\s*=\s*(\d+(?:\.\d+)?)",source)
assert match,"Cannot determine actual browser ARENA_VIEW_ZOOM"
zoom=float(match.group(1))
assert abs(zoom-.84)<1e-8
ppmeter=zoom/met
assert abs(ppmeter-33.6)<1e-8
bpy.ops.wm.open_mainfile(filepath=str(args.scene.resolve()))
scene=bpy.context.scene
scene.render.engine="CYCLES"
scene.cycles.device="CPU"
scene.cycles.samples=args.samples
scene.render.film_transparent=True
scene.render.image_settings.file_format="PNG"
scene.render.image_settings.color_mode="RGBA"
scene.render.image_settings.color_depth="8"
scene.render.resolution_x=scene.render.resolution_y=args.pixels
scene.render.resolution_percentage=100
scene.render.threads_mode="FIXED"
scene.render.threads=2
door=bpy.data.objects.get("Red Lion / door_front")
assert door is not None and door.type=="MESH"
corners=[door.matrix_world @ Vector(v) for v in door.bound_box]
ax=(min(v.x for v in corners)+max(v.x for v in corners))/2
ay=(min(v.y for v in corners)+max(v.y for v in corners))/2
anchor=Vector((ax,ay,0))

camera_data=bpy.data.cameras.new("A2.22 strictly world XY ground camera")
camera=bpy.data.objects.new("A2.22 strictly world XY ground camera",camera_data)
scene.collection.objects.link(camera)
camera_data.type="ORTHO"
camera_data.ortho_scale=args.pixels/ppmeter
camera.location=(ax,ay,30)
camera.rotation_euler=(0,0,0)
scene.camera=camera
bpy.context.view_layer.update()

def px_after_flip(v):
    uv=world_to_camera_view(scene,camera,v)
    return (uv.x*args.pixels,uv.y*args.pixels)
def original_world_to_decorative(world, objname=""):
    # No ground transformation, only elevated facade illustration shearing.
    # Above ground use z; below ground do not push foundation/collision deeper.
    lift=args.height_lift*max(0,world.z)
    is_roof=objname.startswith("Red Lion / roof_") or (
      objname.startswith("Red Lion A2.1 / batched individually coloured clay roof tiles"))
    is_gable=(objname=="Red Lion / gables")
    if (is_roof or is_gable) and world.z>args.roof_eave_z:
        lift=args.height_lift*(args.roof_eave_z+
              args.roof_pitch_compression*(world.z-args.roof_eave_z))
    return Vector((world.x,world.y-lift,world.z*.05))
origin=px_after_flip(original_world_to_decorative(anchor))
xp=px_after_flip(original_world_to_decorative(anchor+Vector((1,0,0))))
yp=px_after_flip(original_world_to_decorative(anchor+Vector((0,1,0))))
zp=px_after_flip(original_world_to_decorative(anchor+Vector((0,0,1))))
basisX=[xp[i]-origin[i] for i in (0,1)]
basisY=[yp[i]-origin[i] for i in (0,1)]
basisZ=[zp[i]-origin[i] for i in (0,1)]
assert max(abs(basisX[0]-ppmeter),abs(basisX[1]),
           abs(basisY[0]),abs(basisY[1]-ppmeter))<.001
assert abs(basisZ[0])<.001
assert abs(basisZ[1]+args.height_lift*ppmeter)<.001
assert max(abs(origin[0]-320),abs(origin[1]-320))<.001

ORIGINAL_HIDE={o.name:o.hide_render for o in scene.objects if o.type=="MESH"}
BARRELS={o.name for o in scene.objects if o.name.startswith("Oak ale barrel /")}
assert len(BARRELS)==7
def belongs(obj):
    return obj.type=="MESH" and (
      obj.name.startswith("Red Lion /") or obj.name.startswith("Red Lion A2.1 /"))
def roof(obj):
    return obj.name.startswith("Red Lion / roof_") or (
      obj.name.startswith("Red Lion A2.1 / batched individually coloured clay roof tiles"))
authored=[obj for obj in list(scene.objects) if belongs(obj)]
assert 10<=len(authored)<=25
original_vertices=sum(len(ob.data.vertices) for ob in authored)
# Use own mesh data in process memory; NEVER save this Blender project.
stats={"sourceMeshObjects":len(authored),"sourceVertices":original_vertices,
       "transformedVertices":0,"groundVerticesUnmoved":0,
       "maxGroundXYDrift":0.0, "roofOrGableVerticesCompressed":0,
       "maxRoofVisualRiseReductionPx":0.0}
for obj in authored:
    inv=obj.matrix_world.inverted()
    original_mesh=obj.data
    obj.data=original_mesh.copy()
    for v in obj.data.vertices:
        world=obj.matrix_world @ v.co
        dest=original_world_to_decorative(world,obj.name)
        if world.z>args.roof_eave_z and (
            roof(obj) or obj.name=="Red Lion / gables"):
            stats["roofOrGableVerticesCompressed"]+=1
            original_rise=args.height_lift*world.z
            new_rise=world.y-dest.y
            stats["maxRoofVisualRiseReductionPx"]=max(
               stats["maxRoofVisualRiseReductionPx"],
               (original_rise-new_rise)*ppmeter)
        v.co=inv @ dest
        stats["transformedVertices"]+=1
        if abs(world.z)<1e-8:
            delta=((dest.x-world.x)**2+(dest.y-world.y)**2)**.5
            stats["maxGroundXYDrift"]=max(stats["maxGroundXYDrift"],delta)
            stats["groundVerticesUnmoved"]+=1
assert stats["transformedVertices"]==original_vertices
assert stats["maxGroundXYDrift"]==0.0
scene.view_layers[0].update()
layers={}
for layer in ["base","roof"]:
    for obj in scene.objects:
        if obj.type!="MESH":continue
        obj.hide_render=ORIGINAL_HIDE.get(obj.name,True) or (
          not belongs(obj)) or (roof(obj)!=(layer=="roof"))
    visible=[ob for ob in scene.objects if ob.type=="MESH" and not ob.hide_render]
    assert 1<=len(visible)<30
    output=args.outdir/("red_lion_a222_"+layer+"_blender.png")
    scene.render.filepath=str(output)
    bpy.ops.render.render(write_still=True)
    assert output.stat().st_size>1000
    layers[layer]={"rawPng":output.name,"bytes":output.stat().st_size,
                   "visibleMeshCount":len(visible)}
for obj in authored:
    obj.hide_render=ORIGINAL_HIDE[obj.name]
report={
  "milestone":"Blood & Iron A2.22 authentic Red Lion XY-grounded decorative facade bake",
  "sourceScene":args.scene.name,
  "sourceSceneSaved":False,
  "canvasPx":[args.pixels,args.pixels],
  "camera":"Exact overhead orthographic, art-only vertical elevation sheared toward image top",
  "sourceGameZoom":zoom,
  "metersPerWorldUnit":met,
  "gamePixelsPerSourceMeter":ppmeter,
  "visualDoorAnchorSourceMeters":[round(ax,5),round(ay,5),0],
  "proposedDoorGameXY":[manifest["firstSlice"]["approvedBuilding"]["door"][k] for k in ("x","y")],
  "visualDoorAnchorPixels":[round(i,6) for i in origin],
  "groundBasisPixelsPerSourceMeter":{"x":[round(i,6) for i in basisX],
                                     "y":[round(i,6) for i in basisY]},
  "decorativeHeightRisePixelsPerSourceMeter":[round(i,6) for i in basisZ],
  "heightLiftFactor":args.height_lift,
  "roofPitchCompression":args.roof_pitch_compression,
  "roofEaveSourceZ":args.roof_eave_z,
  "eavePositionPreserved":True,
  "groundCoordinateInvarianceApprovedForReview":True,
  "verticalDepthScale":.05,
  "geometry":stats,
  "layers":layers,
  "roofOcclusionRuntimeApproved":False,
  "facadeAnatomyOrMaterialClaimsChanged":False,
  "actualAuthoritativeDoorOrCollisionApproved":False,
  "actualNetworkPlayerIntegrationTested":False,
  "gameSourceModified":False,
  "productionApproved":False
}
(args.outdir/"greyhaven_a222_geometry_report.json").write_text(
  json.dumps(report,indent=2,sort_keys=True)+"\n",encoding="utf8")
print("A221_SUMMARY="+json.dumps({
 "groundBasis":report["groundBasisPixelsPerSourceMeter"],
 "heightRise":report["decorativeHeightRisePixelsPerSourceMeter"],
 "geometry":stats,"layers":layers
}))

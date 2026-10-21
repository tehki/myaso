#!/usr/bin/env python3
"""Blood & Iron A2.5: top-down, game-XY-matched Red Lion / Merchant art slices.

The Blender review camera in A2.2 is oblique and cannot be placed in the
flat XY arena. This script creates a truly vertical ORTHO camera at an exact
33.6 physical pixels per authoring meter: 40 world units/m * 0.84 zoom.
Blender's Y is up in the rendered image, so the offline encoder vertically
flips the raw PNG to match the game's positive-Y-down convention.

Review-only source PNGs. Does not save/alter .blend, game renderer, server,
world placements, portals, A3 GLBs, gameplay or any approved asset.
"""
import argparse
import json
import math
import re
import sys
from pathlib import Path

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector

argv=sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
p=argparse.ArgumentParser()
p.add_argument("--scene",type=Path,required=True)
p.add_argument("--manifest",type=Path,required=True)
p.add_argument("--viewport-source",type=Path,required=True)
p.add_argument("--out-dir",type=Path,required=True)
p.add_argument("--samples",type=int,default=4)
p.add_argument("--pixels",type=int,default=640)
args=p.parse_args(argv)
assert all(x.is_file() for x in (args.scene,args.manifest,args.viewport_source))
assert 512<=args.pixels<=1024 and args.pixels%64==0
args.out_dir.mkdir(parents=True,exist_ok=True)
art=json.loads(args.manifest.read_text(encoding="utf8"))
meters_per_unit=float(art["coordinateConvention"]["metersPerWorldUnit"])
source=args.viewport_source.read_text(encoding="utf8")
m=re.search(r"export const ARENA_VIEW_ZOOM\s*=\s*(\d+(?:\.\d+)?)",source)
assert m, "Game arena zoom is not discoverable"
zoom=float(m.group(1))
assert 0<zoom<=1
pixels_per_meter=zoom/meters_per_unit
assert 30<pixels_per_meter<40

bpy.ops.wm.open_mainfile(filepath=str(args.scene.resolve()))
scene=bpy.context.scene
scene.render.engine="CYCLES"
scene.cycles.device="CPU"
scene.cycles.samples=max(4,min(16,args.samples))
scene.render.film_transparent=True
scene.render.image_settings.file_format="PNG"
scene.render.image_settings.color_mode="RGBA"
scene.render.image_settings.color_depth="8"
scene.render.resolution_x=args.pixels
scene.render.resolution_y=args.pixels
scene.render.resolution_percentage=100

bpy.ops.object.camera_add(location=(0,0,30),rotation=(0,0,0))
camera=bpy.context.object
camera.name="A2.5 / game-XY top-down bake (offline only)"
camera.data.type="ORTHO"
camera.data.ortho_scale=args.pixels/pixels_per_meter
scene.camera=camera

def px(v):
    q=world_to_camera_view(scene,camera,v)
    return (q.x*args.pixels,(1-q.y)*args.pixels)

def image_geometry_check(anchor):
    zero=px(anchor)
    x=px(anchor+Vector((1,0,0)))
    y=px(anchor+Vector((0,1,0)))
    x_basis=(x[0]-zero[0], x[1]-zero[1])
    y_basis=(y[0]-zero[0], y[1]-zero[1])
    # After an image-space vertical flip, game X right and Y down both
    # increase by 33.6 pixels per meter; camera is screen-topdown not isometric.
    flipped_x=(x_basis[0],-x_basis[1])
    flipped_y=(y_basis[0],-y_basis[1])
    max_err=max(abs(flipped_x[0]-pixels_per_meter),abs(flipped_x[1]),
                abs(flipped_y[0]),abs(flipped_y[1]-pixels_per_meter))
    assert max_err<.01,(flipped_x,flipped_y,pixels_per_meter)
    return {
        "blenderPixelsPerMeterX":[round(v,6) for v in x_basis],
        "blenderPixelsPerMeterY":[round(v,6) for v in y_basis],
        "gameAlignedPixelsPerMeterXAfterFlip":[round(v,6) for v in flipped_x],
        "gameAlignedPixelsPerMeterYAfterFlip":[round(v,6) for v in flipped_y],
        "maximumBasisErrorPxPerMeter":round(max_err,6),
    }

BUILDINGS=(
    ("red_lion","Red Lion /","Red Lion A2.1 /",
     "Red Lion / door_front",
     [float(art["firstSlice"]["approvedBuilding"]["door"][k]) for k in ("x","y")]),
    ("gable_merchant","Gable Merchant /","Gable Merchant A2.2 /",
     "Gable Merchant / oak door",None),
)
original={ob.name:ob.hide_render for ob in scene.objects if ob.type=="MESH"}
assert len([o for o in scene.objects if o.name.startswith("Oak ale barrel /")])==7

def building_object(ob,key,additional):
    return ob.type=="MESH" and (ob.name.startswith(key) or ob.name.startswith(additional))

def is_roof(ob,kind):
    n=ob.name
    if kind=="red_lion":
        return n.startswith("Red Lion / roof_") or n.startswith(
            "Red Lion A2.1 / batched individually coloured clay roof tiles")
    return (n=="Gable Merchant / roof occlusion" or
            n=="Gable Merchant A2.2 / batched slate roof" or
            n.startswith("Gable Merchant / laid roof courses"))

report={
    "milestone":"Blood & Iron A2.5 offline game-XY camera compatible slice",
    "sourceBlender":args.scene.name,
    "manifest":args.manifest.name,
    "browserSource":args.viewport_source.name,
    "cameraProjection":"vertical orthographic; Blender PNG requires vertical flip",
    "gameZoom":zoom,
    "metersPerWorldUnit":meters_per_unit,
    "gamePixelsPerAuthoringMeter":pixels_per_meter,
    "canvas":[args.pixels,args.pixels],
    "renderEngine":"Cycles CPU",
    "samples":scene.cycles.samples,
    "frameAndPivot": "visual door-ground pixel anchor, NOT authoritative portal or collider",
    "alphaLayerSemantics":"fixed overhead review; no runtime roof fading or sprite depth order",
    "sourceBlenderSaved":False,
    "gameplayModified":False,
    "A3RollModified":False,
    "productionApproved":False,
    "buildings":{},
}
for slug,prefix,additional,door_name,proposed_world_door in BUILDINGS:
    door=bpy.data.objects.get(door_name)
    assert door is not None and door.type=="MESH",door_name
    v=[door.matrix_world @ Vector(corner) for corner in door.bound_box]
    # Camera follows XY of visible 3D door; foot anchor Z=0.
    ax=(min(p.x for p in v)+max(p.x for p in v))/2
    ay=(min(p.y for p in v)+max(p.y for p in v))/2
    anchor=Vector((ax,ay,0))
    camera.location=Vector((ax,ay,30))
    bpy.context.view_layer.update()
    basis=image_geometry_check(anchor)
    raw_pix=px(anchor)
    assert max(abs(raw_pix[0]-args.pixels/2),
               abs(raw_pix[1]-args.pixels/2))<.01
    layer_report={}
    for layer in ("base","roof"):
        for ob in scene.objects:
            if ob.type!="MESH":
                continue
            belongs=building_object(ob,prefix,additional)
            roof=is_roof(ob,slug)
            ob.hide_render=original[ob.name] or (not belongs) or (roof != (layer=="roof"))
        visible=[o.name for o in scene.objects if o.type=="MESH" and not o.hide_render]
        assert visible and len(visible)<35,(slug,layer,visible)
        assert all(building_object(scene.objects[n],prefix,additional) for n in visible)
        assert all(is_roof(scene.objects[n],slug)==(layer=="roof") for n in visible)
        output=args.out_dir/(slug+"_a25_"+layer+"_blender.png")
        scene.render.filepath=str(output)
        bpy.ops.render.render(write_still=True)
        assert output.is_file() and output.stat().st_size>1000,output
        layer_report[layer]={"rawPNG":output.name,"rawPngBytes":output.stat().st_size,
                             "visibleSourceMeshes":len(visible)}
    report["buildings"][slug]={
        "slug":slug,"visualDoorAnchorMeters":[round(ax,5),round(ay,5)],
        "proposedManifestDoorGameXY":proposed_world_door,
        "authoritativeWorldPlacementVerified":False,
        "visualDoorPixelAnchorBeforeFlip":[round(v,3) for v in raw_pix],
        "visualDoorPixelAnchorAfterFlip":[round(raw_pix[0],3),
                                          round(args.pixels-raw_pix[1],3)],
        "basis":basis,"layers":layer_report,
        "browserSpritePivotVerified":False
    }
for ob in scene.objects:
    if ob.type=="MESH":
        ob.hide_render=original[ob.name]
assert all(scene.objects[n].hide_render==v for n,v in original.items())

(args.out_dir/"greyhaven_a25_camera_report.json").write_text(
    json.dumps(report,sort_keys=True,indent=2)+"\n",encoding="utf8")
print("A25_CAMERA_REPORT="+json.dumps(report,sort_keys=True))

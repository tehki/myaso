#!/usr/bin/env python3
"""A2.4: measure Blender ground-plane perspective against actual game XY camera.

Offline diagnostic only. No source .blend save, sprite export, world authority,
combat, A3 roll or browser renderer edits.
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
args=p.parse_args(argv)
for path in (args.scene,args.manifest,args.viewport_source):
    assert path.is_file(),path
args.out_dir.mkdir(parents=True,exist_ok=True)

art=json.loads(args.manifest.read_text(encoding="utf8"))
convention=art["coordinateConvention"]
mscale=float(convention["metersPerWorldUnit"])
assert mscale>0
src=args.viewport_source.read_text(encoding="utf8")
match=re.search(r"export const ARENA_VIEW_ZOOM\s*=\s*(\d+(?:\.\d+)?)",src)
assert match,"Can't derive actual live viewport zoom"
zoom=float(match.group(1))
assert 0<zoom<=1
door_world=art["firstSlice"]["approvedBuilding"]["door"]
door_server=(float(door_world["x"]),float(door_world["y"]))

bpy.ops.wm.open_mainfile(filepath=str(args.scene.resolve()))
scene=bpy.context.scene
camera=bpy.data.objects.get("A2 / street review / 3-4 angle")
door=bpy.data.objects.get("Red Lion / door_front")
assert camera and camera.type=="CAMERA" and camera.data.type=="ORTHO"
assert door and door.type=="MESH"
width,height=1120,720
assert scene.render.resolution_x==width and scene.render.resolution_y==height

verts=[door.matrix_world @ Vector(v) for v in door.bound_box]
xmin,xmax=min(v.x for v in verts),max(v.x for v in verts)
# A1 front (+Y) door plane. Deliberately a *visual* footprint anchor,
# not a claim that portal runtime (PR #336) uses this physical point.
origin=Vector(((xmin+xmax)/2,max(v.y for v in verts),0.0))
assert abs(origin.x)<1 and -3<origin.y<0

def blender_pt(v):
    norm=world_to_camera_view(scene,camera,v)
    return (norm.x*width,(1-norm.y)*height)

def browser_pt(dx,dy):
    # Actual projectArenaPoint: width/2+(gameXY-cameraXY)*zoom.
    # Here compare against a browser camera *centered on the known door*.
    # 1 Blender meter = 1/mscale game-world units, positive Y DOWN.
    wx=door_server[0]+dx/mscale
    wy=door_server[1]+dy/mscale
    return (width/2+(wx-door_server[0])*zoom,
            height/2+(wy-door_server[1])*zoom)

b_anchor=blender_pt(origin)
g_anchor=browser_pt(0,0)
offset=(g_anchor[0]-b_anchor[0],g_anchor[1]-b_anchor[1])
samples=[]
for name,dx,dy in (
  ("door",(0.0),(0.0)),
  ("east-1m",1.0,0.0),
  ("west-1m",-1.0,0.0),
  ("south-1m",0.0,1.0),
  ("north-1m",0.0,-1.0),
  ("southeast-2m",2.0,2.0),
  ("northwest-2m",-2.0,-2.0),
):
    p3=blender_pt(origin+Vector((dx,dy,0)))
    # Align camera origins at door; this removes arbitrary viewport pan
    # but intentionally cannot remove projection skew, yaw or scale.
    aligned=(p3[0]+offset[0],p3[1]+offset[1])
    game=browser_pt(dx,dy)
    err=math.hypot(aligned[0]-game[0],aligned[1]-game[1])
    samples.append({"id":name,"meters":[dx,dy],
      "blenderPixel":[round(x,3) for x in p3],
      "blenderDoorAlignedPixel":[round(x,3) for x in aligned],
      "browserPixel":[round(x,3) for x in game],
      "registrationErrorPx":round(err,3)})

px0=blender_pt(origin)
bx=blender_pt(origin+Vector((1,0,0)))
by=blender_pt(origin+Vector((0,1,0)))
bvecx=(bx[0]-px0[0],bx[1]-px0[1])
bvecy=(by[0]-px0[0],by[1]-px0[1])
dot=bvecx[0]*bvecy[0]+bvecx[1]*bvecy[1]
angle=math.degrees(math.acos(max(-1,min(1,dot/(math.hypot(*bvecx)*math.hypot(*bvecy))))))
errmax=max(s["registrationErrorPx"] for s in samples)
report={
  "milestone":"Blood & Iron A2.4 browser XY vs Blender projection acceptance diagnostic",
  "artOnly":True,"browserRendererModified":False,"productionApproved":False,
  "a22Scene":args.scene.name,
  "viewportSource":args.viewport_source.name,
  "camera":camera.name,
  "blenderOrthographic":True,
  "gameZoom":zoom,
  "gameWorldUnitsPerMeter":1/mscale,
  "expectedGamePixelsPerMeter":zoom/mscale,
  "authoritativeDoorGameXY":[*door_server],
  "visualDoorOriginInBlenderMeters":[round(v,5) for v in origin],
  "browserComparisonViewportPixels":[width,height],
  "blenderBasisPxPerMeterX":[round(v,5) for v in bvecx],
  "blenderBasisPxPerMeterY":[round(v,5) for v in bvecy],
  "blenderGroundAxesAngleDegrees":round(angle,3),
  "doorAlignedSamples":samples,
  "maxSampleErrorPx":round(errmax,3),
  "directSingleLayerPlacementApproved":False,
  "requiresCameraMatchedRerender":True,
  "caveat":"Door world coordinate is from A1 manifest; real game projection assumes screen XY and independent camera. Review sample is not a gameplay portal or an engine registration."
}
# The current oblique Blender camera is mathematically inconsistent with
# unrotated world XY. Never greenlight it by merely moving/scaling the PNG.
assert errmax > 1, "Unexpectedly matched projection: manually verify camera assumptions"
(args.out_dir/"greyhaven_a24_projection_report.json").write_text(
    json.dumps(report,sort_keys=True,indent=2)+"\n",encoding="utf8")
print("A24_PROJECTION_REPORT="+json.dumps(report,sort_keys=True))

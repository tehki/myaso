#!/usr/bin/env python3
"""Real Blender .blend geometry-based Blacksmith R4 occlusion mask.

Builds from actual saved native source mesh via evaluated Blender scene.ray_cast
and orthographic camera. Does not edit any source model, game server or World9.
Saves a single-channel PNG: 0=transparent/missing, 64=walls, 128=foreground,
192=roof. Original pixel colors come exclusively from the approved Blender
render, split by a separate Pillow script for zero-change recomposition.
"""
import argparse
import json
import math
import struct
import sys
import time
import zlib
from pathlib import Path
import bpy
from mathutils import Vector

LABELS={"unknown":0,"walls":64,"foreground":128,"roof":192}
def layer(name):
    if "Roof_RoundTiles" in name or "Prop_Chimney" in name or name.startswith("Smith_RoofChimney_"):
        return "roof"
    if name=="Prop_Crate" or any(name.startswith(s) for s in (
         "Smith_Forge_", "Smith_Anvil_", "Smith_Hearth_", "Smith_Toolbench_",
         "Smith_Hammer_", "Smith_Tongs_", "Smith_IronBillet_", "Smith_ForgingYard_")):
        return "foreground"
    return "walls"

def png_grayscale(file,w,h,rows):
    def chunk(tag,data):
        return struct.pack("!I",len(data))+tag+data+struct.pack("!I",zlib.crc32(tag+data)&0xffffffff)
    ihdr=struct.pack("!2I5B",w,h,8,0,0,0,0)
    body=zlib.compress(b"".join(b"\x00"+row for row in rows),9)
    file.write_bytes(b"\x89PNG\r\n\x1a\n"+chunk(b"IHDR",ihdr)+chunk(b"IDAT",body)+chunk(b"IEND",b""))

def main():
    args=sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
    p=argparse.ArgumentParser()
    p.add_argument("--output",required=True)
    p.add_argument("--stride",type=int,default=1)
    a=p.parse_args(args)
    if a.stride!=1:
        raise ValueError("Final 640×640 geometry mask must have full source pixel resolution")
    sc=bpy.context.scene
    camera=sc.camera
    if not camera or camera.data.type!="ORTHO":
        raise ValueError("Requires actual original Blender R4 orthographic source camera")
    width=sc.render.resolution_x*sc.render.resolution_percentage//100
    height=sc.render.resolution_y*sc.render.resolution_percentage//100
    if [width,height]!=[640,640] or abs(camera.data.ortho_scale-18.0)>0.0001:
        raise ValueError("Source camera or render size drift")
    world=camera.matrix_world.copy()
    frame=camera.data.view_frame(scene=sc)
    xlo,xhi=min(v.x for v in frame),max(v.x for v in frame)
    ylo,yhi=min(v.y for v in frame),max(v.y for v in frame)
    zoff=max(v.z for v in frame)+.5
    direction=(world.to_3x3() @ Vector((0,0,-1))).normalized()
    graph=bpy.context.evaluated_depsgraph_get()
    pngrows=[]
    counts={"unknown":0,"walls":0,"foreground":0,"roof":0}
    count_by_object={}
    started=time.monotonic()
    for y in range(height):
        values=bytearray(width)
        fy=yhi-(y+.5)/height*(yhi-ylo)
        for x in range(width):
            fx=xlo+(x+.5)/width*(xhi-xlo)
            origin=world @ Vector((fx,fy,zoff))
            hit,position,normal,face,obj,matrix=sc.ray_cast(graph,origin,direction,distance=200.0)
            kind=layer(obj.name) if hit and obj is not None else "unknown"
            values[x]=LABELS[kind]
            counts[kind]+=1
            if hit:
                count_by_object[obj.name]=count_by_object.get(obj.name,0)+1
        pngrows.append(bytes(values))
        if y%160==0:
            print("GRAPHICS3B_R4_GENUINE_BLENDER_GEOMETRY_RAYCAST_ROW",y,flush=True)
    if counts["roof"]<1000 or counts["walls"]<1000 or counts["foreground"]<150:
        raise ValueError("Real Blender original building layer coverage not present "+repr(counts))
    output=Path(a.output).resolve()
    output.mkdir(parents=True,exist_ok=True)
    png_grayscale(output/"blacksmith-r4-blender-actual-occlusion-classes.png",width,height,pngrows)
    report={"schema":1,"kind":"graphics3b-native-blender-r4-raycast-occlusion-classes",
       "originalBlenderScene":str(bpy.data.filepath),
       "projection":"true_original_blender_ortho_view_frame",
       "genuineEvaluatedSceneMeshRaycast":True,
       "renderWidth":width,"renderHeight":height,"orthoScale":camera.data.ortho_scale,
       "classValues":LABELS,"counts":counts,"visibleOriginalMeshNames":count_by_object,
       "surfaceRoleSource":"real evaluated Blender geometry, not painted guessed masks",
       "furnitureCollisionNotAuthorized":True,
       "world9BuildingReplacementNotAuthorized":True,
       "fourPlayerOcclusionNotTested":True,
       "defaultOff":True,
       "elapsedSeconds":round(time.monotonic()-started,2)}
    (output/"blacksmith-r4-blender-raycast-report.json").write_text(json.dumps(report,indent=2)+"\n")
    print("GRAPHICS3B_R4_REAL_BLENDER_RAYCAST_MASK_PASS",json.dumps({"counts":counts,"seconds":report["elapsedSeconds"]}),flush=True)
if __name__=="__main__":
    main()

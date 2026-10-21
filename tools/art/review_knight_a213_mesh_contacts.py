#!/usr/bin/env python3
"""A2.13 art-only contact-proxy overlay: lowest skinned foot-region vertices.

Bright green = evaluated foot-weighted mesh minimum, yellow = A2.12 foot-bone
tail, pink cross = unmodified fighter screen origin. No atlas replacement.
"""
import argparse
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

p=argparse.ArgumentParser()
for arg in ("atlas","mesh-report","joint-report","output","qa"):
    p.add_argument("--"+arg,type=Path,required=True)
a=p.parse_args()
mesh=json.loads(a.mesh_report.read_text(encoding="utf8"))
joints=json.loads(a.joint_report.read_text(encoding="utf8"))
assert mesh["clip"]==joints["clip"]
assert mesh["sourceGLBSHA256"]==joints["sourceSha256"]
clip=mesh["clip"]
assert a.atlas.name==clip+".webp"
with Image.open(a.atlas) as source:
    assert source.size==(1280,1280)
    atlas=source.convert("RGBA")
m={(r["direction"],r["atlasColumn"]):r for r in mesh["observations"]}
j={(r["direction"],r["atlasColumn"]):r for r in joints["observations"]}
W,H=8*186,2*220+40
out=Image.new("RGB",(W,H),(33,43,45))
drawer=ImageDraw.Draw(out)
f=ImageFont.load_default()
drawer.text((12,8),clip+" | GREEN = weighted skinned foot mesh min   YELLOW = rig tail   PINK = fighter center",
           fill=(242,230,191),font=f)
near_count=0
samples=[]
for row,direction in enumerate((0,6)):
    for frame in range(8):
        ob=m[(direction,frame)]
        jb=j[(direction,frame)]
        tile=atlas.crop((frame*160,direction*160,frame*160+160,direction*160+160))
        bg=Image.new("RGB",(160,160),(78,88,91))
        bg.paste(tile,(0,0),tile)
        x,y=12+frame*186,42+row*220
        out.paste(bg,(x,y))
        draw=ImageDraw.Draw(out)
        for side in ("LeftFoot","RightFoot"):
            mp=ob["feet"][side]["lowestSkinWeightedVertexProjection"]["sourceFramePx"]
            jp=jb["bones"][side]["tailAtlasFramePx"]
            draw.line((x+mp[0],y+mp[1],x+jp[0],y+jp[1]),fill=(155,171,190),width=1)
            draw.ellipse((x+mp[0]-4,y+mp[1]-4,x+mp[0]+4,y+mp[1]+4),
                         outline=(100,255,137),width=2)
            draw.ellipse((x+jp[0]-2,y+jp[1]-2,x+jp[0]+2,y+jp[1]+2),
                         fill=(255,218,86))
            ix,iy=int(round(mp[0])),int(round(mp[1]))
            near=any(tile.getpixel((xx,yy))[3]>=32
                     for xx in range(max(0,ix-3),min(159,ix+3)+1)
                     for yy in range(max(0,iy-3),min(159,iy+3)+1))
            near_count+=int(near)
            samples.append({
                "direction":direction,"atlasColumn":frame,"side":side,
                "lowestMeshVertexProjectionPx":mp,
                "jointTailProjectionPx":jp,
                "weightedMeshLowestWorldZ":ob["feet"][side]["minimumWorldZ"],
                "relativeClearanceFromFrame1ProxyMeters":
                    ob["feet"][side]["relativeClearanceFromFrame1FootMinMeters"],
                "meshMinimumNearOpaque3px":near
            })
        ox,oy=x+80,y+78*160/134
        draw.line((ox-5,oy,ox+5,oy),fill=(255,111,167),width=2)
        draw.line((ox,oy-5,ox,oy+5),fill=(255,111,167),width=2)
        draw.text((x,y+165),
                  ("SOUTH" if direction==0 else "EAST")+
                  " / f"+str(ob["sourceFrame60fps"]),
                  fill=(237,229,205),font=f)
        draw.text((x,y+182),"relative proxy / no floor",fill=(190,207,210),font=f)
a.output.parent.mkdir(parents=True,exist_ok=True)
out.save(a.output,optimize=True)
assert a.output.stat().st_size>10000
assert len(samples)==32
qa={
 "milestone":"A2.13 skinned foot-region mesh vertex vs skeleton tail overlay",
 "clip":clip,
 "glbSHA256":mesh["sourceGLBSHA256"],
 "atlasFilename":a.atlas.name,
 "spriteAtlasUnmodified":True,
 "overlayImage":a.output.name,
 "reviewDirections":[0,6],
 "framesEachDirection":8,
 "footVertexSampleCount":len(samples),
 "meshLowestVertexNearOpaqueCount":near_count,
 "boneTailIsNotSole":True,
 "weightedMeshLowestIsNotProvenBootSole":True,
 "floorReferenceIsNotAuthoritative":True,
 "gamePivotOrPhysicsModified":False,
 "productionApproved":False,
 "samples":samples
}
a.qa.write_text(json.dumps(qa,indent=2,sort_keys=True)+"\n",encoding="utf8")
print("A213_OVERLAY="+json.dumps({
 "clip":clip,"samples":len(samples),
 "nearOpaque":near_count,"bytes":a.output.stat().st_size
}))

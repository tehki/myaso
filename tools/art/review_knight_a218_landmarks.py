#!/usr/bin/env python3
"""Review-only overlay of original GLB persistent foot-region candidates.

2 rows: south and east directions, 8 original A3 frames per direction.
Circle colors are legend-coded candidate points; magenta cross is the
visual fighter origin. Copies source WebP tiles to PNG without modifying.
"""
import argparse,json
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
p=argparse.ArgumentParser()
for name in ("atlas","report","output","qa"):
    p.add_argument("--"+name,type=Path,required=True)
a=p.parse_args()
r=json.loads(a.report.read_text(encoding="utf8"))
assert r["anatomicalHeelOrOutsoleVerified"] is False
assert a.atlas.name==r["clip"]+".webp"
with Image.open(a.atlas) as raw:
    assert raw.size==(1280,1280)
    atlas=raw.convert("RGBA")
samples={(s["direction"],s["column"]):s for s in r["directionalLandmarks"]}
assert len(samples)==64
width,height=8*186,2*224+54
sheet=Image.new("RGB",(width,height),(32,43,49))
draw=ImageDraw.Draw(sheet)
font=ImageFont.load_default()
legend=[
 ("LeftFoot","heelSide",(80,236,244),"L-heel-side"),
 ("LeftFoot","toeSide",(110,230,130),"L-toe-side"),
 ("RightFoot","heelSide",(255,203,95),"R-heel-side"),
 ("RightFoot","toeSide",(255,125,169),"R-toe-side")
]
xpos=12
for side,landmark,color,label in legend:
    draw.ellipse((xpos,11,xpos+9,20),fill=color)
    draw.text((xpos+13,10),label,fill=(240,232,206),font=font)
    xpos+=180
draw.text((770,11),"PINK CROSS: fixed fighter origin (not sole)",fill=(240,188,205),font=font)
report_samples=[]
near_count=0
outside=0
for row,direction in enumerate((0,6)):
    for col in range(8):
        tile=atlas.crop((col*160,direction*160,
                         col*160+160,direction*160+160))
        back=Image.new("RGB",(160,160),(87,97,97))
        back.paste(tile,(0,0),tile)
        sx,sy=12+col*186,40+row*224
        sheet.paste(back,(sx,sy))
        dr=ImageDraw.Draw(sheet)
        for side,key,color,label in legend:
            point=samples[(direction,col)]["feet"][side][key]
            px,py=point["projection"]["sourceAtlasPx"]
            cx,cy=sx+px,sy+py
            dr.ellipse((cx-4,cy-4,cx+4,cy+4),outline=color,width=2)
            qx,qy=int(round(px)),int(round(py))
            inside=0<=qx<160 and 0<=qy<160
            outside+=int(not inside)
            near=False
            if inside:
                near=any(tile.getpixel((xx,yy))[3]>=32
                       for yy in range(max(0,qy-3),min(159,qy+3)+1)
                       for xx in range(max(0,qx-3),min(159,qx+3)+1))
            near_count+=int(near)
            report_samples.append({
              "direction":direction,"atlasColumn":col,
              "side":side,"candidate":key,
              "sourceVertexIndex":point["vertexIndex"],
              "sourceFramePx":[px,py],
              "insideAtlasFrame":inside,
              "nearOpaquePixelWithin3px":near
            })
        ox,oy=sx+80,sy+78*160/134
        dr.line((ox-6,oy,ox+6,oy),fill=(255,84,185),width=2)
        dr.line((ox,oy-6,ox,oy+6),fill=(255,84,185),width=2)
        dr.text((sx,sy+165),
                ("SOUTH" if direction==0 else "EAST")+
                "  A3 "+str(samples[(direction,col)]["sourceFrame60fps"])+"f",
                fill=(239,222,196),font=font)
        dr.text((sx,sy+182),"CANDIDATES only",fill=(188,204,206),font=font)
assert len(report_samples)==64
a.output.parent.mkdir(parents=True,exist_ok=True)
sheet.save(a.output,optimize=True)
assert a.output.stat().st_size>15000
qa={
 "milestone":"Blood & Iron A2.18 original A3 atlas persistent-candidate inspection",
 "clip":r["clip"],
 "originalGLBSHA256":r["sourceGLBSHA256"],
 "atlasName":a.atlas.name,
 "reviewDirections":[0,6],
 "eightFramesPerDirection":8,
 "candidateMarkers":64,
 "insideImageFrame":64-outside,
 "markersNearOpaqueAtlasPixelsWithin3px":near_count,
 "sourceWebPModified":False,
 "anatomicalOutsoleVerified":False,
 "worldFloorOrPlayerPivotVerified":False,
 "productionApproved":False,
 "samples":report_samples
}
a.qa.write_text(json.dumps(qa,indent=2,sort_keys=True)+"\n",encoding="utf8")
print("A218_OVERLAY="+json.dumps({
 "clip":r["clip"],"markers":len(report_samples),
 "within3px":near_count,"outsideFrame":outside,
 "pngBytes":a.output.stat().st_size
}))

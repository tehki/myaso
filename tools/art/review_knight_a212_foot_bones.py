#!/usr/bin/env python3
"""A2.12 2-row atlas review of actual rig foot head/tail landmarks.

Color key: cyan = ankle/foot bone head, yellow = foot bone tail,
pink cross = fighter world-origin under approved 120% roll draw rectangle.
White/source RGBA = original unmodified A3 atlas pixels.
Review-only annotations are independent output PNG; no WebPs modified.
"""
import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

p=argparse.ArgumentParser()
p.add_argument("--atlas", type=Path, required=True)
p.add_argument("--report", type=Path, required=True)
p.add_argument("--output", type=Path, required=True)
p.add_argument("--qa", type=Path, required=True)
args=p.parse_args()
report=json.loads(args.report.read_text(encoding="utf8"))
assert report["samples"]==64
clip=report["clip"]
assert args.atlas.name==clip+".webp"
with Image.open(args.atlas) as a:
    assert a.size==(1280,1280)
    atlas=a.convert("RGBA")

obs={(entry["direction"],entry["atlasColumn"]):entry
     for entry in report["observations"]}
assert len(obs)==64
font=ImageFont.load_default()
W=8*186
H=2*220+40
result=Image.new("RGB",(W,H),(34,42,45))
d=ImageDraw.Draw(result)
d.text((12,9),f"{clip}  /  A2.12 source joints: CYAN=head YELLOW=tail PINK=world origin",
       fill=(255,240,203),font=font)
origin_source_px=[80,78*160/134]
samples=[]
for row, direction in enumerate((0,6)):
    for frame in range(8):
        r=obs[(direction,frame)]
        tile=atlas.crop((frame*160,direction*160,
                         frame*160+160,direction*160+160))
        # Dark neutral background; preserve the original frame colors.
        backdrop=Image.new("RGB",(160,160),(80,88,90))
        backdrop.paste(tile,(0,0),tile)
        x=12+frame*186
        y=42+row*220
        result.paste(backdrop,(x,y))
        dr=ImageDraw.Draw(result)
        for bone,color in (("LeftFoot",(111,230,250)),("RightFoot",(129,193,251))):
            foot=r["bones"][bone]
            head=foot["headAtlasFramePx"]
            tail=foot["tailAtlasFramePx"]
            hx,hy=x+head[0],y+head[1]
            tx,ty=x+tail[0],y+tail[1]
            dr.line((hx,hy,tx,ty),fill=color,width=2)
            dr.ellipse((hx-4,hy-4,hx+4,hy+4),outline=color,width=2)
            dr.ellipse((tx-4,ty-4,tx+4,ty+4),
                       fill=(255,216,79),outline=(23,34,35),width=1)
            near_opaque=False
            u,v=int(round(tail[0])),int(round(tail[1]))
            if 0<=u<160 and 0<=v<160:
                near_opaque=any(tile.getpixel((uu,vv))[3]>=32
                    for uu in range(max(0,u-3),min(159,u+3)+1)
                    for vv in range(max(0,v-3),min(159,v+3)+1))
            samples.append({
                "direction":direction,"frame":frame,"bone":bone,
                "tailPresentationOffsetPx":foot["tailPresentationOffsetPx"],
                "nearOpaquePixel3pxRadius":near_opaque
            })
        ox,oy=x+origin_source_px[0],y+origin_source_px[1]
        dr.line((ox-5,oy,ox+5,oy),fill=(249,117,155),width=2)
        dr.line((ox,oy-5,ox,oy+5),fill=(249,117,155),width=2)
        dr.text((x,y+166),f"{'SOUTH' if direction==0 else 'EAST'} / {r['sourceFrame60fps']:>2}f",
                fill=(242,227,195),font=font)
        dr.text((x,y+182),"anatomical joint, NOT sole",fill=(184,197,201),font=font)
args.output.parent.mkdir(parents=True,exist_ok=True)
result.save(args.output,optimize=True)
assert args.output.stat().st_size>10000
assert len(samples)==32
q={
 "milestone":"A2.12 authentic A3 rig foot joint review overlay",
 "sourceClip":clip,
 "sourceGLBSHA256":report["sourceSha256"],
 "sourceAtlasFilename":args.atlas.name,
 "visualPreview":args.output.name,
 "frameDirections":[0,6],
 "frameCountPerDirection":8,
 "reviewMarkers":"Cyan bone head, yellow bone tail, pink visual fighter origin",
 "nearOpaqueJointTailCount":sum(x["nearOpaquePixel3pxRadius"] for x in samples),
 "jointTailSampleCount":len(samples),
 "annotationNotActualFootSoleContact":True,
 "originalAtlasModified":False,
 "spritePivotChanged":False,
 "gameCombatChanged":False,
 "productionApproved":False,
 "samples":samples
}
args.qa.write_text(json.dumps(q,indent=2,sort_keys=True)+"\n",encoding="utf8")
print("A212_OVERLAY="+json.dumps({
 "clip":clip,"nearOpaque":q["nearOpaqueJointTailCount"],
 "of":len(samples),"previewBytes":args.output.stat().st_size
}))

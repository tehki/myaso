#!/usr/bin/env python3
"""A2.19: compile original Blender source-geometry review renders into a montage.

Reads nine Workbench render images emitted by inspect_knight_a219_source_landmarks.py.
Source is original GLB (hash in measurement JSON); annotations were created in
temporary Blender memory as independent spheres. Output is NOT a game sprite.
"""
import argparse,json
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
p=argparse.ArgumentParser()
p.add_argument("--clip",choices=["silver_roll","t1_roll"],required=True)
p.add_argument("--source-dir",type=Path,required=True)
p.add_argument("--output",type=Path,required=True)
p.add_argument("--qa",type=Path,required=True)
args=p.parse_args()
measure=json.loads((args.source_dir/(args.clip+"_a219_normals.json")).read_text(encoding="utf8"))
assert measure["sourceGLBBasename"].endswith(".glb")
assert measure["originalSourceFrame60fps"]==[1,7,22]
assert measure["reviewViews"]==["front","side","low"]
font=ImageFont.load_default()
w,h=660,500
margin,header,foot,caption,gap=13,54,30,21,10
sheet=Image.new("RGB",(3*w+4*margin,3*(h+caption)+4*gap+header+foot),(26,34,39))
dr=ImageDraw.Draw(sheet)
dr.text((margin,14),"Blood & Iron A2.19 | "+args.clip+" | ORIGINAL A3 GLB (Workbench close-ups, not sprites)",
        font=font,fill=(250,239,218))
legend=[("LEFT heel-side",(24,235,252)),("LEFT toe-side",(51,232,89)),
        ("RIGHT heel-side",(255,180,28)),("RIGHT toe-side",(255,38,107))]
lx=margin
for text,color in legend:
    dr.ellipse((lx,35,lx+8,43),fill=color)
    dr.text((lx+12,33),text,font=font,fill=(227,229,219))
    lx+=200
file_sizes=[]
for ri,frame in enumerate(measure["originalSourceFrame60fps"]):
    for ci,view in enumerate(measure["reviewViews"]):
        src=args.source_dir/(args.clip+f"_a219_f{frame}_{view}.png")
        assert src.is_file()
        with Image.open(src) as original:
            assert original.size==(w,h)
            shot=original.convert("RGB")
        x=margin+ci*(w+margin)
        y=header+ri*(h+caption+gap)
        sheet.paste(shot,(x,y))
        dr.text((x+8,y+h+4),f"Source frame {frame:02d} / view: {view} / evaluated original foot vertices",
                font=font,fill=(231,216,189))
        file_sizes.append({"name":src.name,"bytes":src.stat().st_size})
dr.text((margin,sheet.height-foot+6),
        "SOURCE LOCAL Z normals != GAME FLOOR CONTACT. 4 markers are REVIEW CANDIDATES, not certified sole points.",
        fill=(240,180,130),font=font)
args.output.parent.mkdir(parents=True,exist_ok=True)
sheet.save(args.output,optimize=True)
assert args.output.stat().st_size>60000
qa={
 "milestone":"Blood & Iron A2.19 original GLB 3D landmark review sheets",
 "clip":args.clip,
 "sourceSHA256":measure["sourceGLBSHA256"],
 "sourceFrame60fps":[1,7,22],
 "views":["front","side","low"],
 "imagesComposited":9,
 "sourceRenderInputs":file_sizes,
 "reviewSheetName":args.output.name,
 "reviewSheetPixels":list(sheet.size),
 "originalModelOrGameSpritesAltered":False,
 "anatomicalSoleApprovalGranted":False,
 "groundPlaneVerified":False,
 "gameplayContactMeasured":False,
 "productionApproved":False
}
args.qa.write_text(json.dumps(qa,indent=2,sort_keys=True)+"\n",encoding="utf8")
print("A219_SHEET="+json.dumps({
 "clip":args.clip,"pixels":list(sheet.size),"bytes":args.output.stat().st_size
}))

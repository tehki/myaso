#!/usr/bin/env python3
"""A2.6 lossless WebP authored billboards, visually anchored, NOT game-XY sprites.

Crops separately rendered base and roof layers without changing camera
orientation. Preserves exact visible RGBA pixels and original per-layer
door-ground pixel offsets. Does not modify any Blender file or game runtime.
"""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image,ImageChops,ImageDraw,ImageStat,features

p=argparse.ArgumentParser()
p.add_argument("--in-dir",type=Path,required=True)
p.add_argument("--padding",type=int,default=2)
a=p.parse_args()
assert 0<=a.padding<=16 and features.check("webp")
raw=a.in_dir/"greyhaven_a26_render_report.json"
assert raw.is_file()
rr=json.loads(raw.read_text(encoding="utf8"))
assert rr["productionApproved"] is False
assert rr["gameXYProjectionMatched"] is False
W,H=rr["canvas"]
assert W==H and W>=512

record={
 "milestone":"Blood & Iron A2.6 visual 3/4 standalone wall+roof WebP study",
 "renderSource":rr["scene"],"canvas":rr["canvas"],
 "sourceCamera":"A2 3/4, per-building centered visual-door-ground point",
 "browserGameXYAligned":False,
 "browserRuntimeIntegrated":False,
 "roofOcclusionValidated":False,
 "productionApproved":False,
 "buildings":{}
}
for slug,building in rr["buildings"].items():
    anchor=building["anchorPixels"]
    assert len(anchor)==2
    source_layers={}
    files={}
    for layer in ("base","roof"):
        src=a.in_dir/(slug+"_a26_"+layer+"_master.png")
        with Image.open(src) as im:
            assert im.mode=="RGBA" and im.size==(W,H)
            rgba=im.copy()
        bbox=rgba.getchannel("A").getbbox()
        assert bbox, f"Empty {slug}/{layer}"
        x0,y0,x1,y1=bbox
        rect=(max(0,x0-a.padding),max(0,y0-a.padding),
              min(W,x1+a.padding),min(H,y1+a.padding))
        piece=rgba.crop(rect)
        out=a.in_dir/(slug+"_a26_"+layer+".webp")
        piece.save(out,format="WEBP",lossless=True,method=6,exact=True)
        with Image.open(out) as decoded:
            restored=Image.new("RGBA",(W,H),(0,0,0,0))
            restored.alpha_composite(decoded.convert("RGBA"),(rect[0],rect[1]))
        original=Image.new("RGBA",(W,H),(0,0,0,0))
        original.alpha_composite(rgba)
        assert ImageChops.difference(restored,original).getbbox() is None
        offset=(rect[0]-anchor[0],rect[1]-anchor[1])
        files[layer]={
         "filename":out.name,"bytes":out.stat().st_size,
         "sha256":hashlib.sha256(out.read_bytes()).hexdigest(),
         "cropPixels":[piece.width,piece.height],
         "cropSourceRect":[*rect],
         "visualDoorAnchorPixelsInCrop":[round(anchor[0]-rect[0],3),
                                         round(anchor[1]-rect[1],3)],
         "drawOffsetPixelsFromVisualDoor":[round(v,3) for v in offset],
         "visiblePixelRoundtrip":True
        }
        source_layers[layer]=original
    combined=Image.alpha_composite(source_layers["base"],source_layers["roof"])
    whole_path=a.in_dir/(slug+"_a26_whole_master.png")
    with Image.open(whole_path) as im:
        whole=im.convert("RGBA")
    difference=ImageChops.difference(whole.convert("RGB"),combined.convert("RGB"))
    opaque_mask=combined.getchannel("A")
    rgb_mae=sum(ImageStat.Stat(difference,mask=opaque_mask).mean)/3
    checker=Image.new("RGB",(W,H),(118,118,118))
    draw=ImageDraw.Draw(checker)
    for y in range(0,H,32):
        for x in range(0,W,32):
            if (x//32+y//32)%2==0:
                draw.rectangle((x,y,min(W-1,x+31),min(H-1,y+31)),
                               fill=(151,151,151))
    checker.paste(combined.convert("RGB"),(0,0),combined.getchannel("A"))
    review=a.in_dir/(slug+"_a26_review.png")
    checker.save(review)
    record["buildings"][slug]={
      "layers":files,"review":review.name,
      "combinedWebPBytes":sum(x["bytes"] for x in files.values()),
      "compositeForegroundRGBMeanAbsoluteErrorVsWholeRender":round(rgb_mae,3),
      "visualDoorAnchorPixel":[*anchor],
      "gameWorldDoorPositionValidated":False,
      "spriteFeetPivotValidatedInBrowser":False
    }
(a.in_dir/"greyhaven_a26_webp_report.json").write_text(
    json.dumps(record,sort_keys=True,indent=2)+"\n",encoding="utf8")
print("A26_WEBP_REPORT="+json.dumps(record,sort_keys=True))

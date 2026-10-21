#!/usr/bin/env python3
"""A2.22 lossless crop/encode XY-grounded decorative Red Lion art.

Original Blender 640x640 PNGs are vertically flipped into game +Y down,
cropped with transparent alpha padding, saved as source-preserving lossless
RGBA WebPs and checked by exact alpha-composite restore. Review only.
"""
import argparse,hashlib,json
from pathlib import Path
from PIL import Image,ImageChops,ImageDraw,features
ap=argparse.ArgumentParser()
ap.add_argument("--in-dir",type=Path,required=True)
ap.add_argument("--padding",type=int,default=3)
a=ap.parse_args()
assert 0<=a.padding<=12 and features.check("webp")
source=json.loads((a.in_dir/"greyhaven_a222_geometry_report.json").read_text(encoding="utf8"))
assert source["productionApproved"] is False
assert source["sourceSceneSaved"] is False
assert source["geometry"]["maxGroundXYDrift"]==0
assert source["canvasPx"]==[640,640]
anchor=source["visualDoorAnchorPixels"]
assert anchor==[320,320]
layers={}
original={}
for part in ("base","roof"):
    name=f"red_lion_a222_{part}_blender.png"
    with Image.open(a.in_dir/name) as image:
        assert image.mode=="RGBA" and image.size==(640,640)
        rgba=image.transpose(Image.Transpose.FLIP_TOP_BOTTOM)
    bounds=rgba.getchannel("A").getbbox()
    assert bounds,(part,"empty original art")
    x0,y0,x1,y1=bounds
    crop=(max(0,x0-a.padding),max(0,y0-a.padding),
          min(640,x1+a.padding),min(640,y1+a.padding))
    pixels=rgba.crop(crop)
    filename=f"red_lion_a222_{part}.webp"
    path=a.in_dir/filename
    pixels.save(path,format="WEBP",lossless=True,method=6,exact=True)
    with Image.open(path) as p:
        recovered=p.convert("RGBA")
    assert recovered.size==pixels.size
    restored=Image.new("RGBA",(640,640))
    restored.alpha_composite(recovered,(crop[0],crop[1]))
    assert ImageChops.difference(restored,rgba).getbbox() is None,part
    assert path.stat().st_size>1000
    original[part]=rgba
    layers[part]={
        "file":filename,"bytes":path.stat().st_size,
        "sha256":hashlib.sha256(path.read_bytes()).hexdigest(),
        "croppedPixels":[pixels.width,pixels.height],
        "drawOffsetFromVisualDoorPixels":[crop[0]-anchor[0],crop[1]-anchor[1]],
        "visualDoorAnchorInCropPixels":[anchor[0]-crop[0],anchor[1]-crop[1]],
        "flippedIntoGamePositiveYDown":True,
        "roundtripExactRGBA":True
    }
bg=Image.new("RGB",(640,640),(107,121,105))
d=ImageDraw.Draw(bg)
for y in range(0,640,32):
    d.line((0,y,639,y),fill=(125,137,122),width=1)
for x in range(0,640,32):
    d.line((x,0,x,639),fill=(125,137,122),width=1)
combined=Image.alpha_composite(original["base"],original["roof"])
bg.paste(combined,(0,0),combined.getchannel("A"))
bg.save(a.in_dir/"red_lion_a222_review.png",optimize=True)
report={
 "milestone":"Blood & Iron A2.22 source-authentic game-XY ground/elevated decorative art",
 "visualDoorPivotPx":anchor,
 "layers":layers,
 "preview":"red_lion_a222_review.png",
 "originalGameGroundBasisPixelsPerMeter":source["groundBasisPixelsPerSourceMeter"],
 "decorativeHeightRisePixelsPerMeter":source["decorativeHeightRisePixelsPerSourceMeter"],
 "originalGroundVerticesMovedXY":False,
 "collisionOrPortalActivated":False,
 "actualGameRenderIntegrated":False,
 "originalSceneOrKnightSourcesChanged":False,
 "productionApproved":False
}
(a.in_dir/"greyhaven_a222_webp_report.json").write_text(
    json.dumps(report,sort_keys=True,indent=2)+"\n",encoding="utf8")
print("A221_WEBP="+json.dumps({
 "baseBytes":layers["base"]["bytes"],
 "roofBytes":layers["roof"]["bytes"],
 "preview":"red_lion_a222_review.png",
 "basePixels":layers["base"]["croppedPixels"],
 "roofPixels":layers["roof"]["croppedPixels"]}))

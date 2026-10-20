#!/usr/bin/env python3
"""A2.4 crop-only roof atlas study; preserves per-pixel alpha, browser disabled.

Requires A2.3 reviewed PNG and lossless WebP. Output includes crop box and
position metadata, not game runtime placement or authoritative geometry.
"""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageChops

p=argparse.ArgumentParser()
p.add_argument("--in-dir",type=Path,required=True)
p.add_argument("--out-dir",type=Path,required=True)
p.add_argument("--padding",type=int,default=2)
args=p.parse_args()
assert 0<=args.padding<=16
args.out_dir.mkdir(parents=True,exist_ok=True)
source=args.in_dir/"greyhaven_a23_roof.webp"
reference_png=args.in_dir/"greyhaven_a23_roof.png"
for f in (source,reference_png):
    assert f.is_file(),f
with Image.open(source) as im:
    full=im.convert("RGBA")
with Image.open(reference_png) as im:
    original=im.convert("RGBA")
assert full.size==original.size==(1120,720)
assert ImageChops.difference(full.getchannel("A"),original.getchannel("A")).getbbox() is None
raw_bbox=full.getchannel("A").getbbox()
assert raw_bbox
x0,y0,x1,y1=raw_bbox
p=args.padding
crop_bbox=(max(0,x0-p),max(0,y0-p),min(full.width,x1+p),min(full.height,y1+p))
assert crop_bbox[2]>crop_bbox[0] and crop_bbox[3]>crop_bbox[1]
cropped=full.crop(crop_bbox)
out=args.out_dir/"greyhaven_a24_roof_cropped.webp"
cropped.save(out,format="WEBP",lossless=True,method=6,exact=True)
with Image.open(out) as decoded:
    rebuilt=Image.new("RGBA",full.size,(0,0,0,0))
    rebuilt.alpha_composite(decoded.convert("RGBA"),(crop_bbox[0],crop_bbox[1]))
    assert ImageChops.difference(rebuilt.getchannel("A"),full.getchannel("A")).getbbox() is None
    # alpha_composite may write different RGB in fully transparent pixels,
    # only opaque/partial visibly covered pixels must be preserved.
    left=Image.new("RGBA",full.size,(0,0,0,0))
    left.alpha_composite(full)
    assert ImageChops.difference(rebuilt,left).getbbox() is None, (
        "Cropping changed composited pixels"
    )

ratio=out.stat().st_size/source.stat().st_size
assert ratio<1, "Cropping did not reduce roof file size"
report={
  "milestone":"Blood & Iron A2.4 cropped lossless roof alpha placement trial",
  "reviewOnly":True,"productionApproved":False,"runtimeIntegrated":False,
  "sourceFile":source.name,"sourceCanvas":[full.width,full.height],
  "originalAlphaBoundingBox":[x0,y0,x1,y1],
  "paddingPixels":p,
  "cropSourceRectPixels":[*crop_bbox],
  "drawOffsetPixels":[crop_bbox[0],crop_bbox[1]],
  "croppedCanvasPixels":[cropped.width,cropped.height],
  "coordinateSpace":"UNSCALED A2.3 Blender review camera pixel frame. NOT game world/camera position",
  "originalWebpBytes":source.stat().st_size,
  "croppedWebpBytes":out.stat().st_size,
  "byteSavings":source.stat().st_size-out.stat().st_size,
  "relativeBytes":round(ratio,6),
  "referenceCanvasPixelRoundtrip":True,
  "croppedWebpSha256":hashlib.sha256(out.read_bytes()).hexdigest(),
  "stableGameWorldPivotValidated":False,
  "roofOcclusionInBrowserValidated":False,
  "alphaOrderingValidatedInGame":False,
  "license":"derived from authored A2.3 roof pass; no external assets"
}
(args.out_dir/"greyhaven_a24_roof_crop_report.json").write_text(
    json.dumps(report,sort_keys=True,indent=2)+"\n",encoding="utf8")
print("A24_CROP_REPORT="+json.dumps(report,sort_keys=True))

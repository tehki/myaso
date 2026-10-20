#!/usr/bin/env python3
"""Convert original A2.3 RGBA PNG layers to deterministic, lossless WebP.

Pillow 12.x. No network. Does NOT change any game client / server / sprite atlas.
Reads PNGs and full A2.2 screenshot only to measure visual layer compositing
mismatch. File-size and transparency metrics are evidence, not FPS claims.

python tools/art/encode_greyhaven_a23_webp.py \
    --in-dir <render-output> \
    --reference <A2.2 street review PNG>
"""
import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageChops, features

p=argparse.ArgumentParser()
p.add_argument("--in-dir",type=Path,required=True)
p.add_argument("--reference",type=Path,required=True)
args=p.parse_args()
assert args.reference.is_file()
assert features.check("webp"),"Pillow needs lossless WebP support"
report_path=args.in_dir/"greyhaven_a23_layer_render_report.json"
assert report_path.is_file()
render_report=json.loads(report_path.read_text(encoding="utf8"))
assert render_report["productionApproved"] is False
expected=tuple(render_report["canvas"])
assert expected==(1120,720)

result={}
images={}
for layer in ("base","roof"):
    png=args.in_dir/("greyhaven_a23_"+layer+".png")
    assert png.is_file()
    with Image.open(png) as im:
        assert im.mode=="RGBA", (layer,im.mode)
        assert im.size==expected,(layer,im.size)
        rgba=im.copy()
    alpha=rgba.getchannel("A")
    bounds=alpha.getbbox()
    assert bounds is not None, f"{layer}: empty transparency layer"
    nzero=alpha.histogram()[0]
    fullopaque=alpha.histogram()[255]
    transparent_fraction=nzero/(expected[0]*expected[1])
    assert .03<transparent_fraction<.99,(layer,transparent_fraction)
    assert fullopaque>0
    webp=args.in_dir/("greyhaven_a23_"+layer+".webp")
    rgba.save(webp,format="WEBP",lossless=True,method=6,exact=True)
    assert webp.stat().st_size>1500
    with Image.open(webp) as decoded:
        assert decoded.size==expected
        assert decoded.mode=="RGBA",decoded.mode
        # Fully transparent pixels may legally hold arbitrary RGB in a PNG,
        # so compare alpha exactly and all non-transparent source pixels.
        assert ImageChops.difference(
            rgba.getchannel("A"),decoded.getchannel("A")
        ).getbbox() is None, f"alpha changed for {layer}"
        visible=Image.new("RGBA",expected,(0,0,0,0))
        visible.paste(rgba,(0,0),alpha)
        actual=Image.new("RGBA",expected,(0,0,0,0))
        actual.paste(decoded,(0,0),alpha)
        assert ImageChops.difference(visible,actual).getbbox() is None, (
            f"visible RGB changed in lossless WebP {layer}"
        )
    result[layer]={
        "sourcePNG":png.name,"sourcePngBytes":png.stat().st_size,
        "webp":webp.name,"losslessWebPBytes":webp.stat().st_size,
        "webpSha256":hashlib.sha256(webp.read_bytes()).hexdigest(),
        "canvas":[*expected],"nonTransparentBounds":list(bounds),
        "transparentFraction":round(transparent_fraction,5),
        "opaquePixels":fullopaque,"losslessVisiblePixelRoundtrip":True
    }
    images[layer]=rgba

composed=Image.alpha_composite(images["base"],images["roof"])
composite_path=args.in_dir/"greyhaven_a23_layer_composite_preview.png"
composed.save(composite_path)
ref=Image.open(args.reference).convert("RGBA")
assert ref.size==expected
from PIL import ImageStat
difference=ImageChops.difference(ref.convert("RGB"),composed.convert("RGB"))
stats=ImageStat.Stat(difference)
mae=sum(stats.mean)/len(stats.mean)
# Compare only pixels covered by the rendered A2.3 world. The full A2.2
# baseline includes an opaque blue-gray sky while the two layers preserve
# transparent sky, so an all-canvas error would overstate art mismatch.
foreground_mask=composed.getchannel("A")
foreground_mae=sum(ImageStat.Stat(difference,mask=foreground_mask).mean)/3
# Checkerboard is a reviewer convenience, never a game sprite/backplate.
checker=Image.new("RGBA",expected,(110,110,110,255))
from PIL import ImageDraw
draw=ImageDraw.Draw(checker)
for y in range(0,expected[1],32):
    for x in range(0,expected[0],32):
        if ((x//32)+(y//32))%2==0:
            draw.rectangle((x,y,min(expected[0]-1,x+31),
                            min(expected[1]-1,y+31)),fill=(155,155,155,255))
checker.alpha_composite(composed)
checker_path=args.in_dir/"greyhaven_a23_checkerboard_preview.png"
checker.convert("RGB").save(checker_path)
# This is a straightforward alpha composite for inspection, NOT a proof that
# the depth-sorted game renderer or its cast shadows produce the same pixels.
report={
 "milestone":"Blood & Iron A2.3 layered WebP measurable offline export",
 "renderSource":render_report["inputScene"],
 "camera":render_report["camera"],
 "canvas":list(expected),
 "webpEncoding":"lossless RGBA WebP; Pillow; no external textures",
 "roofRuntimeEnabled":False,
 "gameClientModified":False,
 "productionApproved":False,
 "geometryPivotsCalibratedToBrowser":False,
 "performanceFPSMeasured":False,
 "layers":result,
 "compositePreview":composite_path.name,
 "checkerboardPreview":checker_path.name,
 "compositeForegroundRGBMeanAbsoluteErrorVsFullRender":round(foreground_mae,3),
 "compositeRGBMeanAbsoluteErrorVsFullRender":round(mae,3),
 "compositingCaveat":"shadow and occlusion differences remain; layer stacking is not pixel-perfect or browser-validated",
 "sourceScenePreserved":True
}
out=args.in_dir/"greyhaven_a23_webp_report.json"
out.write_text(json.dumps(report,sort_keys=True,indent=2)+"\n",encoding="utf8")
print("A23_WEBP_REPORT="+json.dumps(report,sort_keys=True))

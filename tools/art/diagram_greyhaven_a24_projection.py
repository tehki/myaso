#!/usr/bin/env python3
"""A2.4: diagram the alignment error using actual Blender-rendered street PNG.

Yellow dots: ground points rendered by Blender's tilted camera.
Magenta rings: where the real browser's flat XY projectArenaPoint places
the same world positions if both are aligned at Red Lion's doorway.
The image is a diagnostics overlay, NEVER a game texture.
"""
import argparse
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

p=argparse.ArgumentParser()
p.add_argument("--report",type=Path,required=True)
p.add_argument("--street-render",type=Path,required=True)
p.add_argument("--out-dir",type=Path,required=True)
args=p.parse_args()
args.out_dir.mkdir(parents=True,exist_ok=True)
report=json.loads(args.report.read_text(encoding="utf8"))
assert report["directSingleLayerPlacementApproved"] is False
assert report["requiresCameraMatchedRerender"] is True
assert report["gameZoom"]==.84
samples=report["doorAlignedSamples"]
assert len(samples)>=7
with Image.open(args.street_render) as im:
    pic=im.convert("RGB")
w,h=pic.size
assert [w,h]==report["browserComparisonViewportPixels"]
draw=ImageDraw.Draw(pic)
bx,by=samples[0]["blenderPixel"]
for s in samples[1:]:
    act=s["blenderPixel"]
    game=s["browserPixel"]
    # Move browser comparison origin to the real Blender door pixel rather
    # than the center of the screenshot. This isolates projected vectors.
    target=(bx+game[0]-w/2,by+game[1]-h/2)
    draw.line((act[0],act[1],target[0],target[1]),fill=(250,220,65),width=3)
    draw.ellipse((act[0]-5,act[1]-5,act[0]+5,act[1]+5),
                 fill=(255,225,67),outline=(20,20,20),width=2)
    draw.ellipse((target[0]-6,target[1]-6,target[0]+6,target[1]+6),
                 outline=(225,35,172),width=3)
    draw.text((target[0]+8,target[1]+5),
              s["id"]+f" {s['registrationErrorPx']:.1f}px",
              fill=(240,245,250),stroke_width=2,stroke_fill=(22,29,35))
draw.ellipse((bx-6,by-6,bx+6,by+6),fill=(255,255,255),
             outline=(20,20,20),width=2)
draw.rectangle((16,16,624,102),fill=(25,28,32))
draw.text((28,22),"GREYHAVEN A2.4 / PROJECTION TEST",
          fill=(245,245,245))
draw.text((28,47),"Yellow = Blender ground projection | Pink = game XY",
          fill=(244,240,221))
draw.text((28,72),f"Maximum mismatch after door alignment: {report['maxSampleErrorPx']} px",
          fill=(255,218,102))
out=args.out_dir/"greyhaven_a24_projection_mismatch.png"
pic.save(out)
assert out.stat().st_size>10000
print("A24_DIAGNOSTIC="+json.dumps({"preview":out.name,
    "sizeBytes":out.stat().st_size,"samples":len(samples),
    "maxErrorPx":report["maxSampleErrorPx"],"artOnly":True}))

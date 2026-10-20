#!/usr/bin/env python3
"""A2.5 lossless WebP crops from calibrated game-XY overhead Blender stills.

Exports only review stills; no browser sprite initialization or world changes.
The only coordinate conversion is a vertical image flip (+Y down). When later
drawn with the saved per-crop *visual* door anchor, pixels restore exactly.
"""
import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, features

p=argparse.ArgumentParser()
p.add_argument("--in-dir",type=Path,required=True)
p.add_argument("--padding",type=int,default=2)
args=p.parse_args()
assert 0<=args.padding<=16
assert features.check("webp"),"Missing Pillow WebP support"
report_path=args.in_dir/"greyhaven_a25_camera_report.json"
r=json.loads(report_path.read_text(encoding="utf8"))
assert r["gameplayModified"] is False and r["productionApproved"] is False
W,H=r["canvas"]
assert W==H and 512<=W<=1024
result={}
composites={}
for slug,b in r["buildings"].items():
    layers={}
    full_for_composite={}
    for layer in ("base","roof"):
        path=args.in_dir/(slug+"_a25_"+layer+"_blender.png")
        assert path.is_file(),path
        with Image.open(path) as im:
            assert im.mode=="RGBA" and im.size==(W,H)
            # Blender camera screen +Y goes UP; game screen +Y goes DOWN.
            flipped=im.transpose(Image.Transpose.FLIP_TOP_BOTTOM)
        bbox=flipped.getchannel("A").getbbox()
        assert bbox, f"Empty {slug} {layer} slice"
        x0,y0,x1,y1=bbox
        rect=(max(0,x0-args.padding),max(0,y0-args.padding),
              min(W,x1+args.padding),min(H,y1+args.padding))
        cropped=flipped.crop(rect)
        assert cropped.width>16 and cropped.height>16
        dest=args.in_dir/(slug+"_a25_"+layer+".webp")
        cropped.save(dest,format="WEBP",lossless=True,method=6,exact=True)
        assert dest.stat().st_size>500
        with Image.open(dest) as back:
            decoded=back.convert("RGBA")
        restored=Image.new("RGBA",(W,H),(0,0,0,0))
        restored.alpha_composite(decoded,(rect[0],rect[1]))
        benchmark=Image.new("RGBA",(W,H),(0,0,0,0))
        benchmark.alpha_composite(flipped)
        assert ImageChops.difference(restored,benchmark).getbbox() is None, (
            f"RGBA crop roundtrip mismatch for {slug} {layer}"
        )
        anchor=b["visualDoorPixelAnchorAfterFlip"]
        local_anchor=(anchor[0]-rect[0],anchor[1]-rect[1])
        assert all(-2<=v<=max(W,H)+2 for v in local_anchor)
        full_for_composite[layer]=benchmark
        layers[layer]={
            "webp":dest.name,
            "encodedBytes":dest.stat().st_size,
            "sha256":hashlib.sha256(dest.read_bytes()).hexdigest(),
            "croppedPixels":[cropped.width,cropped.height],
            "sourceAlphaBoundsPixels":[*bbox],
            "sourceRectPixels":[*rect],
            "visualDoorAnchorPixelsInCroppedImage":[round(v,3) for v in local_anchor],
            "drawOffsetFromVisualDoorPixels":[round(rect[0]-anchor[0],3),
                                               round(rect[1]-anchor[1],3)],
            "canvasRoundtripExactVisibleRGBA":True,
            "imageFlippedVerticallyForGamePositiveYDown":True,
        }
    composed=Image.alpha_composite(full_for_composite["base"],full_for_composite["roof"])
    checker=Image.new("RGB",(W,H),(136,136,136))
    draw=ImageDraw.Draw(checker)
    for yy in range(0,H,32):
        for xx in range(0,W,32):
            if (xx//32+yy//32)%2==0:
                draw.rectangle((xx,yy,min(W-1,xx+31),min(H-1,yy+31)),
                               fill=(166,166,166))
    checker.paste(composed.convert("RGB"),(0,0),composed.getchannel("A"))
    preview=args.in_dir/(slug+"_a25_review.png")
    checker.save(preview)
    result[slug]={
        "layers":layers,
        "preview":preview.name,
        "combinedLosslessWebpBytes":sum(x["encodedBytes"] for x in layers.values()),
        "visualDoorAnchorOriginPixels":[*b["visualDoorPixelAnchorAfterFlip"]],
        "proposedManifestDoorGameXY":b["proposedManifestDoorGameXY"],
        "gameWorldPlacementApproved":False
    }
out={
    "milestone":"Blood & Iron A2.5 preview-only game-XY calibrated per-building WebPs",
    "renderSource":r["sourceBlender"],
    "gameCameraZoom":r["gameZoom"],
    "pixelsPerAuthoringMeter":r["gamePixelsPerAuthoringMeter"],
    "canvas":r["canvas"],
    "roofOcclusionRuntimeEnabled":False,
    "browserSpritePivotValidated":False,
    "doorPortalAuthorityVerified":False,
    "browserPerformanceMeasured":False,
    "productionApproved":False,
    "encoding":"lossless RGBA WebP; exact alpha composite full-canvas restore",
    "buildings":result,
}
(args.in_dir/"greyhaven_a25_webp_report.json").write_text(
    json.dumps(out,sort_keys=True,indent=2)+"\n",encoding="utf8")
print("A25_WEBP_REPORT="+json.dumps(out,sort_keys=True))

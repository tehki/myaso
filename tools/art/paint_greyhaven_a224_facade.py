#!/usr/bin/env python3
"""A2.24 non-destructive RGB-only Red Lion facade detail pass.

Reads authentic A2.22 Blender-source facade WebP and keeps its *entire*
decoded alpha channel, native cropped bounds, draw offset and game XY basis.
Adds hand-authored shadow, wooden door-jamb relief and subtle structural
highlights to visible original facade pixels. The original WebPs and Blender
scene are never modified. This is appearance art, not geometry or collision.
"""
import argparse, hashlib, json
from pathlib import Path
from PIL import Image, ImageDraw, ImageChops, ImageStat

arg = argparse.ArgumentParser()
arg.add_argument("--source-dir",type=Path,required=True)
arg.add_argument("--outdir",type=Path,required=True)
a=arg.parse_args()
a.outdir.mkdir(parents=True,exist_ok=True)
src=json.loads((a.source_dir/"greyhaven_a222_webp_report.json").read_text("utf8"))
geo=json.loads((a.source_dir/"greyhaven_a222_geometry_report.json").read_text("utf8"))
assert src["productionApproved"] is False and geo["productionApproved"] is False
assert geo["geometry"]["maxGroundXYDrift"]==0
assert geo["groundBasisPixelsPerSourceMeter"]=={
 "x":[33.600006,0.0],"y":[0.0,33.600006]}
assert src["visualDoorPivotPx"]==[320,320]
def restore(part):
    data=src["layers"][part]
    with Image.open(a.source_dir/data["file"]) as f: crop=f.convert("RGBA")
    assert list(crop.size)==data["croppedPixels"]
    ox,oy=data["drawOffsetFromVisualDoorPixels"]
    dest=Image.new("RGBA",(640,640))
    dest.alpha_composite(crop,(320+round(ox),320+round(oy)))
    return dest
base=restore("base")
roof=restore("roof")
original_alpha=base.getchannel("A")
original_bbox=original_alpha.getbbox()
assert original_bbox and original_bbox[0]<240 and original_bbox[2]>400
# The source-only overlay is drawn in visual-door-centered 640×640 pixels.
# Every addition is clipped to the original imported building silhouette.
paint=Image.new("RGBA",(640,640))
p=ImageDraw.Draw(paint)
# Eave soffit/beam shadow: a shallow graded shadow below the RED LION roof.
for row in range(226,241):
    p.line((209,row,432,row),fill=(26,19,17,max(0,round(79*(241-row)/15))),width=1)
# Structural horizontal timber beam shadow + a warm edge catchlight.
p.line((211,277,296,277),fill=(35,23,15,70),width=3)
p.line((345,277,430,277),fill=(35,23,15,70),width=3)
p.line((211,273,296,273),fill=(249,199,129,40),width=1)
p.line((345,273,430,273),fill=(249,199,129,40),width=1)
p.line((211,303,296,303),fill=(40,27,18,52),width=3)
p.line((345,303,430,303),fill=(40,27,18,52),width=3)
p.line((211,309,296,309),fill=(248,207,156,37),width=1)
p.line((345,309,430,309),fill=(248,207,156,37),width=1)
# Recessed original door: relief along the actual source-authored door
# panel inside 296..343 x, 255..310 y. Do not draw a new doorway/portal.
p.rectangle((298,255,341,307),fill=(48,32,24,35))
for x,op in ((300,91),(301,72),(302,48),(336,48),(338,69),(340,91)):
    p.line((x,257,x,307),fill=(40,26,18,op),width=1)
p.line((301,255,340,255),fill=(25,18,13,100),width=3)
p.line((302,309,340,309),fill=(44,27,18,64),width=3)
p.line((302,261,302,305),fill=(244,191,118,38),width=1)
p.line((335,260,335,305),fill=(253,208,146,42),width=1)
# Subtle wooden planks: darker knots and warm seam, avoiding modern outlines.
for x in (313,324,334):
    p.line((x,263,x-1,303),fill=(47,31,20,44),width=1)
    p.line((x+1,263,x,302),fill=(233,187,125,23),width=1)
# Two deliberately small dark forged hinge hints, all within original door.
for y in (275,295):
    p.line((303,y,311,y),fill=(35,39,36,115),width=2)
    p.ellipse((305,y-1,307,y+1),fill=(151,123,92,85))
# Narrow inset window reveals and short sill shadows; do not overwrite panes.
for x0,x1 in ((248,277),(357,386)):
    p.line((x0,257,x0,283),fill=(48,33,26,77),width=2)
    p.line((x0+1,283,x1-1,283),fill=(43,30,22,72),width=2)
    p.line((x0+2,255,x1-2,255),fill=(247,210,156,44),width=1)
    p.line((x0+1,284,x1+3,284),fill=(34,26,17,59),width=2)
# Source facade's stone plinth and original grey doorstep gain contact depth.
p.line((214,314,431,314),fill=(52,46,37,43),width=2)
p.line((296,320,346,320),fill=(31,31,27,80),width=2)
p.line((299,323,344,323),fill=(240,220,172,41),width=1)
# Respect original authored silhouette and antialiased alpha, exactly.
composed=Image.alpha_composite(base,paint)
composed.putalpha(original_alpha)
assert ImageChops.difference(composed.getchannel("A"),original_alpha).getbbox() is None
assert composed.getchannel("A").getbbox()==original_bbox
difference=ImageChops.difference(composed.convert("RGB"),base.convert("RGB"))
bbox=difference.getbbox()
assert bbox and bbox[0]>=200 and bbox[1]>=220 and bbox[2]<=440 and bbox[3]<=335
changed_pixels=sum(1 for px in difference.getdata() if any(px))
assert 1200<changed_pixels<35000, changed_pixels
info=src["layers"]["base"]
with Image.open(a.source_dir/info["file"]) as img:assert img.size==tuple(info["croppedPixels"])
ox,oy=map(round,info["drawOffsetFromVisualDoorPixels"])
crop=(320+ox,320+oy,320+ox+info["croppedPixels"][0],
      320+oy+info["croppedPixels"][1])
outcrop=composed.crop(crop)
base_name="red_lion_a224_base.webp"
outcrop.save(a.outdir/base_name,"WEBP",lossless=True,method=6,exact=True)
with Image.open(a.outdir/base_name) as im:roundtrip=im.convert("RGBA")
assert ImageChops.difference(outcrop,roundtrip).getbbox() is None
# Roof stays binary identical, preserving every original clay roof tile.
roof_source=(a.source_dir/src["layers"]["roof"]["file"]).read_bytes()
roof_name="red_lion_a224_roof.webp"
(a.outdir/roof_name).write_bytes(roof_source)
assert (a.outdir/roof_name).read_bytes()==roof_source
def sha(b):return hashlib.sha256(b).hexdigest()
preview=Image.new("RGB",(1300,690),(39,52,43))
for i,pic in enumerate((base,composed)):
    frame=Image.new("RGB",(640,640),(106,121,103))
    dr=ImageDraw.Draw(frame)
    for k in range(0,640,32):
        dr.line((k,0,k,639),fill=(126,137,120))
        dr.line((0,k,639,k),fill=(126,137,120))
    frame.paste(pic,(0,0),pic.getchannel("A"))
    # Identical authentic roof at 55% opacity for unobstructed facade review.
    rf=roof.copy()
    rf.putalpha(roof.getchannel("A").point(lambda x:round(x*.55)))
    frame.paste(rf,(0,0),rf.getchannel("A"))
    preview.paste(frame,(10+650*i,35))
draw=ImageDraw.Draw(preview)
draw.text((17,11),"A2.22 original facade",fill=(250,219,165))
draw.text((665,11),"A2.24 relief & shadow polish (identical geometry)",fill=(250,219,165))
draw.text((12,675),"Art-only Red Lion comparison. Original XY/alpha/door silhouette untouched. Roof original; not an active portal.",fill=(234,196,151))
picture="greyhaven_a224_facade_before_after.png"
preview.save(a.outdir/picture,optimize=True)
assert (a.outdir/picture).stat().st_size>25000
report={
 "milestone":"Blood & Iron A2.24 native Red Lion facade RGB shading polish",
 "sourceBaseline":"A2.22 original Blender Red Lion",
 "sourceArtSceneSaved":False,
 "originalA222BaseSha256":src["layers"]["base"]["sha256"],
 "originalA222RoofSha256":src["layers"]["roof"]["sha256"],
 "newBaseSha256":sha((a.outdir/base_name).read_bytes()),
 "newRoofSha256":sha((a.outdir/roof_name).read_bytes()),
 "roofBinaryIdenticalToA222":True,
 "visualDoorPivotPx":[320,320],
 "groundBasisPixelsPerSourceMeter":geo["groundBasisPixelsPerSourceMeter"],
 "gameViewZoom":geo["sourceGameZoom"],
 "originalFacadeAlphaBounds":list(original_bbox),
 "newFacadeAlphaBounds":list(composed.getchannel("A").getbbox()),
 "newFacadeAlphaChannelIdentical":True,
 "doorAndRoofOutlineModified":False,
 "originalFacePixelColorsChanged":changed_pixels,
 "sourceReviewDifferenceBounds":list(bbox),
 "originalBaseDrawOffsetFromVisualDoorPixels":info["drawOffsetFromVisualDoorPixels"],
 "newBaseDrawOffsetFromVisualDoorPixels":info["drawOffsetFromVisualDoorPixels"],
 "sourceBaseCropPixels":info["croppedPixels"],
 "newBaseCropPixels":list(outcrop.size),
 "losslessBaseRoundtrip":True,
 "roofByteLength":len(roof_source),
 "newBaseByteLength":(a.outdir/base_name).stat().st_size,
 "imageFiles":{"base":base_name,"roof":roof_name,"preview":picture},
 "serverAuthoritativePortalOrCollisionChanged":False,
 "gameRuntimeOrMultiplayerModified":False,
 "originalKnightsModified":False,
 "productionApproved":False
}
(a.outdir/"greyhaven_a224_facade_report.json").write_text(
 json.dumps(report,indent=2,sort_keys=True)+"\n",encoding="utf8")
print("A224="+json.dumps({"pixelsChanged":changed_pixels,
 "alphaUnchanged":True,"roofBinaryUnchanged":True,"baseBytes":report["newBaseByteLength"],
 "differenceBox":bbox,"preview":picture}))

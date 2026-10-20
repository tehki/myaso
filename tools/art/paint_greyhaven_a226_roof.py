#!/usr/bin/env python3
"""A2.26 non-destructive, source-mask-preserving Red Lion clay-roof weathering.

Input: exact checked-in A2.24 Blender-derived roof/facade rasters and A2.25
architecture handoff. RGB-only shading adjusts roof clay tile appearance;
neither original raster, alpha silhouette, doorway, world XY, source .blend,
nor multiplayer / game renderer is changed.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw

parser = argparse.ArgumentParser()
parser.add_argument("--repo", type=Path, default=Path(__file__).resolve().parents[2])
args = parser.parse_args()
root = args.repo
assets = root / "assets/environment/greyhaven"
out = assets / "a226-review"
out.mkdir(parents=True, exist_ok=True)

contract = json.loads((assets / "red-lion-a225-architecture-handoff.json").read_text("utf-8"))
assert contract["status"] == "unapproved-art-review"
assert contract["projection"]["visualDoorCanvasPx"] == [320, 320]
assert contract["projection"]["groundBasisPixelsPerSourceMeter"] == {
    "x": [33.600006, 0], "y": [0, 33.600006]}
assert contract["integrationGate"]["productionApproved"] is False

def digest(data):
    return hashlib.sha256(data).hexdigest()

def source(part):
    meta = contract["rasterLayers"][part]
    path = root / meta["file"]
    raw = path.read_bytes()
    assert digest(raw) == meta["sha256"], part
    with Image.open(path) as opened:
        im = opened.convert("RGBA")
    assert list(im.size) == meta["croppedPixels"]
    return im, raw, meta

roof, original_roof_bytes, roof_metadata = source("roof")
base, original_base_bytes, base_metadata = source("base")
original_alpha = roof.getchannel("A")
assert original_alpha.getbbox() == (3, 3, 235, 194)

# A muted weathered-clay treatment: restrained tonal variation by tile position,
# ridge light, and an eave contact shadow. All adjustments are bounded RGB
# changes on the true source-authored roof pixels; no geometry or new silhouette.
width, height = roof.size
original_pixels = list(roof.get_flattened_data())
new_pixels = []
rgb_error_sum = 0
changed_visible = 0
max_delta = 0
for idx, (r, g, b, alpha) in enumerate(original_pixels):
    x, y = idx % width, idx // width
    if alpha == 0:
        new_pixels.append((r, g, b, alpha))
        continue
    fraction = max(0.0, min(1.0, (y-3) / (height-6)))
    # Periodic but non-gridlike earthy variations, no stochastic randomness.
    patina = 2.7 * math.sin(x*0.117+y*0.036) + 2.2*math.sin(y*0.132-x*0.071)
    # Upper ridge reads slightly sun-worn, lower eave has real shaded depth.
    ridge_light = max(0.0, 1.0 - abs(y-21)/29.0)*3.5
    eave_shadow = max(0.0, (fraction-0.70)/0.30)**1.4 * 8.0
    delta = -3.0 + patina + ridge_light - eave_shadow
    # A tiny warm/cool clay variation; all three channels stay near the source.
    channel_deltas = (delta+0.9, delta-0.5, delta-1.4)
    newer = tuple(max(0, min(255, round(v+d))) for v, d in zip((r, g, b), channel_deltas))
    new_pixels.append((*newer, alpha))
    diff = [abs(v-w) for v, w in zip((r,g,b), newer)]
    rgb_error_sum += sum(diff)
    max_delta = max(max_delta, *diff)
    if any(diff):
        changed_visible += 1

result = Image.new("RGBA", roof.size)
result.putdata(new_pixels)
assert ImageChops.difference(result.getchannel("A"), original_alpha).getbbox() is None
assert result.getchannel("A").getbbox() == roof.getchannel("A").getbbox()
assert changed_visible > 20000, changed_visible
assert max_delta <= 20, max_delta
average_delta = rgb_error_sum / (3*sum(px[3] > 0 for px in original_pixels))
assert 1 < average_delta < 11, average_delta

roof_name = "red_lion_a226_roof.webp"
base_name = "red_lion_a226_base.webp"
roof_path = out / roof_name
base_path = out / base_name
result.save(roof_path, format="WEBP", lossless=True, method=6, exact=True)
with Image.open(roof_path) as opened:
    decoded = opened.convert("RGBA")
assert ImageChops.difference(decoded, result).getbbox() is None
base_path.write_bytes(original_base_bytes)
assert base_path.read_bytes() == original_base_bytes

def restore(im, meta):
    output = Image.new("RGBA", (640, 640))
    x, y = meta["drawOffsetFromVisualDoorPixels"]
    output.alpha_composite(im, (320+round(x), 320+round(y)))
    return output

def composite(the_roof):
    frame = Image.new("RGB", (640, 640), (104, 115, 100))
    grid = ImageDraw.Draw(frame)
    for n in range(0,640,32):
        grid.line((n,0,n,639),fill=(125,136,120))
        grid.line((0,n,639,n),fill=(125,136,120))
    for layer,meta in ((base,base_metadata),(the_roof,roof_metadata)):
        placed = restore(layer,meta)
        frame.paste(placed, (0,0), placed.getchannel("A"))
    return frame

preview=Image.new("RGB", (1300,690), (39,48,43))
preview.paste(composite(roof), (10,34))
preview.paste(composite(result), (660,34))
draw=ImageDraw.Draw(preview)
draw.text((18,11),"A2.24 original Red Lion clay roof",fill=(247,222,177))
draw.text((666,11),"A2.26 weathered roof (identical alpha, silhouette, facade)",fill=(247,222,177))
draw.text((12,675),"Art-only original source render. Door/world XY untouched; no multiplayer roof-occlusion claim.",fill=(237,209,166))
preview_name="greyhaven_a226_roof_weathering_comparison.png"
preview.save(out/preview_name,optimize=True)

report={
 "milestone":"Blood & Iron A2.26 original Red Lion clay roof weathering",
 "sourceHead":contract["provenance"]["graphicsBaseCommit"],
 "sourceRoofSha256":roof_metadata["sha256"],
 "sourceBaseSha256":base_metadata["sha256"],
 "newRoofSha256":digest(roof_path.read_bytes()),
 "newBaseSha256":digest(base_path.read_bytes()),
 "baseBinaryIdenticalToA224":True,
 "roofAlphaPixelDifferences":0,
 "roofAlphaBBoxCropPx":list(original_alpha.getbbox()),
 "roofDimensionsCropPx":list(result.size),
 "roofPixelsChangedRGB":changed_visible,
 "roofMaxChannelDelta":max_delta,
 "roofMeanAbsoluteChannelDelta":round(average_delta,4),
 "roofLosslessRoundtripRGBA":True,
 "groundBasisPixelsPerSourceMeter":contract["projection"]["groundBasisPixelsPerSourceMeter"],
 "visualDoorCanvasPx":contract["projection"]["visualDoorCanvasPx"],
 "layers":{
  "base":{"file":base_name,"sha256":digest(base_path.read_bytes()),
          "drawOffsetFromVisualDoorPixels":base_metadata["drawOffsetFromVisualDoorPixels"],
          "croppedPixels":base_metadata["croppedPixels"]},
  "roof":{"file":roof_name,"sha256":digest(roof_path.read_bytes()),
          "drawOffsetFromVisualDoorPixels":roof_metadata["drawOffsetFromVisualDoorPixels"],
          "croppedPixels":roof_metadata["croppedPixels"]}},
 "preview":preview_name,
 "originalBlenderOrKnightSourcesModified":False,
 "geometrySilhouetteOrGameXYModified":False,
 "automaticRoofOcclusionImplemented":False,
 "gameRuntimeOrNetworkModified":False,
 "serverAuthoritativePortalOrCollisionChanged":False,
 "productionApproved":False
}
(out/"greyhaven_a226_weathering_report.json").write_text(json.dumps(report,indent=2,sort_keys=True)+"\n","utf-8")
print(json.dumps({"changedRoofPixels":changed_visible,
                  "meanRGBDelta":report["roofMeanAbsoluteChannelDelta"],
                  "maxDelta":max_delta,"roofSha256":report["newRoofSha256"],
                  "preview":str(out/preview_name)}))

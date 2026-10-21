#!/usr/bin/env python3
"""A2.30 quantify original Blender-to-Blender facade geometry, export review WebP."""
import hashlib,json,argparse
from pathlib import Path
from PIL import Image,ImageDraw,ImageChops
p=argparse.ArgumentParser()
p.add_argument("--repo",type=Path,default=Path(__file__).resolve().parents[2])
a=p.parse_args()
root=a.repo.resolve()
assets=root/"assets/environment/greyhaven"
dir=assets/"a230-review"
report=json.loads((dir/"greyhaven_a230_geometry_proof.json").read_text("utf8"))
handoff=json.loads((assets/"red-lion-a225-architecture-handoff.json").read_text("utf8"))
r225=handoff["rasterLayers"]
r226=json.loads((assets/"a226-review/greyhaven_a226_weathering_report.json").read_text("utf8"))
def sha(data):return hashlib.sha256(data).hexdigest()
def getimage(file,hash0):
    path=dir/file
    assert sha(path.read_bytes())==hash0
    with Image.open(path) as img:return img.convert("RGBA")
before=getimage(**{"file":report["renderProof"]["baseline"]["file"],
                   "hash0":report["renderProof"]["baseline"]["sha256"]})
after=getimage(**{"file":report["renderProof"]["dimensional"]["file"],
                  "hash0":report["renderProof"]["dimensional"]["sha256"]})
assert before.size==after.size==(640,640)
# Blender PNG writes bottom-up world image; A2.22 WebPs deliberately flip to
# positive-down game canvas. Apply that same documented flip before cropping.
before=before.transpose(Image.Transpose.FLIP_TOP_BOTTOM)
after=after.transpose(Image.Transpose.FLIP_TOP_BOTTOM)
a0,b0=before.getchannel("A"),after.getchannel("A")
old_bounds=a0.getbbox()
new_bounds=b0.getbbox()
assert old_bounds is not None and new_bounds is not None
rgba_a=list(before.get_flattened_data())
rgba_b=list(after.get_flattened_data())
n_rgb=sum(any(x[i]!=y[i] for i in range(3)) for x,y in zip(rgba_a,rgba_b))
n_alpha=sum(x[3]!=y[3] for x,y in zip(rgba_a,rgba_b))
n_added=sum(x[3]==0 and y[3]>0 for x,y in zip(rgba_a,rgba_b))
assert 300<n_rgb<45000,n_rgb
assert n_alpha<5000,n_alpha
# Previously source-authored original crop/door pivot stays fixed; any new relief
# must remain inside the original facade drawing footprint.
meta=r225["base"]
ox,oy=[320+round(x) for x in meta["drawOffsetFromVisualDoorPixels"]]
w,h=meta["croppedPixels"]
assert ox==206 and oy==51 and [w,h]==[228,297]
assert new_bounds[0]>=ox and new_bounds[1]>=oy
assert new_bounds[2]<=ox+w and new_bounds[3]<=oy+h,(new_bounds,[ox,oy,w,h])
original_crop=before.crop((ox,oy,ox+w,oy+h))
source_export=dir/"red_lion_a230_original_base.webp"
original_crop.save(source_export,"WEBP",lossless=True,exact=True,method=6)
with Image.open(source_export) as img:check_original=img.convert("RGBA")
assert ImageChops.difference(check_original,original_crop).getbbox() is None
cropped=after.crop((ox,oy,ox+w,oy+h))
webp=dir/"red_lion_a230_dimensional_base.webp"
cropped.save(webp,"WEBP",lossless=True,exact=True,method=6)
with Image.open(webp) as img:restored=img.convert("RGBA")
assert ImageChops.difference(restored,cropped).getbbox() is None
roof_path=assets/"a226-review/red_lion_a226_roof.webp"
assert sha(roof_path.read_bytes())==r226["newRoofSha256"]
# Copy roof bytes only to support a standalone review, *no design iteration*.
roof_copy=dir/"red_lion_a230_roof_unchanged.webp"
roof_copy.write_bytes(roof_path.read_bytes())
assert roof_copy.read_bytes()==roof_path.read_bytes()
# Genuine Blender-rendered original vs derived facade at exact screen-XY projection.
preview=Image.new("RGB",(1300,690),(39,48,43))
for k,(name,img) in enumerate((("ORIGINAL A2.22 Blender facade",before),
                                ("A2.30 new 3D joinery and limestone",after))):
    frame=Image.new("RGB",(640,640),(103,119,105))
    frame.paste(img,(0,0),img.getchannel("A"))
    preview.paste(frame,(10+k*650,34))
    ImageDraw.Draw(preview).text((14+k*650,9),name,fill=(255,222,181))
ImageDraw.Draw(preview).text((13,672),
  "Real Cycles source-model renders; geometry is decorative 2.5D art, never an authoritative doorway/collider.",
  fill=(237,213,168))
preview_file=dir/"greyhaven_a230_blender_dimensional_compare.png"
preview.save(preview_file,optimize=True)
proof={"milestone":"A2.30 real original Blender mesh joinery source/render acceptance",
 "sourceBlendSha256":report["originalSceneSha256"],
 "derivedBlendSha256":report["derivedBlenderSha256"],
 "newMeshCount":report["newMeshes"],
 "sourceMeshCount":report["sourceMeshObjects"],
 "originalSourceVertices":report["sourceVertices"],
 "sourceBlendUntouched":report["originalSceneUntouched"],
 "beforeAlphaBounds":list(old_bounds),"afterAlphaBounds":list(new_bounds),
 "changedRGBAVisiblePixels":n_rgb,"alphaPixelsChanged":n_alpha,
 "newOutsideOldAlphaPixels":n_added,
 "baselineWebp":{"file":source_export.name,"sha256":sha(source_export.read_bytes()),
                 "bytes":source_export.stat().st_size,"losslessRoundtrip":True},
 "baseWebp":{"file":webp.name,"bytes":webp.stat().st_size,
             "sha256":sha(webp.read_bytes()),"crop":[w,h],
             "drawOffsetFromDoorPixels":meta["drawOffsetFromVisualDoorPixels"],
             "losslessRoundtrip":True},
 "roofWebp":{"file":roof_copy.name,"sha256":sha(roof_copy.read_bytes()),
             "copiedByteIdentical":True},
 "sourceCameraZoom":.84,"worldMetersPerUnit":.025,
 "doorXY":[4365,4075],"sourceDoorPivotPx":[320,320],
 "comparison":preview_file.name,
 "originalBlenderNotRewritten":True,"sourceRoofAndLightingUnchanged":True,
 "newGeometryArtOnly":True,"actualGameRenderIntegration":False,
 "authoritativePortalOrCollisionApproved":False,"productionApproved":False}
(dir/"greyhaven_a230_material_validation.json").write_text(json.dumps(proof,indent=2)+"\n","utf8")
print("A230_ANALYSIS="+json.dumps({"changedRgb":n_rgb,"alphaChange":n_alpha,
 "addedSilhouette":n_added,"bbox":new_bounds,"bytesWebp":proof["baseWebp"]["bytes"],
 "preview":preview_file.name}))

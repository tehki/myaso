#!/usr/bin/env python3
"""A2.32 Red Lion threshold source alpha actor-overlap acceptance.

A2.30 threshold alpha delta at 640 native game pixels versus original pinned
3A Knight/Adult idle atlases at actual 96px draw size and +X/+Y game projection.
Source-accurate composited review; never assert authoritative collision/depth.
"""
import argparse,hashlib,json,math
from pathlib import Path
from PIL import Image,ImageDraw,ImageChops
ap=argparse.ArgumentParser()
ap.add_argument("--repo",type=Path,default=Path(__file__).resolve().parents[2])
ap.add_argument("--knight",type=Path,required=True)
ap.add_argument("--adults",type=Path,required=True)
a=ap.parse_args()
root=a.repo.resolve();assets=root/"assets/environment/greyhaven"
out=assets/"a232-review";out.mkdir(parents=True,exist_ok=True)
handoff=json.loads((assets/"a231-review/greyhaven_a231_lighting_handoff.json").read_text("utf8"))
ref=json.loads((assets/"a230-review/greyhaven_a230_material_validation.json").read_text("utf8"))
maskdelta=handoff["a230AlphaRisk"]["fullChangedPixelCoordinates"]
assert len(maskdelta)==69 and handoff["a230AlphaRisk"]["addedFromFullyTransparent"]==51
assert min(v[1] for v in maskdelta)==321 and max(v[1] for v in maskdelta)==331
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def img(path):
 with Image.open(path) as i:return i.convert("RGBA")
beforePath=assets/"a230-review"/ref["baselineWebp"]["file"]
afterPath=assets/"a230-review"/ref["baseWebp"]["file"]
assert sha(beforePath)==ref["baselineWebp"]["sha256"]
assert sha(afterPath)==ref["baseWebp"]["sha256"]
baseline=img(beforePath);new=img(afterPath)
assert baseline.size==new.size==(228,297)
old_canvas=Image.new("RGBA",(640,640));old_canvas.alpha_composite(baseline,(206,51))
new_canvas=Image.new("RGBA",(640,640));new_canvas.alpha_composite(new,(206,51))
origA=old_canvas.getchannel("A");newA=new_canvas.getchannel("A")
actual=[(x,y) for y in range(640) for x in range(640) if origA.getpixel((x,y))!=newA.getpixel((x,y))]
assert actual==sorted((tuple(v) for v in maskdelta),key=lambda p:(p[1],p[0]))
# Historical roof untouched even in audit. Do not draw roof in threshold crop;
# mask impact under both facade and roof can be independently verified later.
roof=assets/"a231-review/red_lion_a231_roof_unchanged.webp"
prior=assets/"a230-review/red_lion_a230_roof_unchanged.webp"
assert roof.read_bytes()==prior.read_bytes()
sprite_sources=[
 ("silver-knight",a.knight/"web/assets/knights/silver_idle.webp",
  "828cf05dd873d0c8f35e887f5e46c35af87f084ac321977e358c985e7a2106b4"),
 ("adult-masculine",a.adults/"web/assets/adults/adult-masculine_idle.webp",
  "ba1918e5dd3fb4d00738d18ab4f708b6c54789ac09893bd06aed9eac2a65aa8b"),
 ("adult-feminine",a.adults/"web/assets/adults/adult-feminine_idle.webp",
  "d0112058a5a1a85b688854f1c1bf6e6f4f37edca682971c4f353e6067dcf8e15")
]
source_shapes={}
for name,p,expected in sprite_sources:
 assert sha(p)==expected
 image=img(p);assert image.size==(640,1280)
 # Original source first frame of 160×160 directional atlas, downsized to
 # the approved 120%-scale (96×96 screen rect) at game zoom 0.84.
 source_shapes[name]=image.crop((0,0,160,160)).resize((96,96),Image.Resampling.BILINEAR)
positions=[
 ("at-art-door",0,0),("north-threshold",0,-16),
 ("south-threshold",0,16),("west-threshold",-25,0),
 ("east-threshold",25,0),("oblique-street",80,-10)
]
cases=[]
for name,spr in source_shapes.items():
 for namepos,dx,dy in positions:
  screen_x=320+dx*.84;screen_y=320+dy*.84
  left=round(screen_x-48);top=round(screen_y-62.4)
  actor_mask=Image.new("L",(640,640),0)
  actor_mask.paste(spr.getchannel("A"),(left,top))
  hits=[(x,y) for x,y in actual if actor_mask.getpixel((x,y))>0]
  newly=[(x,y) for x,y in hits if origA.getpixel((x,y))==0 and newA.getpixel((x,y))>0]
  # weight by actor coverage and actual new alpha change to quantify
  # changed source pixel compositing, not collision/damage.
  maximum=sum(abs(newA.getpixel((x,y))-origA.getpixel((x,y)))*actor_mask.getpixel((x,y))/(255*255)
              for x,y in hits)
  cases.append({
    "sprite":name,"scenario":namepos,"offsetWorldXY":[dx,dy],
    "actorCanvasRectPx":[left,top,96,96],
    "changedAlphaPixelsUnderActor":len(hits),
    "newlyVisibleFacadePixelsUnderActor":len(newly),
    "compositedAlphaDifferenceUpperBoundEquivalentPixels":round(maximum,5),
    "affectedXY":hits})
# Review overlay: exact original source render and derived 35-mesh geometry
# with threshold-risk marks. Three authentic sprite alpha silhouettes drawn
# at 96px actual scale. No guessed actor/collision.
panel=Image.new("RGB",(1300,690),(35,46,42))
for side,(label,facade) in enumerate((("A2.22 original facade",old_canvas),
                                    ("A2.30 dimensional facade",new_canvas))):
 pic=Image.new("RGB",(640,640),(96,108,97))
 pic.paste(facade,(0,0),facade.getchannel("A"))
 # actors in FRONT here to preserve legibility; risk marks are separate and
 # explicitly annotated. No claim that front is always correct depth.
 k=source_shapes["silver-knight"]
 pic.paste(k,(272,round(320-62.4)),k.getchannel("A"))
 d=ImageDraw.Draw(pic)
 for x,y in actual:
  d.rectangle((x-1,y-1,x+1,y+1),
    outline=(250,77,70) if origA.getpixel((x,y))==0 else (255,190,87))
 panel.paste(pic,(10+650*side,34))
 ImageDraw.Draw(panel).text((13+650*side,11),label+" | ORIGINAL KNIGHT / alpha audit",fill=(242,210,172))
ImageDraw.Draw(panel).text((15,673),"Review-only 640px real game XY: 69 source-alpha pixels (51 newly visible); red source-alpha markers, not live hitbox.",fill=(242,210,172))
name="greyhaven_a232_original_actor_alpha_review.png"
panel.save(out/name,optimize=True)
report={
 "milestone":"Blood & Iron A2.32 source-image actor silhouette vs A2.30 threshold 69px alpha risk",
 "original3BSourceHead":"0cbf33adf70beda55b8fcb8bef4ba2efb36084e5",
 "authentic3AKnightHead":"c74fcf90e227f3bc4788728f000cfe6aa083c7ef",
 "authentic3AAdultHead":"91f1c2c4737b8f0275bb22bfbca4acc1501daa00",
 "spriteSources":[{"name":n,"sha256":s,"sourceAtlasPx":[640,1280],"sourceFramePx":[160,160],"drawPx":[96,96]} for n,p,s in sprite_sources],
 "sourceFacadeAlphaHazard":{"count":69,"newlyVisible":51,"partiallyChanged":18,
                              "bboxInclusive":[min(v[0] for v in actual),min(v[1] for v in actual),
                                max(v[0] for v in actual),max(v[1] for v in actual)]},
 "projection":{"cameraZoom":.84,"metersPerWorldUnit":.025,"visualDoorWorldXY":[4365,4075],
                "gameDoorCanvasPx":[320,320],"actorDrawAnchorYSubtract":62.4},
 "cases":cases,"comparison":name,
 "unchangedRoofSha256":sha(roof),
 "sameRoofBytesAsA230":True,
 "approval":"SOURCE-ONLY REVIEW; NOT AUTHORITATIVE OCCLUSION OR MULTIPLAYER",
 "serverCollisionApproved":False,
 "runtimeOcclusionValidated":False,
 "livePhysicsCombatValidated":False,
 "originalSourceArtworkChanged":False,
 "productionApproved":False
}
(out/"greyhaven_a232_threshold_actor_alpha_report.json").write_text(json.dumps(report,indent=2)+"\n","utf8")
print("A232_ALPHA="+json.dumps({"cases":len(cases),
 "overlap":{n:[(c["scenario"],c["changedAlphaPixelsUnderActor"]) for c in cases if c["sprite"]==n]
            for n in source_shapes},
 "hazardBoundingBox":report["sourceFacadeAlphaHazard"]["bboxInclusive"]}))

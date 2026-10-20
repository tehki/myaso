#!/usr/bin/env python3
"""A2.22 original Red Lion roof refinement review, read-only comparative sheet.

Preview only; uses the genuine 96px Silver Knight atlas from a separate
PR #326 checkout. Never alters either source, game renderer or ground XYZ.
"""
import argparse,hashlib,json
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont

p=argparse.ArgumentParser()
p.add_argument("--old",type=Path,required=True)
p.add_argument("--new",type=Path,required=True)
p.add_argument("--knight",type=Path,required=True)
p.add_argument("--out",type=Path,required=True)
a=p.parse_args()
old_g=json.loads((a.old/"greyhaven_a221_geometry_report.json").read_text("utf8"))
new_g=json.loads((a.new/"greyhaven_a222_geometry_report.json").read_text("utf8"))
assert new_g["geometry"]["maxGroundXYDrift"]==0
assert old_g["geometry"]["maxGroundXYDrift"]==0
assert new_g["groundBasisPixelsPerSourceMeter"]==old_g["groundBasisPixelsPerSourceMeter"]
assert old_g["visualDoorAnchorPixels"]==new_g["visualDoorAnchorPixels"]==[320,320]
assert new_g["roofEaveSourceZ"]==3.45
assert new_g["roofPitchCompression"]==.45
assert new_g["geometry"]["roofOrGableVerticesCompressed"]>1000
assert new_g["geometry"]["maxRoofVisualRiseReductionPx"]>20
assert all(g["productionApproved"] is False for g in (old_g,new_g))
old_w=json.loads((a.old/"greyhaven_a221_webp_report.json").read_text("utf8"))
new_w=json.loads((a.new/"greyhaven_a222_webp_report.json").read_text("utf8"))
images=[]
bounds={}
for key,root,webp,slug in [
 ("baseline",a.old,old_w,"a221"),
 ("refined",a.new,new_w,"a222")
]:
 frame=Image.new("RGB",(640,640),(103,119,103))
 draw=ImageDraw.Draw(frame)
 for x in range(0,640,32):
  draw.line((x,0,x,639),fill=(122,135,119))
  draw.line((0,x,639,x),fill=(122,135,119))
 for part in ("base","roof"):
  info=webp["layers"][part]
  with Image.open(root/info["file"]) as f:
   render=f.convert("RGBA")
  ox,oy=info["drawOffsetFromVisualDoorPixels"]
  x,y=round(320+ox),round(320+oy)
  layer=Image.new("RGBA",(640,640))
  layer.alpha_composite(render,(x,y))
  if part=="base":
   frame.paste(layer,(0,0),layer.getchannel("A"))
  else:
   bounds[key]=list(layer.getchannel("A").getbbox())
   roof=layer
 # Same original PR326 Silver idle atlas tile at 96x96; fighter position
 # is an ART-ONLY proposed doorway offset (0,+60 game units).
 source=a.knight.read_bytes()
 assert source[:4]==b"RIFF" and source[8:12]==b"WEBP"
 with Image.open(a.knight) as image:
  assert image.size==(640,1280)
  sprite=image.convert("RGBA").crop((0,0,160,160))
 sprite=sprite.resize((96,96),Image.Resampling.LANCZOS)
 actor=(320-48,320+60*.84-62)
 frame.paste(sprite,(round(actor[0]),round(actor[1])),sprite.getchannel("A"))
 # No approved dynamic occlusion. Overlay roof at a fixed preview 55%.
 transparent=roof.copy()
 transparent.putalpha(roof.getchannel("A").point(lambda px:round(px*.55)))
 frame.paste(transparent,(0,0),transparent.getchannel("A"))
 dr=ImageDraw.Draw(frame)
 dr.line((310,320,330,320),fill=(250,226,105),width=2)
 dr.line((320,310,320,330),fill=(250,226,105),width=2)
 images.append(frame)

old_bounds=bounds["baseline"]
new_bounds=bounds["refined"]
assert new_bounds[0]==old_bounds[0] and new_bounds[2]==old_bounds[2]
assert new_bounds[1]>=old_bounds[1]+20
assert abs(new_bounds[3]-old_bounds[3])<=3
sheet=Image.new("RGB",(1300,710),(23,32,30))
dr=ImageDraw.Draw(sheet)
for i,(label,frame) in enumerate(zip(("A2.21 ORIGINAL ROOF","A2.22 REFINED ROOF"),images)):
 x=10+650*i
 sheet.paste(frame,(x,43))
 dr.text((x+5,15),label,fill=(240,219,181))
dr.text((12,686),"Review only: same Red Lion door XY, genuine 120% PR326 knight, 55% preview roof; NO active game occlusion.",fill=(244,188,154))
a.out.mkdir(parents=True,exist_ok=True)
image_out=a.out/"greyhaven_a222_roof_before_after_knight.png"
sheet.save(image_out,optimize=True)
qa={
 "milestone":"Blood & Iron A2.22 original XY roof proportion comparison",
 "sourceKnightWebP":"silver_idle.webp",
 "knightSpriteSha256":hashlib.sha256(a.knight.read_bytes()).hexdigest(),
 "knightDrawPixels":[96,96],
 "knightSourceCopied":False,
 "actualAuthoritativeDoorOrCollision":False,
 "originalRedLionBlenderSceneEdited":False,
 "originalApprovedKnightsEdited":False,
 "gameplayPhysicsOrMultiplayerChanged":False,
 "roofRuntimeOcclusionApproved":False,
 "productionApproved":False,
 "groundXYDrift":0,
 "groundBasisPixelsPerSourceMeter":new_g["groundBasisPixelsPerSourceMeter"],
 "visualDoorAnchorPixels":[320,320],
 "oldRoofAlphaBounds":old_bounds,
 "newRoofAlphaBounds":new_bounds,
 "roofAlphaTopMovedDownPx":new_bounds[1]-old_bounds[1],
 "roofAlphaBottomShiftPx":new_bounds[3]-old_bounds[3],
 "sourceVerticesEditedInMemory":new_g["geometry"]["transformedVertices"],
 "highRoofAndGableVerticesCompressed":new_g["geometry"]["roofOrGableVerticesCompressed"],
 "maxVisualRiseReductionPx":new_g["geometry"]["maxRoofVisualRiseReductionPx"],
 "artifact":image_out.name
}
(a.out/"greyhaven_a222_roof_comparison_report.json").write_text(
 json.dumps(qa,indent=2,sort_keys=True)+"\n",encoding="utf8")
print("A222_REVIEW="+json.dumps({
 "roofTopDownPx":qa["roofAlphaTopMovedDownPx"],
 "roofBottomShiftPx":qa["roofAlphaBottomShiftPx"],
 "knightSHA256":qa["knightSpriteSha256"],
 "image":str(image_out)
}))

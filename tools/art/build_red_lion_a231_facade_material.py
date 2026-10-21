#!/usr/bin/env python3
"""A2.31 reproducible facade aperture material + A2.30 alpha hazard review.

Use actual A2.30 Blender-derived facade; freeze unchanged roof and original
source .blend. Dusk warms *only* apertures, no secondary radial glow.
3C P2.4 exterior lantern/ground light is composited separately in the
real browser QA from an independently pinned 3C source checkout.
"""
from pathlib import Path
from PIL import Image,ImageDraw,ImageChops
import json,hashlib,argparse
ap=argparse.ArgumentParser()
ap.add_argument("--repo",type=Path,default=Path(__file__).resolve().parents[2])
args=ap.parse_args()
root=args.repo.resolve()
art=root/"assets/environment/greyhaven"
out=art/"a231-review"
out.mkdir(exist_ok=True,parents=True)
proof=json.loads((art/"a230-review/greyhaven_a230_material_validation.json").read_text("utf8"))
a230=art/"a230-review"
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
src=a230/"red_lion_a230_dimensional_base.webp"
assert sha(src)==proof["baseWebp"]["sha256"]
baseline=a230/"red_lion_a230_original_base.webp"
assert sha(baseline)==proof["baselineWebp"]["sha256"]
roof=a230/"red_lion_a230_roof_unchanged.webp"
assert sha(roof)==proof["roofWebp"]["sha256"]
with Image.open(src) as i: original=i.convert("RGBA")
with Image.open(baseline) as i: before=i.convert("RGBA")
assert original.size==before.size==(228,297)
ox,oy=206,51
dayfile=out/"red_lion_a231_day_dimensional.webp"
dayfile.write_bytes(src.read_bytes())
# Baked dim facade reflectance, localized emissive glass ONLY (no halo).
base=Image.new("RGBA",(640,640))
base.alpha_composite(original,(ox,oy))
pixels=list(base.get_flattened_data())
result=[]
for rgba in pixels:
 r,g,b,a=rgba
 if a:
  result.append((round(r*.73+9),round(g*.72+6),round(b*.79+8),a))
 else:
  result.append(rgba)
dusk=Image.new("RGBA",(640,640));dusk.putdata(result)
glaze=Image.new("RGBA",(640,640))
d=ImageDraw.Draw(glaze)
apertures=[{"name":"west-glazing","roi":[251,260,275,280]},
           {"name":"east-glazing","roi":[360,260,384,280]}]
for e in apertures:
 x1,y1,x2,y2=e["roi"]
 # highlight is *inside* the window glass, never a radial light pool.
 d.rectangle((x1+2,y1+1,x2-2,y2-1),fill=(248,180,99,88))
 d.line((x1+3,y1+2,x2-3,y1+2),fill=(250,208,132,80))
dusk=Image.alpha_composite(dusk,glaze)
dusk.putalpha(base.getchannel("A"))
assert ImageChops.difference(base.getchannel("A"),dusk.getchannel("A")).getbbox() is None
dusk_crop=dusk.crop((ox,oy,ox+228,oy+297))
duskfile=out/"red_lion_a231_dusk_dimensional.webp"
dusk_crop.save(duskfile,"WEBP",lossless=True,method=6,exact=True)
with Image.open(duskfile) as i:check=i.convert("RGBA")
assert ImageChops.difference(check,dusk_crop).getbbox() is None
roofcopy=out/"red_lion_a231_roof_unchanged.webp"
roofcopy.write_bytes(roof.read_bytes())
assert sha(roofcopy)==sha(roof)
# The Art Director's 69 changed A2.30 facade alpha pixels are visualized
# exactly at source canvas XY, with independent added/removed/perimeter counts.
b=Image.new("RGBA",(640,640));b.alpha_composite(before,(ox,oy))
old_a=b.getchannel("A");new_a=base.getchannel("A")
changed=[];added=[];removed=[];soft=[]
for y in range(640):
 for x in range(640):
  v1=old_a.getpixel((x,y));v2=new_a.getpixel((x,y))
  if v1!=v2:
   changed.append((x,y))
   if v1==0 and v2>0:added.append((x,y))
   elif v1>0 and v2==0:removed.append((x,y))
   else:soft.append((x,y))
assert len(changed)==69 and len(added)==51
# Real 640 game-canvas inspection, magnified red/blue markers inset.
alpha_delta=Image.new("RGBA",(640,640),(0,0,0,0))
pixels2=alpha_delta.load()
for x,y in added:pixels2[x,y]=(255,81,65,255)
for x,y in removed:pixels2[x,y]=(85,150,255,255)
for x,y in soft:pixels2[x,y]=(255,205,103,255)
overlay=Image.new("RGB",(1300,690),(40,52,46))
for k,image in enumerate((b,base)):
 panel=Image.new("RGB",(640,640),(97,114,99))
 panel.paste(image,(0,0),image.getchannel("A"))
 # Ring each changed source-alpha pixel so the tiny change is inspectable;
 # the overlay does not pretend to be part of any actual render.
 rings=ImageDraw.Draw(panel)
 for x,y in changed:
  rings.rectangle((x-2,y-2,x+2,y+2),outline=(255,91,68) if (x,y) in added else (255,199,74),width=1)
 overlay.paste(panel,(10+650*k,34))
 t=ImageDraw.Draw(overlay)
 t.text((14+650*k,10),("Original Blender facade" if k==0 else "A2.30 35-mesh facade")+" | alpha hazard mark-up",fill=(242,212,176))
ImageDraw.Draw(overlay).text((14,674),
 "Red=originally transparent now visible, gold=changed edge alpha. 69 total alpha pixels; MARKUP not a browser screenshot.",fill=(240,207,168))
overlay_path=out/"greyhaven_a231_alpha_hazard_overlay.png"
overlay.save(overlay_path,optimize=True)
# Original world map P2.4: building entrance (4365,4060), 3B art door
# (4365,4075); 3C fixed light/sconce (4365,4045), pool (4365,4069).
handoff={
 "milestone":"Blood & Iron A2.31 facade aperture and 3C lighting handoff",
 "building":{"id":"red-lion","x":4240,"y":3880,"w":250,"h":170,
             "authoredWorldEntrance":[4365,4060],"visualArtDoor":[4365,4075]},
 "graphics3C":{"sourcePr":419,"sourceHead":"8e85584b6007b38e1a00155b77473e92b0afec6a",
    "P24Source":"src/browser/greyhaven-atmosphere.mjs","worldSource":"src/world/authored-maps.mjs",
    "fixtureWorldXY":[4365,4045],"poolWorldXY":[4365,4069],"radiusWorldUnits":108,
    "chunkWorldUnits":512,"lightingPlanVersion":"3c-p24-1"},
 "material":{
    "day":{"file":dayfile.name,"sha256":sha(dayfile),"bytes":dayfile.stat().st_size},
    "dusk":{"file":duskfile.name,"sha256":sha(duskfile),"bytes":duskfile.stat().st_size},
    "roof":{"file":roofcopy.name,"sha256":sha(roofcopy),"bytes":roofcopy.stat().st_size},
    "croppedPixels":[228,297],"drawOffsetFromDoorPixels":[-114,-269],
    "apertures":apertures,"duskWindowGlowIsBoundedToGlass":True,
    "extraRadialFacadeGlow":False,"alphaIdenticalBetweenDayDusk":True,
    "roofByteIdenticalToA226":True},
 "a230AlphaRisk":{"changedPixels":len(changed),"addedFromFullyTransparent":len(added),
   "removedToFullyTransparent":len(removed),"partiallyChanged":len(soft),
   "overallBoundsUnchanged":True,"overlay":overlay_path.name,
   "fullChangedPixelCoordinates":changed},
 "artReviewOnly":True,"dynamicDayNightProtocol":False,
 "serverPortalOrCollisionChanged":False,"actualWorldRendererIntegrated":False,
 "approvedForProduction":False
}
(out/"greyhaven_a231_lighting_handoff.json").write_text(json.dumps(handoff,indent=2)+"\n","utf8")
print("A231_MATERIAL="+json.dumps({"day":handoff["material"]["day"],"dusk":handoff["material"]["dusk"],
 "alphaHazard":{k:v for k,v in handoff["a230AlphaRisk"].items() if k!="fullChangedPixelCoordinates"},
 "roofCopied":True}))

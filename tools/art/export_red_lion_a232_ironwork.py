#!/usr/bin/env python3
"""Original Blender A2.32 forged ironwork sprite export; refuses crop/roof drift."""
from pathlib import Path
from PIL import Image,ImageChops,ImageDraw
import json,hashlib,sys
root=Path(sys.argv[1]);path=root/"assets/environment/greyhaven/a232-review"
old=root/"assets/environment/greyhaven/a231-review"
base=root/"assets/environment/greyhaven/a230-review"
assert path.exists()
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
source=json.loads((path/"red_lion_a232_blender_source.json").read_text("utf8"))
assert source["sourceUntouched"] and source["roofSourceEdited"] is False and source["addedMeshes"]==20
with Image.open(path/"red_lion_a232_baseline_640.png") as im: before=im.convert("RGBA").transpose(Image.Transpose.FLIP_TOP_BOTTOM)
with Image.open(path/"red_lion_a232_ironwork_640.png") as im: after=im.convert("RGBA").transpose(Image.Transpose.FLIP_TOP_BOTTOM)
assert before.size==after.size==(640,640)
a1,a2=before.getchannel("A"),after.getchannel("A")
bbox0,bbox1=a1.getbbox(),a2.getbbox()
ox,oy,w,h=206,51,228,297
assert bbox1 and bbox1[0]>=ox and bbox1[1]>=oy and bbox1[2]<=ox+w and bbox1[3]<=oy+h,(bbox0,bbox1)
b=list(before.get_flattened_data());a=list(after.get_flattened_data())
n_rgb=sum(any(p[i]!=q[i] for i in range(3)) for p,q in zip(b,a))
n_alpha=sum(p[3]!=q[3] for p,q in zip(b,a))
n_alpha_outside=sum(p[3]!=q[3] for p,q in zip(b,a) if p[3]==0 or q[3]==0)
assert n_rgb>=50 and n_rgb<=16000,n_rgb
assert n_alpha<=3000,n_alpha
def webp(name,img):
 p=path/name;img.save(p,"WEBP",lossless=True,exact=True,method=6)
 with Image.open(p) as decoded: back=decoded.convert("RGBA")
 assert ImageChops.difference(back,img).getbbox() is None
 return {"file":name,"sha256":sha(p),"bytes":p.stat().st_size}
crop=after.crop((ox,oy,ox+w,oy+h))
day=webp("red_lion_a232_day_ironwork.webp",crop)
# Source-authentic nonradial A2.31 dusk response, only glass apertures illuminate.
dims=Image.new("RGBA",(640,640));out=[]
for r,g,b,a in after.get_flattened_data():
 out.append((round(r*.73+9),round(g*.72+6),round(b*.79+8),a) if a else (r,g,b,a))
dims.putdata(out)
glaze=Image.new("RGBA",(640,640));draw=ImageDraw.Draw(glaze)
for x1,y1,x2,y2 in ((251,260,275,280),(360,260,384,280)):
 draw.rectangle((x1+2,y1+1,x2-2,y2-1),fill=(248,180,99,88))
 draw.line((x1+3,y1+2,x2-3,y1+2),fill=(250,208,132,80))
dims=Image.alpha_composite(dims,glaze);dims.putalpha(after.getchannel("A"))
duskcrop=dims.crop((ox,oy,ox+w,oy+h))
dusk=webp("red_lion_a232_dusk_ironwork.webp",duskcrop)
assert ImageChops.difference(crop.getchannel("A"),duskcrop.getchannel("A")).getbbox() is None
roofold=old/"red_lion_a231_roof_unchanged.webp"
roof=path/"red_lion_a232_roof_unchanged.webp"
roof.write_bytes(roofold.read_bytes())
assert sha(roof)==sha(roofold)
# Human-source source previews (not a game screenshot or runtime acceptance).
preview=Image.new("RGB",(1300,690),(35,44,40))
for k,(label,img) in enumerate((("A2.30 genuine Blender facade",before),("A2.32 actual forged fittings",after))):
 board=Image.new("RGB",(640,640),(95,112,101))
 board.paste(img,(0,0),img.getchannel("A"))
 preview.paste(board,(10+650*k,34))
 ImageDraw.Draw(preview).text((14+650*k,10),label,fill=(247,213,170))
ImageDraw.Draw(preview).text((12,674),"Original Blender Cycles 2.5D projection; detail-only, NO roof/World/Combat integration",fill=(237,211,169))
pr=path/"red_lion_a232_original_cycles_compare.png";preview.save(pr,optimize=True)
report={"source":source,"sourceHead":"0cbf33adf70beda55b8fcb8bef4ba2efb36084e5",
 "rendered640BeforeAlphaBounds":bbox0,"rendered640AfterAlphaBounds":bbox1,
 "changedRgbPixels":n_rgb,"changedAlphaPixels":n_alpha,"changedBoundaryAlphaPixels":n_alpha_outside,
 "croppedPixels":[w,h],"drawOffsetFromVisualDoorPx":[-114,-269],
 "dayWebP":day,"duskWebP":dusk,"roofSha256":sha(roof),
 "roofByteIdentical":True,"dayDuskAlphaIdentical":True,
 "originalSourceBlenderUnmodified":True,"newOriginalIronMeshes":20,
 "sourceWorldChanged":False,"serverCollisionChanged":False,
 "gameRenderIntegrated":False,"realFourPlayerAcceptance":False,"releaseApproved":False}
(path/"red_lion_a232_art_report.json").write_text(json.dumps(report,indent=2)+"\n","utf8")
print("ORIGINAL_3B_A232_ART="+json.dumps({"rgb":n_rgb,"alpha":n_alpha,"bounds":bbox1,"dayBytes":day["bytes"],"duskBytes":dusk["bytes"],"roofFrozen":True}))

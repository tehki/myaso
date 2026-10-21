"""Lossless WebP packaging and reproducible material quality checks for P0 armory.
Never records World socket positions, server item IDs, game pickup events.
"""
from PIL import Image,ImageChops,ImageDraw
from pathlib import Path
import json,hashlib,argparse
p=argparse.ArgumentParser();p.add_argument("--outdir",required=True)
a=p.parse_args()
d=Path(a.outdir).resolve()
b=json.loads((d/"blender_source_render.json").read_text("utf8"))
assert b["worldSocketCoordinatesApproved"]==False
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
manifest={
 "project":"myaso.io Graphics 3B P0 physically visible rack sword",
 "sourceScene":{"file":b["originalBlenderSource"],
                "sha256":sha(d/b["originalBlenderSource"]),
                "rackMeshCount":b["rackOriginalMeshCount"],
                "swordMeshCount":b["swordOriginalMeshCount"]},
 "assets":{},"visualOnly":True,"realGameIntegrated":False,
 "socketWorldCoordinatesApproved":False,"canonicalItemIdsAssigned":False,
 "worldBuilding":"smith","worldBuildingFootprint":[3710,3850,182,162],
 "authoritativeOwnership":"Core 8B + Items 2B, not graphics",
 "sourceFrameUsesTransparentRGBA":True,
 "productionApproved":False
}
for key,size in [("rack",(240,166)),("sword",(42,115))]:
 original=d/f"armory_{key}_source.png";out=d/f"armory_{key}.webp"
 with Image.open(original) as item:image=item.convert("RGBA")
 assert image.size==size
 image.save(out,"WEBP",lossless=True,method=6,exact=True)
 with Image.open(out) as item:roundtrip=item.convert("RGBA")
 assert roundtrip.tobytes()==image.tobytes()
 a=image.getchannel("A")
 assert a.getbbox() is not None
 alpha=list(a.getdata())
 visible=sum(v>0 for v in alpha)
 assert visible>size[0]*size[1]*.015,(key,visible)
 assert visible<size[0]*size[1]*.95,(key,visible)
 manifest["assets"][key]={"file":out.name,
     "sha256":sha(out),"sourcePng":original.name,"sourceSha256":sha(original),
     "pixels":list(size),"visibleAlphaPixels":visible,
     "alphaBounds":list(a.getbbox()),"losslessRGBA":True,
     "bytes":out.stat().st_size}
# Source-art-only montage; its four sword positions are for *art comparison*,
# not world coordinates or canonical server item sockets.
preview=Image.new("RGB",(1000,410),(42,51,45))
scene=Image.new("RGBA",(400,340),(0,0,0,0))
rack=Image.open(d/"armory_rack.webp").convert("RGBA")
sword=Image.open(d/"armory_sword.webp").convert("RGBA")
scene.alpha_composite(rack,(80,126))
for x in (123,166,209,252):
 scene.alpha_composite(sword,(x,137))
preview.paste(scene,(38,42),scene.getchannel("A"))
larger=scene.resize((520,390),Image.Resampling.NEAREST)
preview.paste(larger,(463,13),larger.getchannel("A"))
draw=ImageDraw.Draw(preview)
draw.text((37,8),"BLENDER 5.2 P0 | Rack and four separately painted swords",fill=(249,218,173))
draw.text((38,390),"ILLUSTRATIVE ASSET LAYOUT — NO WORLD SOCKETS / NO SERVER OWNERSHIP / NO CLICK COMMIT.",fill=(249,218,173))
file=d/"armory_p0_art_only_montage.png";preview.save(file,optimize=True)
manifest["artOnlyMontage"]=file.name
(d/"armory_p0_asset_proof.json").write_text(json.dumps(manifest,indent=2)+"\n","utf8")
print("ARMORY_P0_ASSETS="+json.dumps(manifest["assets"]))

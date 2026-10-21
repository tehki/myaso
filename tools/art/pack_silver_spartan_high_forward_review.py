"""Pack original owner Silver Knight higher chamber and farther boot push against prior Spartan #602 source.
First-party original Silver rig; SOURCE-only, NOT world floor certification.
"""
from pathlib import Path
from PIL import Image,ImageChops,ImageDraw
import argparse,hashlib,json
p=argparse.ArgumentParser()
p.add_argument("--input",required=True)
p.add_argument("--old-atlas",required=True)
p.add_argument("--output",required=True)
args=p.parse_args()
source=Path(args.input);dest=Path(args.output);dest.mkdir(parents=True,exist_ok=True)
oldpath=Path(args.old_atlas)
with Image.open(oldpath) as im:
 assert im.size==(1280,1280) and im.format=="WEBP"
 old=im.convert("RGBA")
corrected=Image.new("RGBA",(1280,1280))
changed=[]
for direction in range(8):
 counter=0
 poses=[]
 for phase in range(8):
  p=source/f"silver_kick_p0_dir{direction}_frame{phase}.png"
  assert p.is_file(),p
  with Image.open(p) as f:
   assert f.size==(160,160) and f.mode=="RGBA",(p,f.size,f.mode)
   tile=f.copy()
  assert tile.getchannel("A").getbbox(),p
  poses.append(tile)
  corrected.alpha_composite(tile,(phase*160,direction*160))
  prev=old.crop((phase*160,direction*160,(phase+1)*160,(direction+1)*160))
  counter +=sum(1 for rgb in ImageChops.difference(tile,prev).convert("RGB").getdata() if rgb!=(0,0,0))
 assert counter>350,(direction,counter,"not an actual art correction")
 changed.append(counter)
asset=dest/"silver_spartan_high_forward_p0.webp"
corrected.save(asset,"WEBP",lossless=True,method=5)
times=[20,40,50,40,50,65,70,45]
assert sum(times)==380
gifFrames=[]
for phase in range(8):
 panel=Image.new("RGB",(8*164,2*181),(135,149,142))
 d=ImageDraw.Draw(panel)
 for direction in range(8):
  for row,atlas in enumerate((old,corrected)):
   tile=atlas.crop((phase*160,direction*160,(phase+1)*160,(direction+1)*160))
   x,y=direction*164+2,row*181+3
   panel.paste(tile,(x,y),tile.getchannel("A"))
   d.text((x+3,y+164),("SPARTAN #602" if row==0 else "HIGH FORWARD")+f" {direction}",fill=(19,38,25))
 gifFrames.append(panel)
gif=dest/"silver_spartan_602_vs_high_forward_8way_380ms.gif"
gifFrames[0].save(gif,save_all=True,append_images=gifFrames[1:],
 duration=times,loop=0,optimize=False)
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
manifest={
 "sourceHead":"c7a929aae83b1aef6ae650b9255d5ace32954c41",
 "priorSpartan602KickAtlasSha256":sha(oldpath),
 "newHighForwardKickAtlasSha256":sha(asset),
 "highForwardComparisonGifSha256":sha(gif),
 "sourceDrawCount":64,"sourceFramesPerFacing":8,"directionCount":8,
 "sourceFramePx":[160,160],"atlasPx":[1280,1280],
 "kickVisualBudgetMs":380,"timingsMs":times,
 "pixelChangesPerFacing":changed,
 "approvedHumanVisual":False,"verifiedRealGround":False,
 "gameplayEnabled":False,"serverOrHitboxChanged":False,
 "dashOriginalUnchanged":True}
(dest/"spartan_high_forward_art_manifest.json").write_text(json.dumps(manifest,indent=2)+"\n",encoding="utf8")
print("HIGH_FORWARD_KICK_SOURCE_PACK",json.dumps({"perFacingChanged":changed,
 "newAtlasBytes":asset.stat().st_size,"previewBytes":gif.stat().st_size}),flush=True)

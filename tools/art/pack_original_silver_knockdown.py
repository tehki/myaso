"""Pack 64 original Blender source renders without modifying their pixels.
No live asset replacement; this is a standalone source-only review.
"""
import argparse,json,hashlib
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
p=argparse.ArgumentParser()
p.add_argument("--input",required=True)
p.add_argument("--output",required=True)
args=p.parse_args()
src=Path(args.input);dst=Path(args.output);dst.mkdir(parents=True,exist_ok=True)
manifest=json.loads((src/"original_silver_knockdown_source_manifest.json").read_text())
assert manifest["originalRigBones"]==22 and len(manifest["rendered"])==64
frames={}
canvas=Image.new("RGBA",(1280,1280))
for direction in range(8):
 for frame in range(8):
  name=f"silver_knockdown_dir{direction}_frame{frame}.png"
  im=Image.open(src/name).convert("RGBA")
  assert im.size==(160,160)
  canvas.paste(im,(frame*160,direction*160))
  frames[(direction,frame)]=im
out=dst/"original_silver_knockdown_360ms_8way.webp"
canvas.save(out,format="WEBP",lossless=True,method=6)
assert Image.open(out).size==(1280,1280)
assert Image.open(out).info.get("lossless",True) is not False
timings=[35,40,45,45,60,70,45,20]
assert sum(timings)==360
sheet=[]
for frame in range(8):
 film=Image.new("RGB",(640,320),(147,169,153))
 for direction in range(8):
  tile=frames[(direction,frame)]
  film.paste(tile,((direction%4)*160,(direction//4)*160),tile)
 # The review overlay labels each distinct source sample; original atlas
 # remains pixel-exact, and identical held poses are not merged in GIF.
 ms=manifest["sourceKeyframes"][frame]["ms"]
 ImageDraw.Draw(film).text((7,5),f"Original Silver 22-bone knockdown - pose {frame+1}/8 - {ms:.0f}ms",fill=(20,30,25))
 sheet.append(film)
gif=dst/"original_silver_victim_knockdown_8way_360ms.gif"
sheet[0].save(gif,save_all=True,append_images=sheet[1:],
 duration=timings,loop=0,optimize=False,disposal=2)
assert Image.open(gif).n_frames==8
blend=src/"Graphics3A_Original_Silver_Victim_Knockdown_360ms_source.blend"
assert blend.stat().st_size>30000
import shutil
shutil.copy2(blend,dst/blend.name)
digest=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
manifest.update({
 "realSourceAtlasSha256":digest(out),
 "realEditableSourceBlendSha256":digest(dst/blend.name),
 "eightFacingAnimatedReviewGifSha256":digest(gif),
 "atlasPx":[1280,1280],"sourceCellPx":[160,160],
 "sourceClipFrames":8,"directionCount":8,
 "reviewGifDurationsMs":timings,
 "all64AtlasCellsFromRealBlenderSource":True,
 "humanArtApproval":False,
 "sourceOnly":True,
 "worldContactValidated":False})
(dst/"original_silver_knockdown_source_manifest.json").write_text(json.dumps(manifest,indent=2)+"\n")
print("ORIGINAL_SILVER_KNOCKDOWN_ART_PACK",json.dumps({
 "atlasBytes":out.stat().st_size,"atlasSha256":digest(out),
 "gifBytes":gif.stat().st_size,"sourceBlendBytes":blend.stat().st_size,
 "directions":8,"sourceFrames":64}),flush=True)

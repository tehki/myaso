"""Pack original 3A Silver roll and rig-attached original 3B Blender sword.
Presentation/review only: 8 directions x 8 source A3 roll frames each.
Requires Pillow and exact first-party original WebP and new Blender PNGs.
"""
import argparse,hashlib,json
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
argv=__import__("sys").argv
parser=argparse.ArgumentParser()
parser.add_argument("--source-frames",required=True)
parser.add_argument("--original-atlas",required=True)
parser.add_argument("--out",required=True)
args=parser.parse_args(argv[1:])
source=Path(args.source_frames)
original=Path(args.original_atlas)
out=Path(args.out);out.mkdir(parents=True,exist_ok=True)
def digest(f):return hashlib.sha256(Path(f).read_bytes()).hexdigest()
with Image.open(original) as raw:
 assert raw.size==(1280,1280) and raw.format=="WEBP"
 old=raw.convert("RGBA")
frames=8;dirs=8;cell=224
atlasNew=Image.new("RGBA",(cell*frames,cell*dirs))
atlasOld=Image.new("RGBA",(cell*frames,cell*dirs))
for facing in range(dirs):
 for phase in range(frames):
  file=source/f"row{facing:02d}_frame{phase:02d}.png"
  assert file.is_file(),file
  with Image.open(file) as raw:
   assert raw.size==(cell,cell),file
   picture=raw.convert("RGBA")
  bbox=picture.getchannel("A").getbbox()
  assert bbox and bbox[2]-bbox[0]>6 and bbox[3]-bbox[1]>12,(file,bbox)
  atlasNew.alpha_composite(picture,(phase*cell,facing*cell))
  oldSrc=old.crop((phase*160,facing*160,(phase+1)*160,(facing+1)*160))
  atlasOld.alpha_composite(oldSrc,(phase*cell+32,facing*cell+32))
outNew=out/"silver_roll_original_bone_gripped_sword_review.webp"
outOld=out/"silver_roll_unarmed_original_reference.webp"
atlasNew.save(outNew,"WEBP",lossless=True,method=5)
atlasOld.save(outOld,"WEBP",lossless=True,method=5)
duration=[40,40,50,40,40,50,40,50]
gifFrames=[]
for phase in range(frames):
 background=Image.new("RGB",(8*142,2*158),(128,145,140))
 draw=ImageDraw.Draw(background)
 for face in range(8):
  for row,atlas in enumerate([atlasOld,atlasNew]):
   tile=atlas.crop((phase*cell,face*cell,(phase+1)*cell,(face+1)*cell))
   tile.thumbnail((126,126),Image.Resampling.LANCZOS)
   left=face*142+8+(126-tile.width)//2
   top=row*158+17+(126-tile.height)//2
   background.paste(tile,(left,top),tile.getchannel("A"))
   draw.text((face*142+8,row*158+3),("BEFORE" if row==0 else "GRIP")+" "+str(face),(22,37,34))
 gifFrames.append(background)
loop=out/"silver_8direction_bone_grip_350ms.gif"
gifFrames[0].save(loop,save_all=True,append_images=gifFrames[1:],
 duration=duration,loop=0,optimize=False)
manifest={
 "visualQAOnly":True,"realGameplay":False,"humanApproved":False,
 "sourceModel":"Original Silver Knight A3 roll",
 "swordModel":"Original 3B Blender six Sword meshes with original object world transform",
 "authoritativeEquipment":False,"newArtActivated":False,
 "bone":"mixamorig:RightHand","originalWebpSha256":digest(original),
 "atlasOriginalReviewSha256":digest(outOld),"atlasRigSwordReviewSha256":digest(outNew),
 "animatedGifSha256":digest(loop),
 "sourceFramePx":cell,"sourceAtlasPx":[1792,1792],
 "framesPerDirection":frames,"directions":dirs,"visualRollMs":sum(duration),
 "previewArtwork":["silver_roll_original_bone_gripped_sword_review.webp",
 "silver_roll_unarmed_original_reference.webp","silver_8direction_bone_grip_350ms.gif"]
}
(out/"review_manifest.json").write_text(json.dumps(manifest,indent=2)+"\n",encoding="utf8")
print("RIG_SWORD_ATLASES",json.dumps({k:manifest[k] for k in
 ["sourceAtlasPx","directions","framesPerDirection","visualRollMs"]}),flush=True)

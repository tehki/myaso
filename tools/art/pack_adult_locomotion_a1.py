"""Pack two original A1 movement clips per adult base-body as true alpha WebP atlases.
Directions share Graphics A0/Knights 160px tile conventions.
"""
import pathlib, argparse, hashlib, json
from PIL import Image
p=argparse.ArgumentParser()
p.add_argument("--body",choices=["adult-masculine","adult-feminine"],required=True)
p.add_argument("--frames-root",default=".a1-frames")
p.add_argument("--outdir",default="web/assets/adults")
args=p.parse_args()
src=pathlib.Path(args.frames_root).resolve()/args.body
out=pathlib.Path(args.outdir).resolve();out.mkdir(parents=True,exist_ok=True)
for clip in ("walk","run"):
 atlas=Image.new("RGBA",(640,1280),(0,0,0,0))
 for direction in range(8):
  for frame in range(4):
   filepath=src/(f"{clip}_row{direction:02}_frame{frame:02}.png")
   assert filepath.is_file(),filepath
   with Image.open(filepath) as img:
    assert img.size==(160,160),(filepath,img.size)
    img=img.convert("RGBA")
    assert img.getextrema()[3][1]>0,filepath
    atlas.alpha_composite(img,(160*frame,160*direction))
 output=out/(args.body+"_"+clip+".webp")
 atlas.save(output,format="WEBP",quality=82,method=5)
 with Image.open(output) as decoded:
  assert decoded.size==(640,1280)
  assert decoded.getextrema()[3][0]==0
  assert decoded.getextrema()[3][1]>0
 raw=output.read_bytes()
 assert raw[:4]==b"RIFF" and raw[8:12]==b"WEBP"
 info={"bodyPresentation":args.body,"clip":clip,"directions":8,
  "framesPerDirection":4,"sourceFramePx":160,"atlasWidth":640,"atlasHeight":1280,
  "bytes":len(raw),"sha256":hashlib.sha256(raw).hexdigest(),
  "rgbaTransparency":True,"originalSource":True,"productionActive":False,
  "footGroundingVerified":False,"serverMovementModified":False}
 (out/(args.body+"_"+clip+".json")).write_text(json.dumps(info,indent=2),encoding="utf8")
 print("A1_ATLAS_OK",json.dumps(info),flush=True)

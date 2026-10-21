"""Pack original Graphics 3A adult A2 8-way 8-phase roll into RGBA WebP atlas."""
import argparse,json,pathlib,hashlib
from PIL import Image
p=argparse.ArgumentParser()
p.add_argument("--body",choices=["adult-masculine","adult-feminine"],required=True)
p.add_argument("--frames-root",default=".a2-frames")
p.add_argument("--outdir",default="web/assets/adults")
args=p.parse_args()
frames=pathlib.Path(args.frames_root).resolve()/args.body
out=pathlib.Path(args.outdir).resolve();out.mkdir(parents=True,exist_ok=True)
atlas=Image.new("RGBA",(8*160,8*160),(0,0,0,0))
for direction in range(8):
 for index in range(8):
  filename=frames/f"roll_row{direction:02d}_frame{index:02d}.png"
  assert filename.is_file(),filename
  with Image.open(filename) as img:
   assert img.size==(160,160),(filename,img.size)
   rgba=img.convert("RGBA")
   assert rgba.getextrema()[3][1]>0,filename
   atlas.alpha_composite(rgba,(index*160,direction*160))
filename=out/(args.body+"_roll.webp")
atlas.save(filename,format="WEBP",quality=82,method=5)
with Image.open(filename) as image:
 assert image.size==(1280,1280)
 assert image.getextrema()[3][0]==0
 assert image.getextrema()[3][1]>0
raw=filename.read_bytes()
assert raw[:4]==b"RIFF" and raw[8:12]==b"WEBP"
meta={"bodyPresentation":args.body,"clip":"roll","directions":8,
 "framesPerDirection":8,"sourceFramePx":160,"atlasWidth":1280,
 "atlasHeight":1280,"bytes":len(raw),
 "sha256":hashlib.sha256(raw).hexdigest(),"rgbaTransparency":True,
 "sourceSampleFrames":[1,3,5,7,9,11,15,22],
 "rollVisualMs":350,"dodgeActiveMs":170,"recoveryMs":180,
 "destinationPx":134,"gameplayCombatChanged":False,
 "sourceOriginal":True,"productionActive":False}
(out/(args.body+"_roll.json")).write_text(json.dumps(meta,indent=2),encoding="utf8")
print("A2_ROLL_ATLAS_OK",json.dumps(meta),flush=True)

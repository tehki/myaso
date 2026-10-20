"""Pack original Graphics 3A adult idle RGBA renders into Knight-compatible 8x4 WebP atlases."""
import argparse, pathlib, json, hashlib
from PIL import Image
parser=argparse.ArgumentParser()
parser.add_argument("--frames-dir",required=True)
parser.add_argument("--body",choices=["adult-masculine","adult-feminine"],required=True)
parser.add_argument("--outdir",required=True)
a=parser.parse_args()
src=pathlib.Path(a.frames_dir).resolve()
dst=pathlib.Path(a.outdir).resolve();dst.mkdir(parents=True,exist_ok=True)
atlas=Image.new("RGBA",(4*160,8*160),(0,0,0,0))
transparent=0
for d in range(8):
    for f in range(4):
        file=src/("row%02d_frame%02d.png"%(d,f))
        assert file.is_file(),file
        with Image.open(file) as img:
            img=img.convert("RGBA")
            assert img.size==(160,160),(file,img.size)
            assert img.getextrema()[3][1]>0,file
            atlas.alpha_composite(img,(f*160,d*160))
name=a.body+"_idle.webp"
output=dst/name
atlas.save(output,format="WEBP",quality=82,method=5)
with Image.open(output) as decoded:
    assert decoded.size==(640,1280)
    assert decoded.getextrema()[3][0]==0
    assert decoded.getextrema()[3][1]>0
bytes_=output.read_bytes()
assert bytes_[:4]==b"RIFF" and bytes_[8:12]==b"WEBP"
report={"bodyPresentation":a.body,"clip":"idle","directions":8,"framesPerDirection":4,
"sourceFramePx":160,"atlasWidth":640,"atlasHeight":1280,
"bytes":len(bytes_),"sha256":hashlib.sha256(bytes_).hexdigest(),
"hasTransparency":True,"renderOnly":True,"sourceOriginal":True,"activatedInGame":False}
(dst/(a.body+"_idle.json")).write_text(json.dumps(report,indent=2),encoding="utf8")
print("ADULT_ATLAS_OK",json.dumps(report),flush=True)

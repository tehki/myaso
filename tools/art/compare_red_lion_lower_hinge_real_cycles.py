"""Compare genuine previous saved Blender Cycles raster against raised lower hinge."""
from PIL import Image,ImageDraw
from pathlib import Path
from io import BytesIO
import subprocess
root=Path(__file__).resolve().parents[2]
p=root/"assets/environment/greyhaven/a232-review"
artpath="assets/environment/greyhaven/a232-review/red_lion_a232_ironwork_640.png"
oldbytes=subprocess.run(["git","show","HEAD:"+artpath],cwd=root,check=True,stdout=subprocess.PIPE).stdout
old=Image.open(BytesIO(oldbytes)).convert("RGBA").transpose(Image.Transpose.FLIP_TOP_BOTTOM)
new=Image.open(p/"red_lion_a232_ironwork_640.png").convert("RGBA").transpose(Image.Transpose.FLIP_TOP_BOTTOM)
assert old.size==new.size==(640,640)
bounds=(270,265,380,355)
before=old.crop(bounds)
after=new.crop(bounds)
out=Image.new("RGB",(880,746),(57,67,60))
for i,patch in enumerate((before,after)):
  result=patch.resize((440,720),Image.Resampling.NEAREST)
  out.paste(result,(440*i,26),result.getchannel("A"))
draw=ImageDraw.Draw(out)
draw.text((8,4),"BEFORE | previous real Blender Z 0.72m",fill=(255,227,180))
draw.text((449,4),"AFTER | real Blender Z 0.96m (+24cm)",fill=(255,227,180))
dst=p/"red_lion_a232_lower_hinge_raised_blender_comparison.png"
out.save(dst,optimize=True)
print("BLENDER_REAL_PREVIOUS_VS_RAISED_LOWER_HINGE",dst,"bytes",dst.stat().st_size)

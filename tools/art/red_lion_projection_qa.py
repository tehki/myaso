from PIL import Image,ImageDraw
from pathlib import Path
p=Path(r"D:\myaso-graphics3b-a232-hinge-fix-20261022\assets\environment\greyhaven\a232-review")
q=Path(r"D:\myaso-graphics3b-a232-forged-iron-20261022\assets\environment\greyhaven\a232-review")
old=Image.open(q/"red_lion_a232_ironwork_640.png").convert("RGBA").transpose(Image.Transpose.FLIP_TOP_BOTTOM)
new=Image.open(p/"red_lion_a232_ironwork_640.png").convert("RGBA").transpose(Image.Transpose.FLIP_TOP_BOTTOM)
left,upper,right,lower=266,180,405,476
im=Image.new("RGB",(1120,1184),(65,75,70))
for i,x in enumerate((old,new)):
 crop=x.crop((left,upper,right,lower)).resize((560,1184),Image.Resampling.NEAREST)
 im.paste(crop,(560*i,0),crop.getchannel("A"))
draw=ImageDraw.Draw(im)
draw.text((8,10),"ORIGINAL 3D 2.5D PROJECTION",fill=(250,220,140))
draw.text((570,10),"CORRECTED 3D 2.5D PROJECTION",fill=(250,220,140))
im.save(p/"red_lion_a232_original_vs_attached_projection.png")

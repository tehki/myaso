"""First-party Graphics 3A 8-way kick / dash atlas + loop review packaging.
Consumes actual Blender-generated transparent PNG frames. Refuses static poses.
No original Silver atlas or production runtime is modified.
"""
from pathlib import Path
from PIL import Image,ImageChops,ImageDraw
import json,argparse,hashlib
p=argparse.ArgumentParser()
p.add_argument("--source",required=True)
p.add_argument("--out",required=True)
args=p.parse_args()
src=Path(args.source);out=Path(args.out)
out.mkdir(parents=True,exist_ok=True)
timing={
 "silver_kick_p0":{"ms":380,"sampleTimingsMs":[0,45,90,125,160,208,283,380],
   "gifFrameMs":[20,40,50,40,50,65,70,45],
   "phasesMs":{"windup":90,"active":70,"recovery":220}},
 "silver_dash_p0":{"ms":140,"sampleTimingsMs":[0,18,45,65,83,110,122,140],
   "gifFrameMs":[20,20,20,20,20,20,10,10],
   "phasesMs":{"dash":140}}
}
names={"silver_kick_p0":"kick","silver_dash_p0":"dash"}
assets={}
for clip,rule in timing.items():
 assert sum(rule["gifFrameMs"])==rule["ms"],rule
 atlas=Image.new("RGBA",(160*8,160*8),(0,0,0,0))
 perDirection=[]
 for direction in range(8):
  tiles=[]
  for f in range(8):
   path=src/f"{clip}_dir{direction}_frame{f}.png"
   assert path.is_file(),path
   im=Image.open(path)
   assert im.size==(160,160) and im.mode in ("RGBA","RGB"),(path,im.size,im.mode)
   im=im.convert("RGBA")
   assert im.getchannel("A").getbbox(),("empty mesh",path)
   atlas.alpha_composite(im,(f*160,direction*160))
   tiles.append(im)
  diff=ImageChops.difference(tiles[0],tiles[4])
  # Stop at authoring instead of silently distributing the previous blank idle
  # frame pretending it is a genuine kick/dash.
  differing=sum(1 for v in diff.convert("RGB").getdata() if v!=(0,0,0))
  assert differing>90,(clip,direction,differing,"animation too static")
  perDirection.append(differing)
 path=out/f"{clip}.webp";atlas.save(path,"WEBP",lossless=True,method=6)
 frames=[]
 for col in range(8):
  frame=Image.new("RGB",(8*166,190),(137,153,145))
  dr=ImageDraw.Draw(frame)
  for direction in range(8):
   tile=atlas.crop((col*160,direction*160,(col+1)*160,(direction+1)*160))
   frame.paste(tile,(direction*166,5),tile.getchannel("A"))
   dr.text((direction*166+5,168),f"{names[clip]} / dir {direction} / f{col+1}",fill=(24,36,30))
  frames.append(frame)
 gif=out/f"{clip}_8direction_loop.gif"
 frames[0].save(gif,save_all=True,append_images=frames[1:],
  duration=rule["gifFrameMs"],loop=0,optimize=False)
 assets[clip]={"atlas":path.name,"gif":gif.name,
  "atlasPx":[1280,1280],"frames":8,"directions":8,
  "framePx":[160,160],"durationMs":rule["ms"],
  "sampleTimingsMs":rule["sampleTimingsMs"],"gifTimingsMs":rule["gifFrameMs"],
  "phasesMs":rule["phasesMs"],
  "perDirectionChangedPixels":perDirection,
  "sha256":{"atlas":hashlib.sha256(path.read_bytes()).hexdigest(),
           "gif":hashlib.sha256(gif.read_bytes()).hexdigest()},
  "authored":True,"humanApproved":False,"integrationReady":False,
  "realGreyhaven":False}
 print("KICK_DASH_PACKED",clip,path.stat().st_size,gif.stat().st_size,perDirection,flush=True)
(out/"source_art_manifest.json").write_text(json.dumps({
 "author":"Graphics 3A offline Blender 4.5 first-party Silver pose actions",
 "originalSilverGlbBundled":False,"gameplayActivated":False,
 "newServerPackets":False,"realGroundContactValidated":False,
 "humanVisualApproved":False,
 "assets":assets},indent=2)+"\n",encoding="utf8")
print("KICK_DASH_SOURCE_ART_PACK_COMPLETE",len(assets),flush=True)

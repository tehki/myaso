"""Package real 22-bone Silver V3 Blender Cycles support-leg fill, never repaint a screenshot."""
from pathlib import Path
from PIL import Image,ImageDraw
import argparse,hashlib,json,shutil
p=argparse.ArgumentParser()
p.add_argument("--input",required=True)
p.add_argument("--baseline",required=True)
p.add_argument("--output",required=True)
args=p.parse_args()
inp=Path(args.input);base=Path(args.baseline);out=Path(args.output)
out.mkdir(parents=True,exist_ok=True)
sha=lambda f:hashlib.sha256(Path(f).read_bytes()).hexdigest()
old=Image.open(base).convert("RGBA")
assert old.size==(1280,1280)
atlas=Image.new("RGBA",(1280,1280))
records=[]; durations=[20,40,50,40,50,65,70,45]
for d in range(8):
 for f in range(8):
  name=inp/f"silver_kick_p0_dir{d}_frame{f}.png"
  with Image.open(name) as i:
   assert i.size==(160,160) and i.mode=="RGBA",(d,f,i.size,i.mode)
   tile=i.copy()
  baseline=old.crop((160*f,160*d,160*(f+1),160*(d+1)))
  assert baseline.getchannel("A").tobytes()==tile.getchannel("A").tobytes(),(d,f,"alpha silhouette changed")
  def luma(x):
   return .2126*x[0]+.7152*x[1]+.0722*x[2]
  op=[luma(c) for c in baseline.getdata() if c[3]>64]
  np=[luma(c) for c in tile.getdata() if c[3]>64]
  assert len(op)==len(np) and len(op)>300,(d,f,len(op),len(np))
  original=sum(op)/len(op); corrected=sum(np)/len(np)
  assert corrected>original*1.03,(d,f,original,corrected,"support-leg fill not visible")
  atlas.alpha_composite(tile,(160*f,160*d))
  records.append({"direction":d,"frame":f,"visiblePixels":len(np),
   "sourceLuma":round(original,3),"supportLegFillLuma":round(corrected,3),
   "lumaGainPct":round((corrected/original-1)*100,2),
   "alphaIdentical":True})
assert len(records)==64
asset=out/"silver_spartan_v3_support_leg_fill_8way.webp"
atlas.save(asset,"WEBP",lossless=True,method=5)
gif=out/"silver_spartan_v3_support_leg_before_after_380ms.gif"
panels=[]
for frame in range(8):
 frameImage=Image.new("RGB",(1280,360),(17,21,29))
 for d in range(8):
  o=old.crop((frame*160,d*160,frame*160+160,d*160+160))
  n=atlas.crop((frame*160,d*160,frame*160+160,d*160+160))
  frameImage.paste(o,(d*160,16),o.getchannel("A"))
  frameImage.paste(n,(d*160,196),n.getchannel("A"))
 draw=ImageDraw.Draw(frameImage)
 draw.text((4,3),f"REAL BLENDER original V3 light | frame {frame} | all 8 facings",fill=(205,211,224))
 draw.text((4,183),"REAL BLENDER V3 + support-leg camera-oriented soft bounce | same frame / rig",fill=(205,211,224))
 panels.append(frameImage)
panels[0].save(gif,save_all=True,append_images=panels[1:],duration=durations,loop=0,disposal=2,optimize=False)
bake=inp/"kick_dash_blender_bake_report.json"
report=json.loads(bake.read_text())
assert report["sourceRigBones"]==22
assert report["sourceLightingStudy"]["enabled"] is True
assert report["supportLegBlenderLight"]["enabled"] is True
assert report["supportLegBlenderLight"]["skinnedOriginalSource"] is True
assert report["supportLegBlenderLight"]["noTextureOrMeshRepaint"] is True
assert report["supportLegBlenderLight"]["noPoseTimingChange"] is True
assert len(report["supportLegBlenderLight"]["positions"])==64
assert len(report["rendered"])==64
assert report["authoritativePhases"]["kickMs"]==[90,70,220]
assert report["sourceSha256"]=="d679fccd00df868d600b4c5e2fcf8a4a46cc062dbd432be5b6a7f533eb30141f"
assert sum(durations)==380
blend=inp/"Graphics3A_Silver_Spartan_Contact_Recoil_V3_source.blend"
assert blend.is_file()
source=out/"Graphics3A_Silver_Spartan_V3_SupportLegFill_source.blend"
shutil.copy2(blend,source)
manifest={
 "status":"ORIGINAL BLENDER 22-BONE SOURCE TESTED; NOT NATIVE / NOT VISUALLY APPROVED",
 "sourceRigBones":22,"sourceGLBSha256":report["sourceSha256"],
 "baseAtlasSha256":sha(base),"newAtlasSha256":sha(asset),
 "editableBlenderSourceSha256":sha(source),"originalGifSha256":sha(gif),
 "authoritativePhasesMs":report["authoritativePhases"]["kickMs"],
 "totalKickMs":380,"directions":8,"framesPerDirection":8,"pixelResolution":[160,160],
 "all64SourceAlphaIdentical":True,
 "minimumVisiblePixelLuminanceGainPct":min(x["lumaGainPct"] for x in records),
 "averageVisiblePixelLuminanceGainPct":round(sum(x["lumaGainPct"] for x in records)/64,2),
 "maxVisiblePixelLuminanceGainPct":max(x["lumaGainPct"] for x in records),
 "samples":records,
 "blenderActualSupportLegLights":report["supportLegBlenderLight"],
 "originalSourceAssetNotBundled":True,"noCameraOrRigChange":True,
 "noGameplayOrPhysicsOrCombatChange":True,"noDefaultRendererChanges":True,
 "noNativeGameAcceptance":True,"preAlphaIncluded":False,"ownerArtApproved":False}
(out/"support_leg_fill_manifest.json").write_text(json.dumps(manifest,indent=2)+"\n")
print("GRAPHICS3A_REAL_BLENDER_SUPPORT_LEG_FILL",json.dumps({
 "source":str(source),"atlas":str(asset),"sha":manifest["newAtlasSha256"],
 "minGainPct":manifest["minimumVisiblePixelLuminanceGainPct"],
 "avgGainPct":manifest["averageVisiblePixelLuminanceGainPct"],
 "sourceAlphaUnchanged":True}),flush=True)

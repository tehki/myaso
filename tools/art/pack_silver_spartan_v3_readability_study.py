"""Package original Blender Silver Spartan V3 *source-only* light study.
Never replace the existing V3 gameplay atlas or owner Silver/Pre-Alpha assets.
"""
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
sha=lambda f: hashlib.sha256(Path(f).read_bytes()).hexdigest()
with Image.open(base) as i:
 assert i.size==(1280,1280) and i.mode=="RGBA"
 old=i.copy()
atlas=Image.new("RGBA",(1280,1280))
records=[]
for d in range(8):
 for f in range(8):
  file=inp/f"silver_kick_p0_dir{d}_frame{f}.png"
  with Image.open(file) as img:
   assert img.size==(160,160) and img.mode=="RGBA"
   tile=img.copy()
  previous=old.crop((f*160,d*160,(f+1)*160,(d+1)*160))
  mask0=previous.getchannel("A")
  mask1=tile.getchannel("A")
  assert mask0.getbbox()==mask1.getbbox(),(d,f,"unexpected original silhouette drift")
  assert mask0.tobytes()==mask1.tobytes(),(d,f,"alpha changed; light-only study must not change geometry")
  def mean_luma(img):
   pixels=[(.2126*r+.7152*g+.0722*b) for r,g,b,a in img.getdata() if a>64]
   assert len(pixels)>300,(d,f)
   return sum(pixels)/len(pixels),len(pixels)
  a,n=mean_luma(previous);b,m=mean_luma(tile)
  assert n==m
  assert b>a*1.05,(d,f,round(a,2),round(b,2),"not legibly brighter")
  records.append({"direction":d,"phase":f,"visiblePixels":n,
                  "sourceMeanLuma":round(a,3),"studyMeanLuma":round(b,3),
                  "lumaGainPct":round((b/a-1)*100,2),
                  "sourceAlphaIdentical":True})
  atlas.alpha_composite(tile,(f*160,d*160))
asset=out/"silver_spartan_v3_readable_light_study_8x8.webp"
atlas.save(asset,"WEBP",lossless=True,method=5)
assert Image.open(asset).size==(1280,1280)
durations=[20,40,50,40,50,65,70,45]
assert sum(durations)==380
panels=[]
for f in range(8):
 sheet=Image.new("RGB",(1280,360),(129,144,141))
 for d in range(8):
  before=old.crop((f*160,d*160,(f+1)*160,(d+1)*160))
  after=atlas.crop((f*160,d*160,(f+1)*160,(d+1)*160))
  sheet.paste(before,(d*160,10),before.getchannel("A"))
  sheet.paste(after,(d*160,190),after.getchannel("A"))
 draw=ImageDraw.Draw(sheet)
 draw.text((5,1),f"Original Spartan V3, frame {f}",fill=(18,29,25))
 draw.text((5,181),f"V3 source lighting study (not game), frame {f}",fill=(18,29,25))
 panels.append(sheet)
gif=out/"silver_spartan_v3_normal_vs_light_study_8way_380ms.gif"
panels[0].save(gif,save_all=True,append_images=panels[1:],duration=durations,loop=0,optimize=False,disposal=2)
sourceblend=inp/"Graphics3A_Silver_Spartan_Contact_Recoil_V3_source.blend"
assert sourceblend.is_file()
destblend=out/"Graphics3A_Silver_Spartan_V3_ReadableLight_Study_source.blend"
shutil.copy2(sourceblend,destblend)
report=json.loads((inp/"kick_dash_blender_bake_report.json").read_text())
assert report["sourceRigBones"]==22 and report["sourceLightingStudy"]["enabled"]
assert report["sourceLightingStudy"]["noGameplayOrPhysicsModification"]
assert len(report["rendered"])==64
manifest={
 "classification":"SOURCE TESTED / VISUAL REVIEW HOLD / NOT GAMEPLAY INTEGRATED",
 "originalRigBones":22,
 "originalSourceSha256":report["sourceSha256"],
 "originalV3AtlasSha256":sha(base),
 "newStudyAtlasSha256":sha(asset),
 "studyBlendSha256":sha(destblend),
 "comparisonGifSha256":sha(gif),
 "originalV3AtlasUnmodified":True,
 "sourceOriginalMeshNotBundled":True,
 "onlyCyclesLightingChanged":True,
 "noCameraOrActorRootChanges":True,
 "noCombatOrPhysicsChanges":True,
 "actionDurationMs":380,
 "renderedCells":64,"directionCount":8,"sourceFramesPerDirection":8,
 "sourceCellPx":[160,160],"studyAtlasPx":[1280,1280],
 "allCellsIdenticalSilhouette":True,
 "minimumSourceLumaGainPct":min(x["lumaGainPct"] for x in records),
 "averageSourceLumaGainPct":round(sum(x["lumaGainPct"] for x in records)/64,2),
 "sourceLighting":report["sourceLightingStudy"],
 "sampledFrames":records,
 "gameplayScaleValidated":False,
 "nativeMultiplayerValidated":False,
 "greyhavenBootSoleValidated":False,
 "humanVisualApproved":False,
 "defaultRendererActivated":False,
 "preAlphaIncluded":False
}
(out/"spartan_v3_readability_study_manifest.json").write_text(json.dumps(manifest,indent=2)+"\n")
print("GRAPHICS3A_ORIGINAL_V3_LIGHT_STUDY",json.dumps({
 "atlasSHA":sha(asset),"minGainPct":manifest["minimumSourceLumaGainPct"],
 "avgGainPct":manifest["averageSourceLumaGainPct"],
 "unchangedSourceAlpha64":True,"sourceOnly":True}),flush=True)

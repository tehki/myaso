"""Build fully-offline authentic original Silver motion reviewer.
Embeds approved legacy baselines plus genuinely re-rendered Blender atlas candidates.
No remote image requests, no CSS exposure hacks, no PNG retouch.
"""
import argparse,base64,hashlib,json,re
from pathlib import Path
from PIL import Image
CLIPS=("idle","walk","sprint","jump")
p=argparse.ArgumentParser()
p.add_argument("--base",required=True)
p.add_argument("--atlas-folder",required=True)
p.add_argument("--manifest",required=True)
p.add_argument("--output",required=True)
args=p.parse_args()
base=Path(args.base)
folder=Path(args.atlas_folder)
manifest=json.loads(Path(args.manifest).read_text(encoding="utf8"))
assert manifest["source"]["sourceSHA256"]=="d679fccd00df868d600b4c5e2fcf8a4a46cc062dbd432be5b6a7f533eb30141f"
html=base.read_text(encoding="utf8")
pattern=r"const CLIPS = (\[.+?\]);\nconst SIZE="
m=re.search(pattern,html,flags=re.S)
assert m and len(m.group(1))>1000000,"Expect original offline seven-authored-atlas HTML"
clips=json.loads(m.group(1))
assert [c["id"] for c in clips]==["idle","walk","sprint","jump","roll","kick","fall"]
for c in clips:
  if c["id"] not in CLIPS:continue
  clip=c["id"]
  info=manifest["atlas"][clip]
  file=folder/info["path"]
  data=file.read_bytes()
  assert hashlib.sha256(data).hexdigest()==info["sha256"]
  assert len(info["cells"])==8*info["frames"]
  with Image.open(file) as sheet:
    assert sheet.size==(info["frames"]*160,1280)
  c["legacyData"]=c["data"]
  c["legacySha"]=c["sha"]
  c["data"]="data:image/webp;base64,"+base64.b64encode(data).decode("ascii")
  c["sha"]=info["sha256"]
  c["bytes"]=len(data)
  c["desc"]="Real Blender 5.2.2 Roll-studio relight · source review"
  c["group"]="Experimental"
new=json.dumps(clips,ensure_ascii=False,separators=(",",":"))
assert html.count(m.group(1))==1
html=html.replace(m.group(1),new,1)
# New Blender source rows use exactly the already reviewed Roll camera order:
# remap ONLY the old, dark legacy camera-row convention when toggle requests it.
old=''' const row=["idle","walk","sprint","jump"].includes(obj.c.id) ? (8-face)%8 : face;'''
newrow=''' const row=oldSource&&["idle","walk","sprint","jump"].includes(obj.c.id) ? (8-face)%8 : face;'''
assert html.count(old)==1
html=html.replace(old,newrow,1)
# Source toggle is a genuine visual A/B between different Blender WebP bytes,
# not CSS brightness or a postprocess filter.
point='''const items=CLIPS.map((c,i)=>{'''
assert html.count(point)==1
html=html.replace(point,'''let oldSource=false;
const items=CLIPS.map((c,i)=>{''',1)
oldctrl='''<div class="ctrl"><label for="speed">Speed</label>'''
newctrl='''<div class="ctrl"><label for="sourceLighting">Locomotion lighting</label><select id="sourceLighting"><option value="relit">New Blender Roll studio</option><option value="original">Original dark source</option></select></div>
<div class="ctrl"><label for="speed">Speed</label>'''
assert html.count(oldctrl)==1
html=html.replace(oldctrl,newctrl,1)
anchor='''document.getElementById("restart").onclick=()=>{ms=0;last=0;items.forEach(paint)};'''
assert html.count(anchor)==1
html=html.replace(anchor,'''document.getElementById("sourceLighting").onchange=e=>{
 oldSource=e.target.value==="original";
 for(const o of items){
  if(!o.c.legacyData)continue;
  o.ready=false;
  o.img.src=oldSource?o.c.legacyData:o.c.data;
  o.label.textContent=oldSource?"ORIGINAL DARK SOURCE":"GENUINE BLENDER RELIGHT";
 }
};
'''+anchor,1)
assert 'relit' in html
html=html.replace('Seven real, Blender-sourced motion renders. Five are the current Pre-Alpha subset; Spartan Kick V3 and Knockdown V2 are separate draft art for review.', 'Seven original Knight motions. Idle, Walk, Sprint and Jump show newly relit original Blender/Cycles review atlases by default, with a real dark-source comparison toggle. Roll remains unchanged; Kick uses normal V3 light; Knockdown is unchanged.')
html=html.replace('7 / 7 authentic source atlases embedded','11 / 11 authentic source atlases embedded')
html=html.replace('Original 8-way source · review-only motion playback','Eight real Blender directions · new vs old light')
html=html.replace('the original five-file Pre-Alpha bundle has no kick atlas.', 'the original five-file Pre-Alpha bundle has no kick atlas.')
html=html.replace('All seven files SHA-256 verified before embedding.', 'All eleven original source and relit WebPs SHA-256 verified before embedding; four new source atlases are distinct, not approved Pre-Alpha replacements.')
html=html.replace('User-reported dark baseline actions await original Blender source relighting.', 'The original dark base source is available via the lighting toggle; the relit Blender source is an unmerged review candidate.')
html=html.replace('original five verified from Pre-Alpha candidate', 'original dark five preserved from Pre-Alpha candidate')
out=Path(args.output)
out.parent.mkdir(parents=True,exist_ok=True)
out.write_text(html,encoding="utf8")
print("GRAPHICS3A_NEW_BLENDER_RELIGHT_OFFLINE_HTML",out,len(new),out.stat().st_size)
for c in clips:print("REVIEW_ATLAS",c["id"],c["sha"],c.get("legacySha","unchanged"))

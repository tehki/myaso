"""Original Silver Knight three-way, fully offline, source-authentic review.
Adds new Blender 1.29-ortho game-scale WebPs; preserves verified 1.66 Roll
camera and original dark sources without modifying any of their raw pixels.
"""
import argparse,base64,hashlib,json,re
from pathlib import Path
from PIL import Image
from ground_silver_gallery_preview import anchor_ground

p=argparse.ArgumentParser()
p.add_argument("--base",required=True)
p.add_argument("--atlas-folder",required=True)
p.add_argument("--manifest",required=True)
p.add_argument("--output",required=True)
args=p.parse_args()
base=Path(args.base)
folder=Path(args.atlas_folder)
source=json.loads(Path(args.manifest).read_text(encoding="utf8"))
assert source["source"]["sourceSHA256"]=="d679fccd00df868d600b4c5e2fcf8a4a46cc062dbd432be5b6a7f533eb30141f"
assert abs(source["source"]["cameraOrthoScale"]-1.29)<1e-8
html=base.read_text(encoding="utf8")
pattern=r"const CLIPS = (\[.+?\]);\nconst SIZE="
m=re.search(pattern,html,flags=re.S)
assert m is not None and len(m.group(1))>2000000
clips=json.loads(m.group(1))
assert [c["id"] for c in clips]==["idle","walk","sprint","jump","roll","kick","fall"]
for c in clips[:4]:
    info=source["atlas"][c["id"]]
    file=folder/info["path"]
    data=file.read_bytes()
    assert hashlib.sha256(data).hexdigest()==info["sha256"]
    assert len(info["cells"])==8*c["frames"]
    assert all(min(cell["alphaBBox"][0],cell["alphaBBox"][1],
                   160-cell["alphaBBox"][2],160-cell["alphaBBox"][3])>=4
               for cell in info["cells"]), "No clipped original frame allowed"
    with Image.open(file) as atlas:
        assert atlas.size==(160*c["frames"],1280)
    assert c["legacyData"] and c["legacySha"] and c["data"] and c["sha"]
    c["rollData"]=c["data"]
    c["rollSha"]=c["sha"]
    c["data"]="data:image/webp;base64,"+base64.b64encode(data).decode("ascii")
    c["sha"]=info["sha256"]
    c["desc"]="Original Blender 5.2.2 · game-scale 1.29 camera · art review"
    c["bytes"]=len(data)
for c in clips[4:]:
    assert "rollData" not in c and "legacyData" not in c
before=m.group(1)
html=html.replace(before,json.dumps(clips,ensure_ascii=False,separators=(",",":")),1)
# Keep selected original-source remap exactly in the current working gallery.
assert 'const row=oldSource&&["idle","walk","sprint","jump"].includes(obj.c.id) ? (8-face)%8 : face;' in html

old='''<div class="ctrl"><label for="sourceLighting">Locomotion lighting</label><select id="sourceLighting"><option value="relit">New Blender Roll studio</option><option value="original">Original dark source</option></select></div>'''
new='''<div class="ctrl"><label for="sourceLighting">Locomotion art</label><select id="sourceLighting"><option value="game">New relight · matched game size</option><option value="roll">New relight · Roll camera size</option><option value="original">Original dark source</option></select></div>'''
assert html.count(old)==1
html=html.replace(old,new,1)
old_script='''document.getElementById("sourceLighting").onchange=e=>{
 oldSource=e.target.value==="original";
 for(const o of items){
  if(!o.c.legacyData)continue;
  o.ready=false;
  o.img.src=oldSource?o.c.legacyData:o.c.data;
  o.label.textContent=oldSource?"ORIGINAL DARK SOURCE":"GENUINE BLENDER RELIGHT";
 }
};'''
new_script='''document.getElementById("sourceLighting").onchange=e=>{
 const version=e.target.value;
 oldSource=version==="original";
 for(const o of items){
  if(!o.c.legacyData)continue;
  const imageSrc=version==="original" ? o.c.legacyData : version==="roll" ? o.c.rollData : o.c.data;
  const sha=version==="original" ? o.c.legacySha : version==="roll" ? o.c.rollSha : o.c.sha;
  const foot=o.canvas.closest(".card");
  foot.querySelector(".meta span:last-child").textContent="SHA "+sha.slice(0,12)+"…";
  foot.querySelector(".meta span:last-child").title="Full SHA256: "+sha;
  foot.querySelector(".card-foot span:first-child").textContent=
    version==="original" ? "Original dark Blender atlas · 320px bake → 160px" :
    version==="roll" ? "Blender relight · original Roll camera 1.66 ortho" :
    "Blender relight · adjusted game-scale 1.29 ortho";
  o.ready=false;
  o.label.textContent=version==="original" ? "ORIGINAL DARK SOURCE" :
    version==="roll" ? "CYCLES ROLL CAMERA 1.66" : "CYCLES GAME SIZE 1.29";
  o.img.src=imageSrc;
 }
};'''
assert html.count(old_script)==1
html=html.replace(old_script,new_script,1)
assert '11 / 11 authentic source atlases embedded' in html
html=html.replace('11 / 11 authentic source atlases embedded','15 / 15 authentic source atlases embedded')
html=html.replace('Eleven','Fifteen')
html=html.replace('All eleven original source and relit WebPs SHA-256 verified before embedding','All fifteen original source and two-size relit WebPs SHA-256 verified before embedding')
html=html.replace('Seven original Knight motions. Idle, Walk, Sprint and Jump show newly relit original Blender/Cycles review atlases by default, with a real dark-source comparison toggle.', 'Seven authentic Knight motions. Idle, Walk, Sprint and Jump show genuine Blender/Cycles lighting at adjusted game-size camera framing by default; compare Roll camera framing and original dark source with the art selector.')
html=html.replace('The original dark base source is available via the lighting toggle; the relit Blender source is an unmerged review candidate.', 'The original dark source, 1.66 Roll-framed relight and 1.29 size-matched Blender relight are original separate WebP byte sources, selectable without CSS retouch or a merge.')
html=html.replace('New Blender Roll studio', 'New Blender game-scale framing')
html=html.replace('Eight real Blender directions · new vs old light','Eight Blender directions · real source comparison')
html=html.replace('<title>myaso.io — Original Silver Knight Animation Gallery (offline)</title>','<title>myaso.io — Silver Knight Three-Source Art Review (offline)</title>')
out=Path(args.output)
out.parent.mkdir(parents=True,exist_ok=True)
out.write_text(anchor_ground(html),encoding="utf8")
print("THREE_SOURCE_GALLERY",out,out.stat().st_size)
for c in clips:print("GALLERY_SRC",c["id"],c["sha"],c.get("rollSha",""),c.get("legacySha",""))

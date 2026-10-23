"""Package verified original Blender source dash frames for visual review only."""
from PIL import Image, ImageChops, ImageDraw
from pathlib import Path
import argparse,hashlib,json,base64

parser=argparse.ArgumentParser()
parser.add_argument("--frames",required=True)
parser.add_argument("--out",required=True)
parser.add_argument("--baseline",required=True)
a=parser.parse_args()
src=Path(a.frames);out=Path(a.out);out.mkdir(parents=True,exist_ok=True)
legacy=Path(a.baseline)
assert legacy.is_file()
old=Image.open(legacy).convert("RGBA")
assert old.size==(1280,1280)
frames=[]
atlas=Image.new("RGBA",(1280,1280),(0,0,0,0))
margin=161
changed=[]
bottom_by_direction=[]
for row in range(8):
    cells=[]
    bottoms=[]
    for col in range(8):
        fn=src/f"silver_dash_traction_p0_dir{row}_frame{col}.png"
        assert fn.is_file(),fn
        im=Image.open(fn).convert("RGBA")
        assert im.size==(160,160)
        bbox=im.getchannel("A").getbbox()
        assert bbox,(row,col,"empty")
        m=min(bbox[0],bbox[1],160-bbox[2],160-bbox[3])
        assert m>=4,(row,col,"clipped source frame",bbox)
        margin=min(margin,m)
        bottoms.append(bbox[3])
        atlas.alpha_composite(im,(col*160,row*160))
        cells.append(im)
    pixels=sum(1 for val in ImageChops.difference(cells[0],cells[4]).convert("RGB").getdata() if val!=(0,0,0))
    assert pixels>90,(row,"static motion",pixels)
    changed.append(pixels)
    bottom_by_direction.append(bottoms)
out_webp=out/"silver_dash_traction_p0.webp"
atlas.save(out_webp,"WEBP",lossless=True,method=6)
verify=Image.open(out_webp).convert("RGBA")
assert verify.size==(1280,1280)
assert ImageChops.difference(verify,atlas).getbbox() is None,"WebP pixel or alpha roundtrip changed"
photos=[]
timings=[20,18,19,19,19,19,13,13]
assert sum(timings)==140
for col in range(8):
    im=Image.new("RGB",(8*166,182),(139,155,146))
    dr=ImageDraw.Draw(im)
    for row in range(8):
        sub=atlas.crop((col*160,row*160,(col+1)*160,(row+1)*160))
        im.paste(sub,(row*166,2),sub.getchannel("A"))
        dr.text((row*166+2,165),f"Dash d{row} t{[0,10,26,45,72,96,119,140][col]}ms",fill=(25,33,26))
    photos.append(im)
gif=out/"silver_dash_traction_8direction_loop.gif"
photos[0].save(gif,save_all=True,append_images=photos[1:],duration=timings,loop=0,optimize=False)
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
manifest={
 "status":"AUTHENTIC_BLENDER_SOURCE_ART_ONLY_HUMAN_VISUAL_HOLD",
 "action":"Graphics3A_P0_Silver_Dash_Traction_140ms",
 "phaseSamplesMs":[0,10,26,45,72,96,119,140],
 "durationMs":140,"directionRows":8,"samplesPerRow":8,
 "frameSizePx":[160,160],"atlasSizePx":[1280,1280],
 "frameMinimumTransparentMarginPx":margin,
 "genuineSourcePixelChangeFromFirstToMidPerDirection":changed,
 "originalSourceBottomPixelPositionsByDirection":bottom_by_direction,
 "serverRootTranslation":False,"realWorldFootContactValidated":False,
 "originalKnightGlbRedistributed":False,"runtimeEnabled":False,"artApproved":False,
 "assets":{"oldDash":{"name":legacy.name,"sha256":digest(legacy)},
           "newDash":{"name":out_webp.name,"sha256":digest(out_webp)},
           "newGif":{"name":gif.name,"sha256":digest(gif)}}
}
(out/"dash_traction_manifest.json").write_text(json.dumps(manifest,indent=2)+"\n",encoding="utf-8")
oldData=base64.b64encode(legacy.read_bytes()).decode("ascii")
newData=base64.b64encode(out_webp.read_bytes()).decode("ascii")
html=r"""<!doctype html><html lang="en"><meta charset="utf-8">
<title>Silver Knight DASH · 140ms · genuine Blender A/B</title>
<style>
body{margin:0;padding:24px;background:#19251f;color:#f2eddc;font:16px system-ui,sans-serif}
main{max-width:1000px;margin:auto}h1{font-size:26px}p{line-height:1.55}
fieldset{border:1px solid #718079;padding:14px;margin:16px 0}
label{margin-right:20px}
section{display:flex;flex-wrap:wrap;gap:20px}.tile{background:#27382e;padding:15px;flex:1;min-width:270px}
canvas{width:256px;height:256px;max-width:100%;background:repeating-conic-gradient(#64766b 0 25%,#475d50 0 50%) 50%/20px 20px;image-rendering:auto}
small{color:#d5dbcb}button,select,input{font:inherit}
</style><main><h1>Silver Knight · 140 ms Dash</h1>
<p>Authentic 22-bone Blender source art. Side-by-side original eight-way dash and newly authored coil → drive → catch → brake study. Neither variant changes authoritative movement or the live game.</p>
<fieldset><label>Direction <select id="dir"></select></label>
<label>Speed <select id="speed"><option value="0.25">0.25×</option><option value="0.5">0.5×</option><option value="1" selected>1×</option></select></label>
<label><input id="pause" type="checkbox"> Pause</label>
<button id="restart">Restart</button><label>Frame <input id="scrub" type="range" min="0" max="7" value="0"></label>
<strong id="phase"></strong></fieldset>
<section><div class="tile"><h2>Original P0 Dash</h2><canvas id="old" width="160" height="160"></canvas>
<p><small>Legacy 1.66 orthographic source framing. Eight original Blender phases.</small></p></div>
<div class="tile"><h2>Dash · Traction Study</h2><canvas id="new" width="160" height="160"></canvas>
<p><small>Re-authored push, drive, leg catch and brake. 1.29 game-size studio framing.</small></p></div></section>
<p><small>Visual review only. Transparent sprite poses are not real physics ground contact. No hitboxes, dash speed, Combat rules, server packets or production assets are changed. All frames and source atlas hashes are checked in the manifest.</small></p>
<script>
const oldImage=new Image(),newImage=new Image();
oldImage.src="OLD_SRC";newImage.src="NEW_SRC";
const phases=[0,10,26,45,72,96,119,140],names=["N","NE","E","SE","S","SW","W","NW"];
const dirs=document.querySelector("#dir");names.forEach((x,i)=>{let opt=document.createElement("option");opt.value=i;opt.textContent=x;dirs.append(opt)});
const slider=document.querySelector("#scrub"),pause=document.querySelector("#pause"),phase=document.querySelector("#phase");
let start=performance.now(),held=0;
function draw(img,id,row,col){if(!img.complete||!img.naturalWidth)return;const ctx=document.querySelector(id).getContext("2d");ctx.clearRect(0,0,160,160);ctx.drawImage(img,col*160,row*160,160,160,0,0,160,160)}
function render(t){const duration=140;const speed=Number(document.querySelector("#speed").value);
 if(!pause.checked){held=((t-start)*speed)%duration;let i=0;while(i<7&&held>=phases[i+1])i++;slider.value=i;}
 const ix=Number(slider.value),row=Number(dirs.value||0);
 draw(oldImage,"#old",row,ix);draw(newImage,"#new",row,ix);
 phase.textContent="Source frame "+(ix+1)+"/8 · "+phases[ix]+"ms";
 requestAnimationFrame(render);}
document.querySelector("#restart").onclick=()=>{start=performance.now();held=0;slider.value=0};
pause.onchange=()=>{if(!pause.checked)start=performance.now()-held/Number(document.querySelector("#speed").value)};
slider.oninput=()=>{pause.checked=true;held=phases[Number(slider.value)]};
requestAnimationFrame(render);
</script></main></html>"""
html=html.replace("OLD_SRC","data:image/webp;base64,"+oldData).replace("NEW_SRC","data:image/webp;base64,"+newData)
(out/"silver_dash_traction_review_offline.html").write_text(html,encoding="utf-8")
print("DASH_TRACTION_PACK_PASS",json.dumps({"sourceImages":64,"marginMinPx":margin,"changedPixels":changed,"newSha256":digest(out_webp),"viewerBytes":len(html),"gifBytes":gif.stat().st_size}),flush=True)
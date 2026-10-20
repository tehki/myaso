#!/usr/bin/env python3
"""Blood & Iron A2.28: Red Lion facade-only joinery/masonry and local light studies.

Reproducible Pillow overlays on original A2.24 lossless Blender-derived facade.
Roof copied byte-for-byte from A2.26. No structural changes or live lighting engine.
"""
import argparse, hashlib, json, math
from pathlib import Path
from PIL import Image, ImageDraw, ImageChops, ImageFilter

ap=argparse.ArgumentParser()
ap.add_argument("--repo",type=Path,default=Path(__file__).resolve().parents[2])
args=ap.parse_args()
root=args.repo
assets=root/"assets/environment/greyhaven"
output=assets/"a228-review"
output.mkdir(parents=True,exist_ok=True)
handoff=json.loads((assets/"red-lion-a225-architecture-handoff.json").read_text("utf8"))
assert handoff["projection"]["visualDoorCanvasPx"]==[320,320]
source=handoff["rasterLayers"]["base"]
roof_info=json.loads((assets/"a226-review/greyhaven_a226_weathering_report.json").read_text("utf8"))
def sha(v):return hashlib.sha256(v).hexdigest()
def exact_load(path,expected):
    raw=path.read_bytes()
    assert sha(raw)==expected,path
    with Image.open(path) as im:return im.convert("RGBA"),raw
original_crop,original_base_bytes=exact_load(root/source["file"],source["sha256"])
assert list(original_crop.size)==source["croppedPixels"]
roof,roof_bytes=exact_load(assets/"a226-review/red_lion_a226_roof.webp",roof_info["newRoofSha256"])
# keep previous roof *byte-identical*. This milestone is explicitly not roof work.
(output/"red_lion_a228_roof.webp").write_bytes(roof_bytes)
assert sha((output/"red_lion_a228_roof.webp").read_bytes())==roof_info["newRoofSha256"]
canvas_origin=(320+round(source["drawOffsetFromVisualDoorPixels"][0]),
               320+round(source["drawOffsetFromVisualDoorPixels"][1]))
base=Image.new("RGBA",(640,640))
base.alpha_composite(original_crop,canvas_origin)
alpha=base.getchannel("A")
assert alpha.getbbox()==tuple(handoff["rasterLayers"]["base"]["alphaBoundsCanvasPx"])
def mix(a,b,t):return int(round(a*(1-t)+b*t))
def authored_facade():
    layer=Image.new("RGBA",(640,640))
    d=ImageDraw.Draw(layer)
    # Hand-authored contact depth along stone foundation: staggered joint courses.
    for y in (314,321,329,336):
        d.line((211,y,431,y),fill=(30,29,26,38 if y!=321 else 55),width=1)
        d.line((211,y-1,431,y-1),fill=(241,225,194,24),width=1)
    for row, xs in ((316,(225,252,281,366,395,417)),
                    (324,(214,242,269,293,353,382,408)),
                    (333,(229,260,289,364,399))):
        for x in xs:
            d.line((x,row,x+1,row+6),fill=(41,39,34,60),width=1)
            d.point((x+2,row+1),fill=(241,230,207,34))
    # Weathered mineral grains restricted to the original lower masonry area.
    for y in range(313,341,4):
        for x in range(217+(y%6),428,12):
            d.line((x,y,x+2,y),fill=(247,231,202,22),width=1)
            if (x+y)%3==0:d.point((x+5,y+2),fill=(51,51,46,24))
    # Actual source half-timber edges with slight uneven grain.
    for x in (214,241,394,426):
        d.line((x,248,x,313),fill=(23,16,11,47),width=2)
        d.line((x+2,248,x+2,313),fill=(247,201,148,33),width=1)
        for y in range(251,310,8):
            d.line((x+2,y,x+3,y+4),fill=(55,34,22,28),width=1)
    for y in (281,304):
        d.line((219,y,296,y),fill=(34,23,17,44),width=2)
        d.line((344,y,422,y),fill=(34,23,17,44),width=2)
        d.line((219,y-2,296,y-2),fill=(255,206,146,32))
        d.line((344,y-2,422,y-2),fill=(255,206,146,32))
    # Window mullions, sill contact relief and tiny forged latch/hinge details.
    for xa,xb in ((248,277),(357,386)):
        mid=(xa+xb)//2
        d.line((mid,258,mid,283),fill=(53,37,28,72),width=2)
        d.line((xa+2,270,xb-2,270),fill=(49,34,27,45),width=1)
        d.line((xa,285,xb+1,285),fill=(26,24,22,70),width=2)
        d.line((xa+1,287,xb+3,287),fill=(241,214,177,40),width=1)
        d.line((xa-5,260,xa-2,260),fill=(36,38,34,80),width=2)
        d.line((xb+3,277,xb+7,277),fill=(35,36,34,75),width=2)
        d.point((xa+5,280),fill=(250,239,213,76))
    # Red Lion wooden threshold: recessed jambs, stone-to-wood transition.
    d.line((296,256,296,314),fill=(28,22,16,85),width=3)
    d.line((297,256,297,313),fill=(236,186,128,52))
    d.line((344,254,344,313),fill=(40,27,18,72),width=2)
    d.line((346,255,346,311),fill=(243,204,149,30))
    d.line((297,314,345,314),fill=(31,26,21,88),width=2)
    d.line((300,317,343,317),fill=(238,210,175,62))
    d.line((295,324,350,324),fill=(43,39,33,60),width=2)
    # Forged strap hinges, keyplate, plank weathering and hanging sign rim.
    for y in (275,294):
        d.line((304,y,315,y),fill=(32,32,30,80),width=2)
        for x in (306,312):d.point((x,y),fill=(207,172,121,100))
    d.rectangle((332,283,336,290),outline=(31,32,31,100),width=1)
    d.point((334,286),fill=(234,204,151,87))
    for x in (310,319,330):
        d.line((x,261,x-2,302),fill=(55,32,21,23),width=1)
    d.line((316,240,332,240),fill=(55,34,25,50),width=2)
    d.line((316,242,332,242),fill=(243,195,127,36))
    return layer

detail=authored_facade()
def daylight():
    out=Image.alpha_composite(base,detail)
    # Diffuse daylight facade lift from upper-left (subtle, RGB only).
    pixels=list(out.get_flattened_data())
    new=[]
    for idx,(r,g,b,a) in enumerate(pixels):
        x,y=idx%640,idx//640
        lift=max(0.0,(1.0-(y-230)/160))*1.9
        new.append((min(255,int(r+lift)),min(255,int(g+lift*.8)),
                    min(255,int(b+lift*.55)),a))
    out.putdata(new)
    out.putalpha(alpha)
    return out
day=daylight()
def dusk(day_img):
    # Scene-level sky/ambient color is deliberately owned by 3C. This is only
    # the Red Lion material response / small window and threshold warm spill.
    tint=Image.new("RGBA",day_img.size)
    dst=[]
    for r,g,b,a in day_img.get_flattened_data():
        dst.append((int(r*.70+9),int(g*.70+5),int(b*.80+7),a))
    tint.putdata(dst)
    mask=Image.new("L",(640,640))
    m=ImageDraw.Draw(mask)
    for x in (263,372):
        m.ellipse((x-29,249,x+29,309),fill=140)
    m.ellipse((300,250,345,329),fill=65)
    glow=mask.filter(ImageFilter.GaussianBlur(15))
    warm=Image.new("RGBA",(640,640),(243,158,76,0))
    warm.putalpha(glow)
    out=Image.alpha_composite(tint,warm)
    # Warm interior apertures without enlarging their original shapes.
    small=Image.new("RGBA",(640,640))
    d=ImageDraw.Draw(small)
    for left,right in ((251,275),(360,384)):
        d.rectangle((left+2,260,right-2,281),fill=(244,173,88,66))
        d.line((left+3,262,right-3,262),fill=(255,208,132,85))
    out=Image.alpha_composite(out,small)
    out.putalpha(alpha)
    return out
night=dusk(day)
ox,oy=canvas_origin
crop=(ox,oy,ox+source["croppedPixels"][0],oy+source["croppedPixels"][1])
variants={"day":day,"dusk":night}
measures={}
for name,full in variants.items():
    assert ImageChops.difference(full.getchannel("A"),alpha).getbbox() is None
    cut=full.crop(crop)
    assert list(cut.size)==source["croppedPixels"]
    filename=f"red_lion_a228_facade_{name}.webp"
    dest=output/filename
    cut.save(dest,"WEBP",lossless=True,exact=True,method=6)
    with Image.open(dest) as image:
        decoded=image.convert("RGBA")
    assert ImageChops.difference(decoded,cut).getbbox() is None
    # Pixel accounting restricted to actual visible original canvas positions.
    source_pix=list(base.get_flattened_data())
    candidate=list(full.get_flattened_data())
    changed=sum(a>0 and (r,g,b)!=(rr,gg,bb)
                for (r,g,b,a),(rr,gg,bb,aa) in zip(source_pix,candidate))
    assert changed>4000
    measures[name]={"file":filename,"sha256":sha(dest.read_bytes()),
                    "bytes":dest.stat().st_size,"changedVisibleRGBPixels":changed,
                    "baseAlphaIdentical":True,"losslessRoundtrip":True,
                    "croppedPixels":source["croppedPixels"],
                    "drawOffsetFromVisualDoorPixels":source["drawOffsetFromVisualDoorPixels"]}
# The review image presents identical unchanged roof source at both day and dusk.
def scene(full,dim=False):
    f=Image.new("RGB",(640,640),(104,121,104) if not dim else (50,67,79))
    for i in range(0,640,32):
        ImageDraw.Draw(f).line((i,0,i,639),fill=(130,136,116) if not dim else (67,79,86))
        ImageDraw.Draw(f).line((0,i,639,i),fill=(130,136,116) if not dim else (67,79,86))
    f.paste(full,(0,0),full.getchannel("A"))
    rf=Image.new("RGBA",(640,640))
    rf.alpha_composite(roof,(320+round(roof_info["layers"]["roof"]["drawOffsetFromVisualDoorPixels"][0]),
                             320+round(roof_info["layers"]["roof"]["drawOffsetFromVisualDoorPixels"][1])))
    # Roof untouched. We do not pretend this is a physically-lit world.
    f.paste(rf,(0,0),rf.getchannel("A"))
    return f
preview=Image.new("RGB",(1960,690),(39,48,43))
for k,(name,full) in enumerate((("A2.24 source",base),("A2.28 daylight",day),("A2.28 dusk",night))):
    preview.paste(scene(full,k==2),(10+650*k,34))
    ImageDraw.Draw(preview).text((16+650*k,11),name,fill=(248,221,176))
ImageDraw.Draw(preview).text((12,672),"Original Blender-derived facade and byte-identical roof. Dusk is local material study; no runtime sky/light engine.",fill=(235,207,165))
preview_name="greyhaven_a228_source_day_dusk_preview.png"
preview.save(output/preview_name,optimize=True)
report={"milestone":"A2.28 Red Lion source-authored facade detail and daylight/dusk material response",
        "sourceFacadeSha256":source["sha256"],"sourceRoofSha256":roof_info["newRoofSha256"],
        "newRoofSha256":sha((output/"red_lion_a228_roof.webp").read_bytes()),
        "roofBinaryIdenticalToA226":True,
        "visualDoorCanvasPx":[320,320],
        "sourceGroundBasisPixelsPerSourceMeter":handoff["projection"]["groundBasisPixelsPerSourceMeter"],
        "originalFacadeAlphaBoundsCanvasPx":list(alpha.getbbox()),
        "variants":measures,"preview":preview_name,
        "architectureDetail":["stone coursing","staggered lime-mortar joints",
          "wood grain and edge highlights","wooden mullions and window reveals",
          "iron hinge and lock plate","stone threshold","window and doorway warm light spill"],
        "3cAtmosphereLightingEngineImplemented":False,
        "worldCollisionPortalOrNetworkModified":False,
        "gameRendererIntegrated":False,
        "productionApproved":False}
(output/"greyhaven_a228_facade_report.json").write_text(json.dumps(report,indent=2,sort_keys=True)+"\n","utf8")
print("A228="+json.dumps({"variants":measures,"roofUnchanged":True,
                          "preview":str(output/preview_name)}))

"""R4 first-playable art review packaging: two anatomical bodies, CMU rolling
source, A2 comparison, all facings and genuine 350ms animated evidence.
No activation, never substitute for ground-contact or Chrome/Firefox.
"""
from PIL import Image,ImageDraw
from pathlib import Path
import json,hashlib
root=Path.cwd()
frame_root=root/".r4-frames"
assets=root/"web/assets/adults-review-r4"
reviews=root/"docs/art/adult-roll-review-r4"
assets.mkdir(parents=True,exist_ok=True);reviews.mkdir(parents=True,exist_ok=True)
bodies=["adult-masculine","adult-feminine"]
checks=[]
for body in bodies:
    img=Image.new("RGBA",(1280,1280),(0,0,0,0))
    for direction in range(8):
        for frame in range(8):
            file=frame_root/body/(f"roll_row{direction:02d}_frame{frame:02d}.png")
            assert file.is_file(),file
            with Image.open(file) as im:
                assert im.size==(160,160),file
                tile=im.convert("RGBA")
                assert tile.getchannel("A").getextrema()[1]>0,file
            img.alpha_composite(tile,(frame*160,direction*160))
    path=assets/(body+"_roll.webp")
    img.save(path,format="WEBP",quality=90,method=6)
    with Image.open(path) as verify:
        assert verify.size==(1280,1280)
        assert verify.getchannel("A").getextrema()[0]==0
    bin=path.read_bytes()
    info={"body":body,"clip":"roll","directionCount":8,"frameCount":8,"framePx":160,
          "atlasPx":[1280,1280],"bytes":len(bin),"sha256":hashlib.sha256(bin).hexdigest(),
          "source":"CMU motion capture 128_10 pose retarget + CC0 MakeHuman anatomical body",
          "authoritativeMovementModified":False,"groundContactVerifiedInGame":False,
          "artApproved":False,"productionEnabled":False}
    (assets/(body+"_roll.json")).write_text(json.dumps(info,indent=2)+"\n",encoding="utf8")
    checks.append(info)
    print("R4_REAL_ATLAS",body,len(bin),info["sha256"],flush=True)
cols=8;cell_w,cell_h=145,165
labels=["S","SW","W","NW","N","NE","E","SE"]
gifs=[]
for scenario in ("new","old-vs-new"):
    frames=[]
    for fr in range(8):
        rows=2 if scenario=="new" else 4
        image=Image.new("RGB",(cols*cell_w,rows*cell_h+30),(41,53,55))
        draw=ImageDraw.Draw(image)
        draw.text((8,7),("R4 · CC0 Anatomical Adults · CMU 128_10 Roll" if scenario=="new"
                       else "Graphics 3A R4 · Legacy A2 / New Real Mocap Side By Side"),
                  fill=(240,207,170))
        for d,direction in enumerate(labels):
            draw.text((d*cell_w+cell_w//2-7,26),direction,fill=(231,183,120))
            for row in range(rows):
                body=bodies[row%2]
                prefix="old" if scenario=="old-vs-new" and row<2 else "new"
                path=(root/"web/assets/adults"/(body+"_roll.webp") if prefix=="old"
                      else assets/(body+"_roll.webp"))
                with Image.open(path) as im:
                    tile=im.convert("RGBA").crop((fr*160,d*160,(fr+1)*160,(d+1)*160))
                tile=tile.resize((130,130),Image.Resampling.LANCZOS)
                x=d*cell_w+8;y=row*cell_h+38
                image.paste(tile,(x,y),tile)
                if d==0:
                    draw.text((2,y+121),("A2 " if prefix=="old" else "R4 ")+
                          ("M" if row%2==0 else "F"),fill=(247,221,182))
        frames.append(image)
    # Real GIF 350ms uses 10ms-compatible intervals; source motion frame
    # interpolation is not thereby approved for Combat active/recovery.
    ms=[40,40,50,40,40,50,40,50]
    gif=reviews/("adult-roll-r4-both-bodies-all-8.gif" if scenario=="new" else
                 "adult-roll-a2-versus-r4-all-8.gif")
    frames[0].save(gif,format="GIF",save_all=True,append_images=frames[1:],
                   duration=ms,loop=0,optimize=True)
    with Image.open(gif) as readback:
        actual=[]
        for i in range(readback.n_frames):
            readback.seek(i);actual.append(readback.info["duration"])
        assert sum(actual)==350,(scenario,actual)
    frames[0].save(gif.with_suffix(".png"))
    gifs.append(gif.name)
    print("R4_REAL_LOOP",scenario,gif.name,gif.stat().st_size,flush=True)
(reviews/"packaging.json").write_text(json.dumps({
 "bodies":checks,"loops":gifs,"loopMs":350,"GIFFrameMs":[40,40,50,40,40,50,40,50],
 "groundedInActualGame":False,"multiBrowserVerified":False,
 "humanVisualApproval":False,"integrationReady":False},indent=2)+"\n",encoding="utf8")
print("R4_PACKAGING_DONE",len(checks),"atlases",len(gifs),"gifs")

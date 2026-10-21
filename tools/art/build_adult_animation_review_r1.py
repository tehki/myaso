"""Generate visual-first, no-approval adult animation inspection evidence.
Uses original source WebPs from A0/A1/A2; produces 8-direction animated
contact GIFs, frame-by-frame sheets, silhouette-floor *proxy* drift report.
A GIF is an actual animation playback, not source frames mislabeled video.
"""
import pathlib,json,statistics,hashlib
from PIL import Image,ImageDraw,ImageFont
root=pathlib.Path(__file__).resolve().parents[2]
out=root/"docs"/"art"/"adult-animation-review-r1"
out.mkdir(parents=True,exist_ok=True)
directions=["S","SW","W","NW","N","NE","E","SE"]
bodies=["adult-masculine","adult-feminine"]
clips={"idle":4,"walk":4,"run":4,"roll":8}
frame_durations={"idle":280,"walk":220,"run":125,"roll":44}
source_timeline_roll=[0,33.3,66.7,100,133.3,166.7,233.3,350]
report={"source":"original A0/A1/A2 committed WebP atlases, NOT live in-world",
 "frameTimings":{"idleMsPerFrame":280,"walkMsPerFrame":220,
  "runMsPerFrame":125,"rollVisualTargetMs":350,
  "rollSampleElapsedMs":source_timeline_roll,
  "rollCurrentUniformPreviewFramesMs":[round(i*350/8,3) for i in range(8)]},
 "silhouetteBottomOffsetFromOriginPxByBodyClip":{},
 "boundsAreSilhouetteNotAnatomicalFoot":True,
 "gameGroundPivotVerified":False,"sourceRigFootJointVerified":False,
 "footSlidingVerified":False,"runningGame":False,
 "approvalReady":False}
for clip,frames in clips.items():
 sheetframes=[]
 for fr in range(frames):
  cell_w,cell_h=122,166
  montage=Image.new("RGB",(8*cell_w+6,2*cell_h+36),(43,50,54))
  draw=ImageDraw.Draw(montage)
  draw.text((12,8),f"myaso.io  A0/A1/A2  {clip.upper()}  original frame {fr+1}/{frames}",fill=(235,227,205))
  for d,dirlabel in enumerate(directions):
   draw.text((d*cell_w+cell_w//2-9,25),dirlabel,fill=(229,188,113))
  for j,body in enumerate(bodies):
   ybase=36+j*cell_h
   draw.text((d*0+4,ybase+120),("M" if j==0 else "F"),fill=(230,235,220))
   for d in range(8):
    name=body+"_"+clip+".webp"
    atlas=root/"web"/"assets"/"adults"/name
    assert atlas.is_file(),atlas
    with Image.open(atlas) as im:
     rgba=im.convert("RGBA")
     assert rgba.size==(frames*160,1280),(name,rgba.size)
     tile=rgba.crop((fr*160,d*160,(fr+1)*160,(d+1)*160))
    if clip=="roll":
     size=112  # relative preview only; source still 160px
    else:size=96
    img=tile.resize((size,size),Image.Resampling.LANCZOS)
    bg=Image.new("RGBA",(cell_w,cell_h),(0,0,0,0))
    origin_x=cell_w//2
    # Display actual A2/A1 draw offsets (unscaled vs game world rendering)
    dx=origin_x-size//2
    dy=65
    bg.alpha_composite(img,(dx,dy))
    # Explicit expected world pivot for comparison, not ground truth.
    draw.ellipse((d*cell_w+origin_x-3,ybase+119,
        d*cell_w+origin_x+3,ybase+125),fill=(232,114,98))
    montage.paste(bg.convert("RGB"),(d*cell_w,ybase),bg)
  sheetframes.append(montage)
 durations=[frame_durations[clip]]*frames
 if clip=="roll": durations=[40,40,50,40,40,50,40,50] # exact GIF 350ms (10ms palette precision)
 gif=out/f"adult-{clip}-both-bodies-8-directions.gif"
 sheetframes[0].save(gif,format="GIF",save_all=True,append_images=sheetframes[1:],
   duration=durations,loop=0,optimize=False)
 sheetframes[0].save(out/f"adult-{clip}-contact-sheet.png")
 print("GIF_CREATED",gif.name,gif.stat().st_size,flush=True)
for body in bodies:
 for clip,frames in clips.items():
  with Image.open(root/"web"/"assets"/"adults"/(body+"_"+clip+".webp")) as im:
   sheet=im.convert("RGBA")
  offsets=[]
  for d in range(8):
   for f in range(frames):
    rgba=sheet.crop((f*160,d*160,(f+1)*160,(d+1)*160))
    alpha=rgba.getchannel("A").point(lambda a:255 if a>=32 else 0)
    box=alpha.getbbox()
    assert box is not None,(body,clip,d,f)
    offset=(-78 if clip=="roll" else -62.4)+(box[3])*(134 if clip=="roll" else 96)/160
    offsets.append({"dir":directions[d],"frame":f,"silhouetteBottomFromOriginPx":round(offset,2),"alphaBounds":list(box)})
  bottoms=[x["silhouetteBottomFromOriginPx"] for x in offsets]
  report["silhouetteBottomOffsetFromOriginPxByBodyClip"][body+":"+clip]={
   "min":min(bottoms),"max":max(bottoms),
   "spreadPx":round(max(bottoms)-min(bottoms),2),
   "mean":round(statistics.mean(bottoms),2),"frames":offsets}
(out/"motion-review-metrics.json").write_text(json.dumps(report,indent=2),encoding="utf8")
print("REVIEW_METRICS",json.dumps({k:{s:v[s] for s in ("min","max","spreadPx","mean")} for k,v in report["silhouetteBottomOffsetFromOriginPxByBodyClip"].items()}),flush=True)

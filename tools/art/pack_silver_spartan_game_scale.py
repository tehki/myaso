#!/usr/bin/env python3
"""Original Silver Knight sprite presentation packing only.

Uniform resize of every genuine original source frame, same scale and same
joint/world geometry. Pivot at source (80,120) -> output (80,136) to match
approved idle Knight baseline sole. This is NOT a Blender mesh edit and
NEVER alters gameplay hitboxes, knockback or actor root.
"""
from __future__ import annotations
import argparse, hashlib, json
from pathlib import Path
from PIL import Image

FRAME=160
DIRECTIONS=8
FRAMES=8
SCALE=1.30
INPUT_PIVOT=(80,120)
OUTPUT_PIVOT=(80,136)
TRANSLATE=(round(OUTPUT_PIVOT[0]-INPUT_PIVOT[0]*SCALE),
           round(OUTPUT_PIVOT[1]-INPUT_PIVOT[1]*SCALE))
def sha(path:Path):
    return hashlib.sha256(path.read_bytes()).hexdigest()
def bounding(tile):
    threshold=tile.getchannel("A").point(lambda v: 255 if v>16 else 0)
    return threshold.getbbox()
def h(box): return box[3]-box[1]

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--source",type=Path,required=True)
    p.add_argument("--idle",type=Path,required=True)
    p.add_argument("--output",type=Path,required=True)
    p.add_argument("--report",type=Path,required=True)
    args=p.parse_args()
    original=args.source.read_bytes()
    src=Image.open(args.source).convert("RGBA")
    idle=Image.open(args.idle).convert("RGBA")
    assert src.size==(FRAMES*FRAME,DIRECTIONS*FRAME)
    assert idle.size==(4*FRAME,DIRECTIONS*FRAME)
    out=Image.new("RGBA",src.size,(0,0,0,0))
    measures=[]
    dim=round(FRAME*SCALE)
    for direction in range(DIRECTIONS):
        for frame in range(FRAMES):
            r=(frame*FRAME,direction*FRAME,(frame+1)*FRAME,(direction+1)*FRAME)
            tile=src.crop(r)
            old=bounding(tile)
            assert old,("empty approved Silver source cell",direction,frame)
            bigger=tile.resize((dim,dim),Image.Resampling.LANCZOS)
            packed=Image.new("RGBA",(FRAME,FRAME),(0,0,0,0))
            packed.paste(bigger,TRANSLATE)
            new=bounding(packed)
            assert new and new[0]>=6 and new[1]>=6 and new[2]<=FRAME-6 and new[3]<=FRAME-6, (direction,frame,new)
            out.paste(packed,(frame*FRAME,direction*FRAME))
            measures.append({
              "direction":direction,"frame":frame,
              "originalAlphaBox":old,"alignedAlphaBox":new,
              "originalHeight":h(old),"alignedHeight":h(new)})
    args.output.parent.mkdir(parents=True,exist_ok=True)
    out.save(args.output,format="WEBP",lossless=True,method=6)
    assert args.source.read_bytes()==original
    idle_heights=[]
    for direction in range(DIRECTIONS):
        for frame in range(4):
            tile=idle.crop((frame*FRAME,direction*FRAME,(frame+1)*FRAME,(direction+1)*FRAME))
            box=bounding(tile);assert box
            idle_heights.append(h(box))
    avg=lambda n:round(sum(n)/len(n),2)
    avg_src=avg([m["originalHeight"] for m in measures])
    avg_align=avg([m["alignedHeight"] for m in measures])
    avg_idle=avg(idle_heights)
    assert abs(avg_align-avg_idle)<12, "aligned kick must visually match standing Knight height"
    assert avg_align>avg_src*1.25
    data={
      "source":"Original approved Silver Knight V2 high-forward Blender WebP; no generated illustration",
      "sourceSha256":sha(args.source),
      "idleAtlasSha256":sha(args.idle),
      "alignedSha256":sha(args.output),
      "sourceUnmodified":True,"poseGeometryUnchanged":True,
      "actorWorldRootUnchanged":True,"serverHitboxesUnchanged":True,
      "notLiveMultiplayerProof":True,"realFloorContactVerified":False,
      "sourceDimensions":list(src.size),"framePx":FRAME,"directions":DIRECTIONS,
      "framesPerDirection":FRAMES,"totalFrames":len(measures),
      "uniformScale":SCALE,"sourcePivot":INPUT_PIVOT,"alignedPivot":OUTPUT_PIVOT,
      "translatedPixelOffset":TRANSLATE,"alphaCutoff":16,
      "averageSourceKnightHeightPx":avg_src,
      "averageAlignedKnightHeightPx":avg_align,
      "averageExistingIdleKnightHeightPx":avg_idle,
      "originalClipPixelMarginSafe":True,
      "measurements":measures}
    args.report.parent.mkdir(parents=True,exist_ok=True)
    args.report.write_text(json.dumps(data,indent=2)+"\n",encoding="utf8")
    print("SILVER_KICK_GAME_SCALE",json.dumps({
      "sourceAvgHeight":avg_src,"gameAlignedAvgHeight":avg_align,
      "idleAvgHeight":avg_idle,"renderSha":sha(args.output),
      "frames":len(measures),"sourceStillByteIdentical":True}))
if __name__=="__main__":main()

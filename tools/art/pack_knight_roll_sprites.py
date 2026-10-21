"""Pack deterministic eight-direction / eight-phase Blender PNG tiles to WebP.
Run: python tools/art/pack_knight_roll_sprites.py --source-folder DIR --clip silver_roll --output-folder web/assets/knights
Blender source GLB provided separately, never checked into repository.
"""
import argparse
import json
from pathlib import Path
from PIL import Image

FRAME=160
N=8
def main():
    args=argparse.ArgumentParser()
    args.add_argument("--source-folder",required=True)
    args.add_argument("--output-folder",required=True)
    args.add_argument("--clip",choices=("silver_roll","t1_roll"),required=True)
    a=args.parse_args()
    source=Path(a.source_folder)
    dest=Path(a.output_folder)
    dest.mkdir(parents=True,exist_ok=True)
    sheet=Image.new("RGBA",(FRAME*N,FRAME*N))
    alpha_bboxes=[]
    for direction in range(N):
        for phase in range(N):
            fp=source/f"row{direction:02d}_frame{phase:02d}.png"
            assert fp.is_file(),f"Missing frame {fp}"
            with Image.open(fp) as input_image:
                frame=input_image.convert("RGBA")
            assert frame.size==(FRAME,FRAME),(fp,frame.size)
            bbox=frame.getchannel("A").getbbox()
            assert bbox, f"Missing alpha subject {fp}"
            assert bbox[0]>0 and bbox[1]>0 and bbox[2]<FRAME and bbox[3]<FRAME, (fp,bbox)
            alpha_bboxes.append((direction,phase,bbox))
            sheet.paste(frame,(phase*FRAME,direction*FRAME))
    out=dest/(a.clip+".webp")
    sheet.save(out,format="WEBP",quality=85,method=6)
    with Image.open(out) as back:
        assert back.size==sheet.size and back.getchannel("A").getbbox()
    manifest=dest/"asset-build-report.json"
    report=json.loads(manifest.read_text(encoding="utf-8"))
    report[a.clip]={"frames":N,"sourceFrameSize":FRAME,
                     "outputFrameSize":FRAME,"bytes":out.stat().st_size,
                     "directionOrder":["south","southwest","west","northwest","north","northeast","east","southeast"],
                     "sourceAnimation":"roll","sourceModel":"owner-supplied A3 Blender GLB",
                     "visualDurationMs":350,"sourceKeyframes":[1,3,5,7,9,11,15,22]}
    manifest.write_text(json.dumps(report,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({"asset":str(out),"bytes":out.stat().st_size,
                      "dimensions":sheet.size,"coverage":len(alpha_bboxes),
                      "minMargin":min(min(b[2][0],b[2][1],FRAME-b[2][2],FRAME-b[2][3])
                                      for b in alpha_bboxes)},indent=2))
if __name__=="__main__":
    main()

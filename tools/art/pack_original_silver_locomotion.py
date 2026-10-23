"""Strict original Blender source PNG -> standalone review-only WebP atlases.
No screen-space brightening/filter/retouch; full input source provenance.
"""
import argparse,hashlib,json
from pathlib import Path
from PIL import Image
CLIPS={"idle":4,"walk":8,"sprint":8,"jump":6}
p=argparse.ArgumentParser()
p.add_argument("--source",required=True)
p.add_argument("--output",required=True)
args=p.parse_args()
root=Path(args.source).resolve()
out=Path(args.output).resolve()
out.mkdir(parents=True,exist_ok=True)
metadata=json.loads((root/"manifest.source.json").read_text())
assert metadata["sourceSHA256"]=="d679fccd00df868d600b4c5e2fcf8a4a46cc062dbd432be5b6a7f533eb30141f"
result={"source":metadata,"atlas":{},"originalModelRedistributed":False,"pixelRetouch":False}
for clip,frames in CLIPS.items():
    sheet=Image.new("RGBA",(frames*160,8*160))
    cells=[]
    for direction in range(8):
        for frame_index in range(frames):
            fp=root/clip/f"row{direction:02d}_frame{frame_index:02d}.png"
            assert fp.is_file(),f"missing owner source frame {fp}"
            with Image.open(fp) as im:
                tile=im.convert("RGBA")
            assert tile.size==(160,160)
            bbox=tile.getchannel("A").getbbox()
            assert bbox is not None,f"empty rig {fp}"
            sheet.paste(tile,(frame_index*160,direction*160))
            cells.append({"direction":direction,"frame":frame_index,"sourcePNGsha256":hashlib.sha256(fp.read_bytes()).hexdigest(),
                "alphaBBox":bbox,"bytes":fp.stat().st_size})
    path=out/f"silver_{clip}_roll_studio.webp"
    sheet.save(path,format="WEBP",lossless=True,method=6)
    with Image.open(path) as back:
        assert back.size==sheet.size
        # WebP lossless may normalize RGB for fully transparent pixels only.
        # Preserve exact alpha and every visible original Blender source pixel.
        paired=zip(sheet.getdata(),back.convert("RGBA").getdata())
        assert all(old[3]==new[3] and (old[3]==0 or old[:3]==new[:3])
                   for old,new in paired),f"visible Blender source pixels changed {clip}"
    result["atlas"][clip]={"path":path.name,"width":frames*160,"height":8*160,"frames":frames,
           "sha256":hashlib.sha256(path.read_bytes()).hexdigest(),"bytes":path.stat().st_size,"cells":cells}
    print("ORIGINAL_BLENDER_ROLL_STUDIO_ATLAS",clip,len(cells),result["atlas"][clip]["sha256"],flush=True)
(out/"manifest.source-reviewed.json").write_text(json.dumps(result,indent=2)+"\n",encoding="utf8")
print("ALL_ORIGINAL_BLENDER_CYCLES_REVIEW_ATLASES_PACKED",len(result["atlas"]))

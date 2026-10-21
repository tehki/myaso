"""Export first-party 3B source Blender sword object matrices without altering art.
Run: blender -b ORIGINAL_3B_BLEND --python this_file -- --output manifest.json
"""
import argparse,hashlib,json,sys
from pathlib import Path
import bpy
p=argparse.ArgumentParser()
p.add_argument("--output",required=True)
args=p.parse_args(sys.argv[sys.argv.index("--")+1:])
source=Path(bpy.data.filepath)
assert source.is_file(),source
out={}
for o in bpy.data.objects:
 if o.type=="MESH" and o.name.startswith("Sword "):
  out[o.name]={"worldMatrix":[[round(float(t),9) for t in row] for row in o.matrix_world],
               "vertices":len(o.data.vertices)}
assert len(out)==6,sorted(out)
record={"sourceBlendSha256":hashlib.sha256(source.read_bytes()).hexdigest(),
 "source":"Original Graphics 3B blacksmith_armory_p0_source.blend",
 "purpose":"Recover original 3B object transforms when Blender library object append resets transform",
 "originalMeshesUnmodified":True,"objects":out}
target=Path(args.output).resolve()
target.parent.mkdir(parents=True,exist_ok=True)
target.write_text(json.dumps(record,indent=2)+"\n",encoding="utf8")
print("ORIGINAL_3B_TRANSFORMS",len(out),record["sourceBlendSha256"],flush=True)

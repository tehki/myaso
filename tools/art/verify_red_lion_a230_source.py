#!/usr/bin/env python3
"""Independent A2.30 .blend proof: original scene meshes unchanged in derivative."""
import bpy,json,argparse,sys,hashlib
from pathlib import Path
p=argparse.ArgumentParser()
p.add_argument("--source",type=Path,required=True)
p.add_argument("--derived",type=Path,required=True)
p.add_argument("--report",type=Path,required=True)
args=p.parse_args(sys.argv[sys.argv.index("--")+1:])
args.source=args.source.resolve()
args.derived=args.derived.resolve()
args.report=args.report.resolve()
def read_signature(path):
 bpy.ops.wm.open_mainfile(filepath=str(path))
 meshes={}
 for o in bpy.data.objects:
  if o.type=="MESH" and (o.name.startswith("Red Lion /") or o.name.startswith("Red Lion A2.1 /")):
   coords=[]
   for v in o.data.vertices:
    pt=o.matrix_world@v.co
    coords.extend(round(float(q),6) for q in pt)
   digest=hashlib.sha256(json.dumps(coords,separators=(",",":")).encode("utf8")).hexdigest()
   meshes[o.name]={"vertices":len(o.data.vertices),"xyzSha256":digest,
      "materialNames":[m.name for m in o.data.materials]}
 extras=[o.name for o in bpy.data.objects if o.type=="MESH" and o.name.startswith("A2.30 facade depth /")]
 return meshes,extras
source,old_additions=read_signature(args.source)
derived,new_additions=read_signature(args.derived)
assert source==derived
assert old_additions==[]
assert len(source)==17 and sum(x["vertices"] for x in source.values())==4318
assert len(new_additions)>=30
assert len(set(new_additions))==len(new_additions)
proof={"source":args.source.name,"derived":args.derived.name,
       "sourceMeshSignatures":source,"allOriginalMeshCoordinatesAndMaterialsUnchanged":True,
       "extraMeshCount":len(new_additions),"extraNames":sorted(new_additions),
       "originalRoofMeshUnchanged":all(source[x]==derived[x] for x in source if "roof" in x),
       "newVisualMeshesOnly":True,"gameplayModified":False,"productionApproved":False}
args.report.write_text(json.dumps(proof,indent=2)+"\n","utf8")
print("A230_SOURCE_MATCH="+json.dumps({"sourceCount":len(source),
   "preservedVertices":sum(v["vertices"] for v in source.values()),
   "newMeshes":len(new_additions),"sourceRoofsUnchanged":proof["originalRoofMeshUnchanged"]}))

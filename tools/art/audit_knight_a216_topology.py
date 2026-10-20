#!/usr/bin/env python3
"""A2.16: original A3 mesh-topology connectivity audit (read-only).

Connected vertex islands are *topological* components, not semantically
approved boot soles. Foot/ToeBase skin weights identify only candidate
components. A single material and/or connected geometry cannot establish
outsole contact. No edits to original GLB, Blender, WebP or game physics.
"""
import argparse
import hashlib
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path
import bpy

argv=sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
ap=argparse.ArgumentParser()
ap.add_argument("--source",type=Path,required=True)
ap.add_argument("--clip",choices=["silver_roll","t1_roll"],required=True)
ap.add_argument("--output",type=Path,required=True)
args=ap.parse_args(argv)
assert args.source.is_file()
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.scene.render.fps=60
bpy.ops.import_scene.gltf(filepath=str(args.source.resolve()))
meshes=[o for o in bpy.data.objects if o.type=="MESH" and any(m.type=="ARMATURE" for m in o.modifiers)]
assert len(meshes)==1, "A2.16 requires one original skinned mesh"
obj=meshes[0]
vertices=obj.data.vertices
n=len(vertices)
parent=list(range(n))
sizes=[1]*n
def root(i):
    while parent[i]!=i:
        parent[i]=parent[parent[i]]
        i=parent[i]
    return i
def union(a,b):
    a,b=root(a),root(b)
    if a==b:return
    if sizes[a]<sizes[b]:a,b=b,a
    parent[b]=a
    sizes[a]+=sizes[b]
for e in obj.data.edges:
    union(e.vertices[0],e.vertices[1])
labels={v.index:v.name for v in obj.vertex_groups}
group_indices={
  side: {idx for idx,name in labels.items()
         if name.endswith(":"+side) or name.endswith(":"+side.replace("Foot","ToeBase"))}
  for side in ("LeftFoot","RightFoot")
}
assert all(group_indices.values())
component={}
foot_membership_count=Counter()
foot_comp_count=defaultdict(Counter)
both_weights=[]
for v in vertices:
    k=root(v.index)
    s=component.get(k)
    if s is None:
        s={"componentID":k,"vertices":0,"minVertexIndex":v.index,
           "boundsMin":[float("inf")]*3,"boundsMax":[float("-inf")]*3}
        component[k]=s
    s["vertices"]+=1
    p=v.co
    for dim in range(3):
        s["boundsMin"][dim]=min(s["boundsMin"][dim],float(p[dim]))
        s["boundsMax"][dim]=max(s["boundsMax"][dim],float(p[dim]))
    weights={side:0.0 for side in group_indices}
    for assign in v.groups:
        for side,ids in group_indices.items():
            if assign.group in ids:weights[side]+=assign.weight
    positive=[side for side,w in weights.items() if w>=.35]
    if len(positive)==2:both_weights.append(v.index)
    for side in positive:
        foot_membership_count[side]+=1
        foot_comp_count[side][k]+=1
assert not both_weights, "Opposite foot weights are unexpectedly ambiguous"
root_sorted=sorted(component,key=lambda k:(-component[k]["vertices"],k))
# ID changes with vertex order but min index is reproducible within this source hash.
ordered={k:i for i,k in enumerate(root_sorted)}
def summary(k):
    s=component[k]
    return {
      "componentRankBySize":ordered[k],
      "vertexCount":s["vertices"],
      "minVertexIndex":s["minVertexIndex"],
      "footWeightedVertices":{
        side:foot_comp_count[side].get(k,0) for side in foot_membership_count
      },
      "localBoundsXYZ":{
        "min":[round(x,5) for x in s["boundsMin"]],
        "max":[round(x,5) for x in s["boundsMax"]]
      }
    }
foot_roots=set()
for side in foot_comp_count:
    foot_roots.update(foot_comp_count[side])
top_components=root_sorted[:min(10,len(root_sorted))]
foot_components=sorted(foot_roots,key=lambda k:(-sum(foot_comp_count[side][k] for side in foot_comp_count),k))
stats={}
for side in group_indices:
    counts=foot_comp_count[side]
    total=foot_membership_count[side]
    stats[side]={
      "weightedVertices":total,
      "touchingTopologyComponentCount":len(counts),
      "largestSingleComponentWeightedVertices":max(counts.values()),
      "fractionInLargestComponent":round(max(counts.values())/total,6),
      "components":[
        {"rank":ordered[k],"componentSize":component[k]["vertices"],
         "selectedFootVertices":count}
        for k,count in counts.most_common(20)
      ]
    }
mats=[m.name if m else "(null)" for m in obj.data.materials]
report={
  "milestone":"Blood & Iron A2.16 original A3 topology component survey",
  "sourceGLBBasename":args.source.name,
  "sourceGLBSHA256":hashlib.sha256(args.source.read_bytes()).hexdigest(),
  "blender":bpy.app.version_string,
  "clip":args.clip,
  "sourceMesh":obj.name,
  "meshVertices":n,
  "meshEdges":len(obj.data.edges),
  "meshPolygons":len(obj.data.polygons),
  "materials":mats,
  "skinWeightThreshold":.35,
  "topologyComponentCount":len(component),
  "topTenLargestComponents":[summary(k) for k in top_components],
  "footBearingComponents":[summary(k) for k in foot_components[:30]],
  "footBearingComponentCount":len(foot_roots),
  "footMembership":stats,
  "componentAnalysisIsNotOutsoleSegmentation":True,
  "soleMaterialOrSemanticMeshIsolated":False,
  "actualSoleContactValidated":False,
  "authoritativeFloorOrGameXYValidated":False,
  "originalModelOrAtlasModified":False,
  "approved120VisualScaleUnchanged":True,
  "combatNetworkOrPhysicsChanged":False,
  "productionApproved":False
}
assert report["meshVertices"]>=100000
assert report["topologyComponentCount"]>0
assert report["footBearingComponentCount"]>0
assert all(stats[s]["weightedVertices"]>=1000 for s in stats)
args.output.parent.mkdir(parents=True,exist_ok=True)
args.output.write_text(json.dumps(report,indent=2,sort_keys=True)+"\n",encoding="utf8")
print("A216_TOPOLOGY="+json.dumps({
    "clip":args.clip,
    "components":len(component),
    "footComponents":len(foot_roots),
    "left":stats["LeftFoot"],
    "right":stats["RightFoot"]
},sort_keys=True))

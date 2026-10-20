#!/usr/bin/env python3
"""A2.17 conservative coordinate-seam diagnostic for original A3 GLBs.

Compare index-edge connectivity against hypothetical coordinate unions at
exact imported rest-position and rounded 5-decimal rest-position. The union
exists ONLY in this in-memory audit; it does not weld/export original meshes.
Spatial coincidence cannot prove a boot, a sole, a natural mesh connection,
nor physical contact; distinct overlapping armor can occupy identical XYZ.
"""
import argparse
import hashlib
import json
import math
import sys
from collections import Counter,defaultdict
from pathlib import Path
import bpy

args_raw=sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
p=argparse.ArgumentParser()
p.add_argument("--source",type=Path,required=True)
p.add_argument("--clip",choices=("silver_roll","t1_roll"),required=True)
p.add_argument("--output",type=Path,required=True)
a=p.parse_args(args_raw)
assert a.source.is_file()
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.scene.render.fps=60
bpy.ops.import_scene.gltf(filepath=str(a.source.resolve()))
skinned=[o for o in bpy.data.objects if o.type=="MESH" and any(m.type=="ARMATURE" for m in o.modifiers)]
assert len(skinned)==1
obj=skinned[0]
n=len(obj.data.vertices)
assert n>100000
positions=[tuple(float(c) for c in v.co) for v in obj.data.vertices]
groups={g.index:g.name for g in obj.vertex_groups}
ids={side:{i for i,name in groups.items()
     if name.endswith(":"+side) or name.endswith(":"+side.replace("Foot","ToeBase"))}
    for side in ("LeftFoot","RightFoot")}
selected={side:set() for side in ids}
for v in obj.data.vertices:
    weights={"LeftFoot":0.0,"RightFoot":0.0}
    for entry in v.groups:
        for side in weights:
            if entry.group in ids[side]:
                weights[side]+=entry.weight
    for side in weights:
        if weights[side]>=.35:selected[side].add(v.index)
assert all(len(x)>1000 for x in selected.values())
assert not selected["LeftFoot"] & selected["RightFoot"]

edges=[tuple(int(i) for i in e.vertices) for e in obj.data.edges]
def uf():
    parent=list(range(n))
    count=[1]*n
    components=n
    def find(i):
        while i!=parent[i]:
            parent[i]=parent[parent[i]]
            i=parent[i]
        return i
    def union(i,j):
        nonlocal components
        i,j=find(i),find(j)
        if i==j:return False
        if count[i]<count[j]:i,j=j,i
        parent[j]=i
        count[i]+=count[j]
        components-=1
        return True
    return find,union,lambda:components
base_find,base_union,base_components=uf()
for i,j in edges:base_union(i,j)
raw_count=base_components()

# Build coordinate buckets once per precision to quantify duplicate-position
# clusters and how many separate original mesh-edge islands coincide.
def inspect(keyfunc):
    buckets=defaultdict(list)
    for i,pos in enumerate(positions):
        buckets[keyfunc(pos)].append(i)
    duplicates=[v for v in buckets.values() if len(v)>1]
    cross_seam=sum(1 for bucket in duplicates
                   if len({base_find(i) for i in bucket})>1)
    pairs=sum(len(bucket)-1 for bucket in duplicates)
    find,union,num=uf()
    for i,j in edges:union(i,j)
    for bucket in duplicates:
        anchor=bucket[0]
        for idx in bucket[1:]:union(anchor,idx)
    membership={side:Counter(find(i) for i in members) for side,members in selected.items()}
    left=set(membership["LeftFoot"])
    right=set(membership["RightFoot"])
    shared=left&right
    counts={
        side:{
          "selectedOriginalWeightedVertices":len(selected[side]),
          "footBearingComponents":len(membership[side]),
          "largestComponentFootWeightedVertices":max(membership[side].values()),
          "fractionInLargestComponent":round(max(membership[side].values())/len(selected[side]),6),
        } for side in selected
    }
    return {
       "positionGroupsWithDuplicateVertices":len(duplicates),
       "duplicateIndexCountBeyondFirst":pairs,
       "duplicateCoordinateGroupsBridgingOriginalIndexIslands":cross_seam,
       "componentsAfterHypotheticalCoordinateUnion":num(),
       "componentReductionFromOriginal":raw_count-num(),
       "componentsContainingBothLeftAndRightFootWeights":len(shared),
       "leftRightWeightedVerticesWithinSharedComponents":{
          side:sum(membership[side][k] for k in shared) for side in selected
       },
       "perFoot":counts,
       "spatialCoincidenceNotProofOfSole":True,
       "hypotheticalUnionOnly":True
    }

exact=inspect(lambda pos:pos)
# Round to 5 decimals ~= 1e-5 in SOURCE MESH local coordinates only.
# Rounding is deliberately used instead of claiming a true epsilon-distance
# neighbor test. Two vertices on opposite sides of a rounding boundary may
# remain separate at a distance below this size; two in the same bin may be
# farther apart diagonally.
rounded=inspect(lambda pos:tuple(round(v,5) for v in pos))
report={
 "milestone":"Blood & Iron A2.17 conservative A3 GLB seam-coincidence diagnostic",
 "blender":bpy.app.version_string,
 "clip":a.clip,"sourceGLBBasename":a.source.name,
 "sourceGLBSHA256":hashlib.sha256(a.source.read_bytes()).hexdigest(),
 "sourceMesh":obj.name,
 "meshVertices":n,"meshEdges":len(edges),"meshPolygons":len(obj.data.polygons),
 "sourceMeshIndexEdgeComponents":raw_count,
 "footSkinWeightThreshold":.35,
 "exactRestPositionEquivalence":exact,
 "rounded5DecimalRestPositionEquivalence":rounded,
 "roundedCoordinatesAreNotEuclideanToleranceTest":True,
 "coordinateCoincidenceCannotDistinguishArmorFromSole":True,
 "anyBootSoleGeometryIsolated":False,
 "environmentGroundPlaneKnown":False,
 "authoritativeGroundContactProven":False,
 "originalSourceAssetsModified":False,
 "actualVertexPositionsOrIndicesModified":False,
 "approved120VisualScaleUnchanged":True,
 "a3RollTimingUnchanged":True,
 "gameplayOrNetworkingChanged":False,
 "productionApproved":False
}
assert raw_count>=rounded["componentsAfterHypotheticalCoordinateUnion"]
assert raw_count>=exact["componentsAfterHypotheticalCoordinateUnion"]
assert rounded["duplicateIndexCountBeyondFirst"]>=exact["duplicateIndexCountBeyondFirst"]
a.output.parent.mkdir(parents=True,exist_ok=True)
a.output.write_text(json.dumps(report,indent=2,sort_keys=True)+"\n",encoding="utf8")
print("A217_SEAM_SUMMARY="+json.dumps({
  "clip":a.clip,"originalComponents":raw_count,
  "exact":exact,"rounded":rounded
},sort_keys=True))

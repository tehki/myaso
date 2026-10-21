#!/usr/bin/env python3
"""A2.13: evaluated skinned-foot *mesh-vertex* clearance, not collision.

Uses original A3 GLB and exact 60fps source/bake camera. Finds vertices
weighted >=0.35 to LeftFoot/RightFoot/ToeBase bones, samples evaluated
deformed geometry at eight unique roll phases, and projects lowest selected
vertices through eight original sprite bake directions. The reference
'floor' is the LOWEST selected foot mesh vertex on source frame 1; this
is a relative geometry datum, NOT an independently verified floor plane.

No source Blender/GLB saves, re-rendering, sprite pivot, or game changes.
"""
import argparse
import hashlib
import json
import math
import sys
from pathlib import Path

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector

argv=sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
pa=argparse.ArgumentParser()
pa.add_argument("--source",type=Path,required=True)
pa.add_argument("--clip",choices=("silver_roll","t1_roll"),required=True)
pa.add_argument("--output",type=Path,required=True)
args=pa.parse_args(argv)
assert args.source.is_file()
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene
scene.render.fps=60
bpy.ops.import_scene.gltf(filepath=str(args.source.resolve()))
rigs=[o for o in bpy.data.objects if o.type=="ARMATURE"]
assert len(rigs)==1
rig=rigs[0]
assert len(rig.data.bones)==22
assert rig.animation_data
action=bpy.data.actions.get("roll")
assert action
rig.animation_data.action=action
if action.slots:
    rig.animation_data.action_slot=action.slots[0]
for track in rig.animation_data.nla_tracks:track.mute=True
frames=(1,3,5,7,9,11,15,22)

meshes=[]
selection_summary=[]
for o in bpy.data.objects:
    if o.type!="MESH" or not any(m.type=="ARMATURE" for m in o.modifiers):
        continue
    group_names={vg.index:vg.name for vg in o.vertex_groups}
    selected={"LeftFoot":[],"RightFoot":[]}
    for v in o.data.vertices:
        weights={"LeftFoot":0.0,"RightFoot":0.0}
        for assignment in v.groups:
            name=group_names.get(assignment.group,"")
            for side in weights:
                if name.endswith(":"+side) or name.endswith(":"+side.replace("Foot","ToeBase")):
                    weights[side]+=assignment.weight
        for side in selected:
            if weights[side]>=0.35:
                selected[side].append(v.index)
    if not any(selected.values()):
        continue
    assert not set(selected["LeftFoot"]) & set(selected["RightFoot"]), (
        "Ambiguous opposite-foot skin weights for "+o.name)
    meshes.append((o,selected))
    selection_summary.append({
        "meshName":o.name,"baseVertices":len(o.data.vertices),
        "leftWeightedVertexCount":len(selected["LeftFoot"]),
        "rightWeightedVertexCount":len(selected["RightFoot"])})
assert meshes,"No skin-weighted foot geometry; refusing to infer shoe soles"
assert sum(m["leftWeightedVertexCount"] for m in selection_summary)>=12
assert sum(m["rightWeightedVertexCount"] for m in selection_summary)>=12

offset=0.0 if args.clip=="silver_roll" else .67
camera_data=bpy.data.cameras.new("Original A3 sprite source camera")
camera=bpy.data.objects.new("Original A3 sprite source camera",camera_data)
scene.collection.objects.link(camera)
scene.camera=camera
camera_data.type="ORTHO"
camera_data.ortho_scale=1.66
scene.render.resolution_x=scene.render.resolution_y=160
scene.render.resolution_percentage=100
focus=Vector((0,0,-.07+offset))

def set_camera(direction):
    a=math.tau*direction/8
    camera.location=(3.25*math.sin(a),-3.25*math.cos(a),2.65+offset)
    camera.rotation_euler=(focus-Vector(camera.location)).to_track_quat("-Z","Y").to_euler()

def project(point):
    uv=world_to_camera_view(scene,camera,point)
    source=(uv.x*160,(1-uv.y)*160)
    return {
      "sourceFramePx":[round(t,4) for t in source],
      "approved120PresentationOffsetPx":[
         round(-67+source[0]*134/160,4),
         round(-78+source[1]*134/160,4)]
    }

source_phases=[]
for column,frame in enumerate(frames):
    scene.frame_set(frame)
    bpy.context.view_layer.update()
    depsgraph=bpy.context.evaluated_depsgraph_get()
    by_side={"LeftFoot":[],"RightFoot":[]}
    for ob,indices in meshes:
        evaluated=ob.evaluated_get(depsgraph)
        evaluated_mesh=evaluated.to_mesh()
        try:
            if len(evaluated_mesh.vertices)!=len(ob.data.vertices):
                raise RuntimeError("Evaluated topology mismatch: "+ob.name)
            matrix=evaluated.matrix_world
            for side in by_side:
                for idx in indices[side]:
                    pt=matrix @ evaluated_mesh.vertices[idx].co
                    by_side[side].append((pt,ob.name,idx))
        finally:
            evaluated.to_mesh_clear()
    parts={}
    for side,points in by_side.items():
        assert len(points)>=12, (args.clip,side,len(points))
        points.sort(key=lambda p:p[0].z)
        lowest=points[0]
        p10=points[int(.10*(len(points)-1))][0].z
        parts[side]={
          "selectedVertexCount":len(points),
          "minimumWorldZ":round(lowest[0].z,5),
          "p10WorldZ":round(p10,5),
          "minimumVertexWorldXYZ":[round(v,5) for v in lowest[0]],
          "sourceMesh":lowest[1],"sourceVertexIndex":lowest[2],
          "_lowestVec":lowest[0].copy()
        }
    source_phases.append({"column":column,"frame60fps":frame,
                          "meshFeet":parts})

# Frame 1's lowest skin-weighted foot vertex is the ONLY floor reference.
# Actual environmental floor collision Z is not represented in the GLB.
floor=min(source_phases[0]["meshFeet"][side]["minimumWorldZ"]
          for side in ("LeftFoot","RightFoot"))
observations=[]
for direction in range(8):
    set_camera(direction)
    scene.camera=camera
    bpy.context.view_layer.update()
    for phase in source_phases:
        side_data={}
        for side,item in phase["meshFeet"].items():
            side_data[side]={
              k:v for k,v in item.items() if k!="_lowestVec"
            }
            z=item["minimumWorldZ"]
            side_data[side]["relativeClearanceFromFrame1FootMinMeters"]=round(z-floor,5)
            side_data[side]["lowestSkinWeightedVertexProjection"]=project(item["_lowestVec"])
        observations.append({
          "direction":direction,
          "atlasColumn":phase["column"],
          "sourceFrame60fps":phase["frame60fps"],
          "feet":side_data
        })
assert len(observations)==64
for phase in source_phases:
    for item in phase["meshFeet"].values():
        del item["_lowestVec"]
report={
 "milestone":"Blood & Iron A2.13 evaluated skinned foot-region geometry",
 "blender":bpy.app.version_string,
 "clip":args.clip,
 "sourceGLBBasename":args.source.name,
 "sourceGLBSHA256":hashlib.sha256(args.source.read_bytes()).hexdigest(),
 "originalBakeCameraScale":1.66,"canvas":[160,160],
 "sourceFrames60fps":list(frames),"directions":8,"observations":observations,
 "sourcePhaseGeometry":source_phases,
 "skinningWeightThreshold":0.35,
 "selectedBones":["LeftFoot","LeftToeBase","RightFoot","RightToeBase"],
 "meshSelection":selection_summary,
 "floorReference":"MIN_OF_FRAME_1_SKIN_WEIGHTED_FOOT_VERTICES_ONLY",
 "referenceFloorProxyWorldZ":round(floor,5),
 "authoritativeFloorZKnown":False,
 "shoeSoleMaterialOrPartIsolated":False,
 "groundCollisionContactValidated":False,
 "footMeshRegionsAreNotShoeSoles":True,
 "a3PresentationScale":1.2,
 "originalSourceAssetsModified":False,
 "spriteOffsetChanged":False,
 "gameplayPhysicsOrNetworkChanged":False,
 "productionApproved":False
}
args.output.parent.mkdir(parents=True,exist_ok=True)
args.output.write_text(json.dumps(report,indent=2,sort_keys=True)+"\n",encoding="utf8")
print("A213_REPORT="+json.dumps({
 "clip":args.clip,"meshSelections":selection_summary,
 "footReferenceZ":report["referenceFloorProxyWorldZ"],
 "frameZBySide":[{
    "frame":p["frame60fps"],
    "left":p["meshFeet"]["LeftFoot"]["minimumWorldZ"],
    "right":p["meshFeet"]["RightFoot"]["minimumWorldZ"]
 } for p in source_phases]
},sort_keys=True))

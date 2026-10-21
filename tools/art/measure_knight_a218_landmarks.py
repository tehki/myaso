#!/usr/bin/env python3
"""A2.18 persistent heel-SIDE / toe-SIDE geometry hints for artist review.

Original 22-bone A3 GLB. At frame 1 choose two fixed foot-weighted
mesh vertex IDs per foot. Anatomical longitudinal axis comes from the
Foot joint towards ToeBase joint projected into local XY, with lower-Z
weighted candidates in near-ankle/toe longitudinal quantiles.
This DOES NOT identify a boot outsole nor the authoritative floor.

Read-only source, no vertex welding, no game re-anchoring, no new sprite.
"""
import argparse,hashlib,json,math,sys
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
import bpy

a=argparse.ArgumentParser()
a.add_argument("--source",type=Path,required=True)
a.add_argument("--clip",choices=("silver_roll","t1_roll"),required=True)
a.add_argument("--output",type=Path,required=True)
args=a.parse_args(sys.argv[sys.argv.index("--")+1:])
assert args.source.is_file()
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene
scene.render.fps=60
bpy.ops.import_scene.gltf(filepath=str(args.source.resolve()))
rigs=[o for o in bpy.data.objects if o.type=="ARMATURE"]
assert len(rigs)==1 and len(rigs[0].data.bones)==22
rig=rigs[0]
action=bpy.data.actions.get("roll")
assert action and rig.animation_data
rig.animation_data.action=action
if action.slots:rig.animation_data.action_slot=action.slots[0]
for tr in rig.animation_data.nla_tracks:tr.mute=True
objs=[o for o in bpy.data.objects if o.type=="MESH" and any(m.type=="ARMATURE" for m in o.modifiers)]
assert len(objs)==1
obj=objs[0]
names={g.index:g.name for g in obj.vertex_groups}
indices={}
for side in ("LeftFoot","RightFoot"):
    chosen=set()
    for v in obj.data.vertices:
        weight=sum(assignment.weight for assignment in v.groups
          if names.get(assignment.group,"").endswith(":"+side)
            or names.get(assignment.group,"").endswith(":"+side.replace("Foot","ToeBase")))
        if weight>=.35:chosen.add(v.index)
    assert len(chosen)>1000
    indices[side]=sorted(chosen)
assert not set(indices["LeftFoot"])&set(indices["RightFoot"])

frames=(1,3,5,7,9,11,15,22)
scene.frame_set(frames[0]);bpy.context.view_layer.update()
deps= bpy.context.evaluated_depsgraph_get()
evaluated=obj.evaluated_get(deps)
mesh=evaluated.to_mesh()
def world_mat():
    return obj.evaluated_get(bpy.context.evaluated_depsgraph_get()).matrix_world
try:
    matrix=evaluated.matrix_world
    fixed={}
    for side in indices:
        foot=rig.pose.bones["mixamorig:"+side]
        toe=rig.pose.bones["mixamorig:"+side.replace("Foot","ToeBase")]
        foot_origin=rig.matrix_world @ foot.head
        toe_origin=rig.matrix_world @ toe.head
        raw_dir=toe_origin-foot_origin
        axis=Vector((raw_dir.x,raw_dir.y))
        assert axis.length>.01,("degenerate foot axis",side,raw_dir)
        axis.normalize()
        points=[]
        for i in indices[side]:
            xyz=matrix @ mesh.vertices[i].co
            along=(Vector((xyz.x,xyz.y))-Vector((foot_origin.x,foot_origin.y))).dot(axis)
            points.append((float(along),float(xyz.z),i))
        points.sort()
        q25=points[int((len(points)-1)*.25)][0]
        q75=points[int((len(points)-1)*.75)][0]
        assert q75>q25,("invalid longitudinal spread",side)
        spread=q75-q25
        # Define near-ankle vs toe-side bands from center quartiles.
        # The foot is NOT a boot segment, and the band can include armor.
        heel=[p for p in points if p[0]<=q25]
        toe_side=[p for p in points if p[0]>=q75]
        assert len(heel)>100 and len(toe_side)>100
        heel_choice=min(heel,key=lambda p:(p[1],p[2]))
        toe_choice=min(toe_side,key=lambda p:(p[1],p[2]))
        assert heel_choice[2]!=toe_choice[2]
        fixed[side]={
            "heelSide":{
                "vertexIndex":heel_choice[2],
                "frame1PositionAlongFootAxis":round(heel_choice[0],5),
                "frame1MinZWithinCandidateBand":round(heel_choice[1],5),
                "sourceSelection":"BOTTOM_Z_IN_FIRST_LONGITUDINAL_QUARTILE"
            },
            "toeSide":{
                "vertexIndex":toe_choice[2],
                "frame1PositionAlongFootAxis":round(toe_choice[0],5),
                "frame1MinZWithinCandidateBand":round(toe_choice[1],5),
                "sourceSelection":"BOTTOM_Z_IN_LAST_LONGITUDINAL_QUARTILE"
            },
            "frame1AnkleToToeXYUnitAxis":[round(v,6) for v in axis],
            "frame1LongitudinalQuartiles":[round(q25,5),round(q75,5)],
            "totalWeightedVertices":len(points)
        }
finally:
    evaluated.to_mesh_clear()

observed=[]
for i,frame in enumerate(frames):
    scene.frame_set(frame)
    bpy.context.view_layer.update()
    ev=obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
    deform=ev.to_mesh()
    try:
        assert len(deform.vertices)==len(obj.data.vertices)
        matrix=ev.matrix_world
        feet={}
        for side,selectors in fixed.items():
            rows={}
            for key in ("heelSide","toeSide"):
                idx=selectors[key]["vertexIndex"]
                xyz=matrix @ deform.vertices[idx].co
                rows[key]={"vertexIndex":idx,"worldXYZ":[round(v,5) for v in xyz]}
            feet[side]=rows
        observed.append({"column":i,"frame60fps":frame,"feet":feet})
    finally:
        ev.to_mesh_clear()

camera_data=bpy.data.cameras.new("A3 original 160px camera")
camera=bpy.data.objects.new("A3 original 160px camera",camera_data)
scene.collection.objects.link(camera)
scene.camera=camera
camera_data.type="ORTHO";camera_data.ortho_scale=1.66
scene.render.resolution_x=160;scene.render.resolution_y=160
scene.render.resolution_percentage=100
offset=0 if args.clip=="silver_roll" else .67
focus=Vector((0,0,-.07+offset))
def project(point):
    uv=world_to_camera_view(scene,camera,point)
    px=(uv.x*160,(1-uv.y)*160)
    return {
        "sourceAtlasPx":[round(p,4) for p in px],
        "approved120DrawOffsetPx":[round(-67+px[0]*134/160,4),
                                    round(-78+px[1]*134/160,4)]
    }
view_samples=[]
for direction in range(8):
    ang=math.tau*direction/8
    camera.location=(3.25*math.sin(ang),-3.25*math.cos(ang),2.65+offset)
    camera.rotation_euler=(focus-Vector(camera.location)).to_track_quat("-Z","Y").to_euler()
    bpy.context.view_layer.update()
    for phase in observed:
        feet={}
        for side,rows in phase["feet"].items():
            feet[side]={key:{
                "vertexIndex":val["vertexIndex"],
                "projection":project(Vector(val["worldXYZ"]))
            } for key,val in rows.items()}
        view_samples.append({
            "direction":direction,
            "column":phase["column"],
            "sourceFrame60fps":phase["frame60fps"],
            "feet":feet
        })
assert len(view_samples)==64
report={
 "milestone":"Blood & Iron A2.18 persistent foot-region review landmarks",
 "clip":args.clip,
 "blender":bpy.app.version_string,
 "sourceGLBBasename":args.source.name,
 "sourceGLBSHA256":hashlib.sha256(args.source.read_bytes()).hexdigest(),
 "meshName":obj.name,
 "sourceMeshVertexCount":len(obj.data.vertices),
 "sourceFrames60fps":list(frames),
 "spriteSourceCanvasPx":[160,160],
 "approved120RollDrawRectPx":[-67,-78,134,134],
 "skinningThreshold":.35,
 "landmarkSelection":fixed,
 "phaseLandmarks":observed,
 "directionalLandmarks":view_samples,
 "anatomicalHeelOrOutsoleVerified":False,
 "candidateGeometricBandsMayContainArmor":True,
 "environmentGroundHeightKnown":False,
 "rigContactWithGroundVerified":False,
 "sourceModelModified":False,
 "atlasModified":False,
 "combatOrNetworkChanged":False,
 "productionApproved":False
}
args.output.parent.mkdir(parents=True,exist_ok=True)
args.output.write_text(json.dumps(report,indent=2,sort_keys=True)+"\n",encoding="utf8")
print("A218="+json.dumps({
  "clip":args.clip,"selection":{
    side:{tag:fixed[side][tag]["vertexIndex"]
     for tag in ("heelSide","toeSide")}
    for side in fixed},
  "poses":len(observed),"directions":len(view_samples)
}))

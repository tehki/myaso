#!/usr/bin/env python3
"""A2.19 non-destructive original A3 model close-up: candidate normals & renders.

Persistent vertex IDs come from A2.18 SHA-verified report. For each original
pose 1/7/22 measure actual evaluated surface vertex normals and produce
Workbench studio-rendered foot-region closeups with candidate markers.
Review-only; does not certify outsole faces, sole contact, or game floor.
"""
import argparse,hashlib,json,math,sys
from pathlib import Path
from mathutils import Vector
import bpy

p=argparse.ArgumentParser()
p.add_argument("--source",type=Path,required=True)
p.add_argument("--clip",choices=["silver_roll","t1_roll"],required=True)
p.add_argument("--a218",type=Path,required=True)
p.add_argument("--outdir",type=Path,required=True)
a=p.parse_args(sys.argv[sys.argv.index("--")+1:])
assert a.source.is_file() and a.a218.is_file()
baseline=json.loads(a.a218.read_text(encoding="utf-8"))
assert baseline["clip"]==a.clip
source_sha=hashlib.sha256(a.source.read_bytes()).hexdigest()
assert baseline["sourceGLBSHA256"]==source_sha
a.outdir.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene
scene.render.fps=60
bpy.ops.import_scene.gltf(filepath=str(a.source.resolve()))
rigs=[o for o in bpy.data.objects if o.type=="ARMATURE"]
assert len(rigs)==1 and len(rigs[0].data.bones)==22
rig=rigs[0]; act=bpy.data.actions.get("roll")
assert act and rig.animation_data
rig.animation_data.action=act
if act.slots:rig.animation_data.action_slot=act.slots[0]
for track in rig.animation_data.nla_tracks:track.mute=True
skinned=[o for o in bpy.data.objects if o.type=="MESH" and any(mod.type=="ARMATURE" for mod in o.modifiers)]
assert len(skinned)==1
mesh_obj=skinned[0]
assert len(mesh_obj.data.vertices)==baseline["sourceMeshVertexCount"]
# Source non-skinned objects may be original bake helpers; hide their geometry.
for o in bpy.data.objects:
    if o.type=="MESH" and o!=mesh_obj:o.hide_render=True
mesh_obj.color=(0.68,0.73,0.76,1.0)

scene.render.engine="BLENDER_WORKBENCH"
scene.display.shading.light="STUDIO"
scene.display.shading.color_type="OBJECT"
scene.display.shading.show_shadows=True
scene.display.shading.show_cavity=True
scene.display.shading.cavity_type="BOTH"
scene.render.film_transparent=False
scene.render.resolution_x=660
scene.render.resolution_y=500
scene.render.resolution_percentage=100
scene.render.image_settings.file_format="PNG"
scene.render.image_settings.color_mode="RGBA"
scene.render.image_settings.color_depth="8"
scene.camera=None
scene.render.threads_mode="FIXED"
scene.render.threads=2
cam_data=bpy.data.cameras.new("A2.19 review camera")
cam=bpy.data.objects.new("A2.19 review camera",cam_data)
scene.collection.objects.link(cam)
scene.camera=cam
cam_data.type="ORTHO"

legend=[
 ("LeftFoot","heelSide",(0.08,0.92,0.99,1)),
 ("LeftFoot","toeSide",(0.21,0.91,0.35,1)),
 ("RightFoot","heelSide",(1.0,0.70,0.11,1)),
 ("RightFoot","toeSide",(1.0,0.15,0.42,1))
]
markers={}
for side,key,color in legend:
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=8,radius=.033,location=(0,0,0))
    m=bpy.context.object
    m.name="REVIEW ONLY / "+side+" / "+key
    m.color=color
    markers[(side,key)]=m

view_specs=[
 ("front",Vector((0,-1,.20))),
 ("side",Vector((1,0,.2))),
 ("low",Vector((.32,-.60,-.65)))
]
frames=[1,7,22]
rows=[]
for frame in frames:
    scene.frame_set(frame)
    bpy.context.view_layer.update()
    evaluated=mesh_obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
    ev_mesh=evaluated.to_mesh()
    try:
        assert len(ev_mesh.vertices)==len(mesh_obj.data.vertices)
        mat=evaluated.matrix_world
        normal_transform=mat.to_3x3().inverted().transposed()
        footpoints=[]
        records=[]
        for side,key,color in legend:
            idx=baseline["landmarkSelection"][side][key]["vertexIndex"]
            vertex=ev_mesh.vertices[idx]
            point=mat @ vertex.co
            normal=normal_transform @ vertex.normal
            normal.normalize()
            footpoints.append(point.copy())
            markers[(side,key)].location=point.copy()
            records.append({
              "side":side,"candidate":key,
              "sourceVertexIndex":idx,
              "evaluatedWorldXYZ":[round(v,5) for v in point],
              "evaluatedWorldNormalXYZ":[round(v,5) for v in normal],
              "worldNormalDotZ":round(normal.z,5),
              "normalIsNotSoleProof":True
            })
        center=sum(footpoints,Vector())/len(footpoints)
        # Shared field of view includes feet/ankles through roll. Distances
        # are in SOURCE GLB local model units; not authoritative game metres.
        radius=max((point-center).length for point in footpoints)
        scale=max(1.15,2.3*radius)
        for viewname,viewvec in view_specs:
            cam.location=center+viewvec.normalized()*3.2
            cam.rotation_euler=(center-cam.location).to_track_quat("-Z","Y").to_euler()
            cam_data.ortho_scale=round(scale,4)
            scene.render.filepath=str(a.outdir/(a.clip+f"_a219_f{frame}_{viewname}.png"))
            bpy.ops.render.render(write_still=True)
            path=Path(scene.render.filepath)
            assert path.is_file() and path.stat().st_size>10000
        rows.append({
          "sourceFrame60fps":frame,
          "reviewCameraFocusWorldXYZ":[round(v,5) for v in center],
          "reviewCameraOrthoScale":round(scale,4),
          "originalEvaluatedSourceVertices":records
        })
    finally:
        evaluated.to_mesh_clear()
report={
  "milestone":"Blood & Iron A2.19 original evaluated A3 foot-region 3D closeup QA",
  "clip":a.clip,"blender":bpy.app.version_string,
  "sourceGLBBasename":a.source.name,"sourceGLBSHA256":source_sha,
  "sourceMeshName":mesh_obj.name,
  "originalSourceFrame60fps":frames,
  "reviewViews":["front","side","low"],
  "workbenchRenderingOnly":True,
  "renderedImages":len(frames)*len(view_specs),
  "markerSphereRadiusSourceModelUnits":.033,
  "landmarksAreHeuristicFootRegionsNotConfirmedOutsoles":True,
  "worldNormalDotZIsNotGameFloorContact":True,
  "authoritativeGameFloorUnknown":True,
  "anatomicalHeelOrOutsoleVerified":False,
  "originalGLBOrAtlasModified":False,
  "originalA3TimingModified":False,
  "knightPresentation120PercentUnchanged":True,
  "gameplayOrNetworkingModified":False,
  "productionApproved":False,
  "records":rows
}
out=a.outdir/(a.clip+"_a219_normals.json")
out.write_text(json.dumps(report,indent=2,sort_keys=True)+"\n",encoding="utf8")
print("A219="+json.dumps({
  "clip":a.clip,"renders":report["renderedImages"],
  "normalZ":[(x["side"],x["candidate"],x["worldNormalDotZ"])
    for x in rows[0]["originalEvaluatedSourceVertices"]]
},sort_keys=True))

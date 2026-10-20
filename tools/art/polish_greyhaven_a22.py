#!/usr/bin/env python3
"""Blood & Iron A2.2 — authentic roof material study for Greyhaven houses.

Reads the existing *reviewed* A2.1 scene. Creates a NEW editable Blender file,
without changing A1, A2, A2.1, historical GLBs or game/combat source.
Procedural slate, thatch and fired clay sheets are baked later, not enabled
in the browser by this script. Uses measured roof quad geometry instead of
guessed pitch/camera coordinates.
"""
import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
p=argparse.ArgumentParser()
p.add_argument("--base",type=Path,required=True)
p.add_argument("--out-dir",type=Path,required=True)
p.add_argument("--render",action="store_true")
p.add_argument("--samples",type=int,default=4)
a=p.parse_args(argv)
assert a.base.is_file()
a.out_dir.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(a.base.resolve()))
scene=bpy.context.scene
scene.render.engine="CYCLES"
scene.cycles.device="CPU"
scene.cycles.samples=max(4,min(a.samples,24))
scene.render.resolution_x=1120
scene.render.resolution_y=720
scene.render.resolution_percentage=100
scene.render.image_settings.file_format="PNG"
before={o.name for o in scene.objects if o.type=="MESH"}
legacy={o.name:o.hide_render for o in scene.objects if o.name.startswith("Red Lion /")}
barrels={o.name:tuple(round(v,6) for v in o.location)
         for o in scene.objects if o.name.startswith("Oak ale barrel /")}
assert len(barrels)==7

def mat(name,rgb,rough=.90,detail=.18):
    m=bpy.data.materials.new(name)
    m.diffuse_color=(*rgb,1)
    m.use_nodes=True
    n=m.node_tree.nodes
    n.clear()
    out=n.new("ShaderNodeOutputMaterial")
    bs=n.new("ShaderNodeBsdfPrincipled")
    bs.inputs["Roughness"].default_value=rough
    tex=n.new("ShaderNodeTexNoise")
    tex.inputs["Scale"].default_value=34
    tex.inputs["Detail"].default_value=3
    ramp=n.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color=(*[max(.001,c*(1-detail)) for c in rgb],1)
    ramp.color_ramp.elements[1].color=(*[min(1,c*(1+detail)) for c in rgb],1)
    bump=n.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value=.16
    bump.inputs["Distance"].default_value=.008
    links=m.node_tree.links
    links.new(tex.outputs["Fac"],ramp.inputs[0])
    links.new(tex.outputs["Fac"],bump.inputs["Height"])
    links.new(ramp.outputs["Color"],bs.inputs["Base Color"])
    links.new(bump.outputs["Normal"],bs.inputs["Normal"])
    links.new(bs.outputs["BSDF"],out.inputs["Surface"])
    return m

slates=[mat("A2.2 | Merchant blue slate",(.19,.24,.28)),
        mat("A2.2 | Merchant grey slate",(.28,.30,.29)),
        mat("A2.2 | Merchant lichen slate",(.23,.28,.24))]
thatches=[mat("A2.2 | Tanner dry reed",(.53,.42,.23),.99),
          mat("A2.2 | Tanner golden reed",(.63,.48,.26),.99),
          mat("A2.2 | Tanner wet reed",(.37,.33,.20),.99)]
clays=[mat("A2.2 | Weaver weathered clay",(.41,.20,.145)),
       mat("A2.2 | Weaver soot clay",(.34,.145,.10)),
       mat("A2.2 | Weaver pale fired clay",(.54,.29,.19))]
forges=[mat("A2.2 | Forge charcoal slate",(.135,.16,.18)),
        mat("A2.2 | Forge soot slate",(.08,.095,.10)),
        mat("A2.2 | Forge worn slate",(.22,.22,.21))]
wood=mat("A2.2 | split oak plank",(.29,.16,.082),.88,.21)
iron=mat("A2.2 | riveted forged iron",(.078,.074,.065),.63,.11)
limestone=mat("A2.2 | dressed lower-course stone",(.43,.40,.34),.96,.17)
stone_wet=mat("A2.2 | rain-darkened stone",(.31,.34,.31),.96,.19)

SPECS=[
 {"name":"Gable Merchant","center":(-12.8,-4.4),"width":5.2,"depth":4.5,
  "rot":0.0,"cover":"slate","mats":slates,"rows":13,"cols":18},
 {"name":"Tanner's Cottage","center":(12.7,-4.4),"width":4.25,"depth":4.35,
  "rot":0.0,"cover":"thatch","mats":thatches,"rows":23,"cols":27},
 {"name":"Stone Weaver","center":(-13.1,10.1),"width":5.3,"depth":4.7,
  "rot":math.pi,"cover":"clay","mats":clays,"rows":13,"cols":19},
 {"name":"Blacksmith","center":(12.6,10.0),"width":5.9,"depth":5.0,
  "rot":math.pi,"cover":"charcoal-slate","mats":forges,"rows":14,"cols":19}
]

def mesh_obj(name,vertices,faces,mats,ids,layer="world-base-candidate"):
    assert len(faces)==len(ids)
    mesh=bpy.data.meshes.new(name)
    mesh.from_pydata(vertices,[],faces)
    mesh.update()
    for m in mats:mesh.materials.append(m)
    for poly,mid in zip(mesh.polygons,ids):
        poly.material_index=mid
    obj=bpy.data.objects.new(name,mesh)
    scene.collection.objects.link(obj)
    obj["bake_layer"]=layer
    obj["art_review_only"]=True
    obj["provenance"]="original procedural myaso Blood & Iron A2.2"
    return obj

def append_quad(v,f,ids,corners,mi):
    start=len(v)
    v.extend(tuple(tuple(c) for c in corners))
    f.append((start,start+1,start+2,start+3))
    ids.append(mi)

def bilerp(q,u,v):
    A,B,C,D=q
    return A*(1-u)*(1-v)+B*u*(1-v)+C*u*v+D*(1-u)*v

roof_report=[]
roof_objs=[]
for spec in SPECS:
    roof=bpy.data.objects.get(spec["name"]+" / roof occlusion")
    assert roof is not None and roof.type=="MESH"
    assert len(roof.data.polygons)==5
    vr,fc,ids=[],[],[]
    for slope in range(2):
        polygon=roof.data.polygons[slope]
        assert len(polygon.vertices)==4
        quad=[roof.matrix_world @ roof.data.vertices[i].co for i in polygon.vertices]
        outward=(quad[1]-quad[0]).cross(quad[3]-quad[0]).normalized()
        if outward.z<0:outward=-outward
        assert outward.z>.35,"roof normal must face sky"
        for row in range(spec["rows"]):
            for col in range(spec["cols"]):
                # Historical roof remains under the patch grid. Deliberate
                # stagger and gaps make real joints rather than drawn lines.
                ru0=row/spec["rows"]
                ru1=(row+1)/spec["rows"]
                cv0=col/spec["cols"]
                cv1=(col+1)/spec["cols"]
                inset_u=.017/spec["rows"]
                inset_v=.065/spec["cols"]
                if spec["cover"]=="thatch":
                    inset_v=.27/spec["cols"]
                    inset_u=.02/spec["rows"]
                shift=.12/spec["cols"] if row%2 else 0
                v0=max(.003,cv0+shift+inset_v)
                v1=min(.997,cv1+shift-inset_v)
                if v1<=v0:continue
                u0=ru0+inset_u
                u1=ru1-inset_u
                offset=.031 + .004*((col*7+row*11+slope*3)%4)
                corners=[bilerp(quad,u0,v0)+outward*offset,
                         bilerp(quad,u1,v0)+outward*offset,
                         bilerp(quad,u1,v1)+outward*offset,
                         bilerp(quad,u0,v1)+outward*offset]
                append_quad(vr,fc,ids,corners,(col*3+row*7+slope)%len(spec["mats"]))
    assert len(fc)>400 and len(fc)<=1500
    roofdetail=mesh_obj(spec["name"]+" A2.2 / batched "+spec["cover"]+" roof",
                      vr,fc,spec["mats"],ids,"roof-occlusion-candidate")
    roofdetail["tile_count"]=len(fc)
    roofdetail["roof_source"]=roof.name
    roof_objs.append(roofdetail)
    # A2 had schematic roof-course markers; keep them in the derived .blend
    # for rollback while preventing bleed through the new roof surface.
    oldcourses=[o for o in scene.objects if
                o.name.startswith(spec["name"]+" / laid roof courses")]
    assert len(oldcourses)==14, (spec["name"],len(oldcourses))
    for ob in oldcourses:
        ob.hide_render=True
        ob["a22_hidden_for_review"]="reversible under roof detail"
    roof_report.append({"building":spec["name"],"cover":spec["cover"],
                        "individualPatches":len(fc),"batches":1,
                        "oldCoursesPreservedHidden":len(oldcourses)})

def world_pt(spec,x,y,z):
    a=spec["rot"]
    cx,cy=spec["center"]
    return (cx+x*math.cos(a)-y*math.sin(a),
            cy+x*math.sin(a)+y*math.cos(a),z)

def cube(v,f,ids,spec,center,half,material_id):
    x,y,z=center
    dx,dy,dz=half
    points=[world_pt(spec,x+xx*dx,y+yy*dy,z+zz*dz)
            for xx,yy,zz in ((-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),
                             (-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1))]
    start=len(v)
    v.extend(points)
    for face in ((4,5,6,7),(0,3,2,1),(0,1,5,4),
                 (1,2,6,5),(2,3,7,6),(3,0,4,7)):
        f.append(tuple(start+n for n in face))
        ids.append(material_id)

# One batched facade layer for all four buildings: hand-dressed stone courses,
# oak plank door faces and black iron hinge pins.
fac_v,fac_f,fac_ids=[],[],[]
stones_count=0
planks_count=0
hinges_count=0
for spec in SPECS:
    w,d=spec["width"],spec["depth"]
    # Four front facades are local +Y whether the building faces north or south.
    # Keep door step and central opening free of stone at both courses.
    for course in range(2):
        for j in range(16):
            xx=-w/2+.17+(j+.5)*(w-.34)/16
            if abs(xx)<.64:continue
            cube(fac_v,fac_f,fac_ids,spec,(xx,d/2+.148,.17+.23*course),
                 ((w-.38)/(16*2)-.012,.018,.065),
                 2+(j+course)%2)
            stones_count+=1
    # Door original center x=0, door face y=d/2+.13. Small planks with
    # staggered stains, kept outside the original door face.
    for j in range(7):
        xx=-.42+j*.14
        cube(fac_v,fac_f,fac_ids,spec,(xx,d/2+.24,1.18),
             (.056,.018,1.04),0)
        planks_count+=1
    for z in (.75,1.72):
        cube(fac_v,fac_f,fac_ids,spec,(-.35,d/2+.28,z),
             (.08,.017,.027),1)
        hinges_count+=1

facade=mesh_obj("Greyhaven A2.2 / batched stone doorwood and iron details",
                fac_v,fac_f,[wood,iron,limestone,stone_wet],fac_ids)
assert len(roof_objs)==4 and stones_count>=90
assert planks_count==28 and hinges_count==8

# Never mutate the placement/source of A2.1 barrels, knight assets or world.
assert all(o in scene.objects for o in before)
assert all(tuple(round(v,6) for v in scene.objects[n].location)==position
           for n,position in barrels.items())
assert len([o for o in scene.objects if o.get("provenance")==
             "original procedural myaso Blood & Iron A2.2"])==5
assert bpy.data.objects["Red Lion / roof_tile_courses"].hide_render

report={
 "milestone":"Blood & Iron A2.2 Greyhaven neighboring roofs and facades",
 "artOnly":True,"gameplayChanged":False,"combatChanged":False,
 "portalChanged":False,"A3RollChanged":False,"productionApproved":False,
 "inputBaseScene":a.base.name,
 "editableOutputScene":"blood_iron_greyhaven_a22.blend",
 "originalMeshObjectsPreserved":len(before),
 "originalBarrelsPreserved":len(barrels),
 "roofStudies":roof_report,
 "batchedFacade":{"meshes":1,"stoneFrontBlocks":stones_count,
                  "oakDoorPlanks":planks_count,"ironHingePins":hinges_count},
 "newMeshObjects":5,
 "originalProceduralMaterials":16,
 "renderer":"Cycles CPU","samples":scene.cycles.samples,
 "renderResolution":[1120,720],
 "browserFrameTimeMeasured":False,
 "textureAtlasBaked":False,
 "license":"original Python geometry and Blender shader nodes; no third-party assets"
}
out=a.out_dir/"blood_iron_greyhaven_a22.blend"
bpy.ops.wm.save_as_mainfile(filepath=str(out))
if a.render:
    for camera_name,filename in (
       ("A2 / street review / 3-4 angle","blood_iron_greyhaven_street_a22.png"),
       ("A2 / Red Lion hero / 3-4 angle","blood_iron_greyhaven_tavern_a22.png")):
        camera=bpy.data.objects.get(camera_name)
        assert camera and camera.type=="CAMERA"
        scene.camera=camera
        scene.render.filepath=str(a.out_dir/filename)
        bpy.ops.render.render(write_still=True)
    scene.camera=bpy.data.objects["A2 / street review / 3-4 angle"]
(a.out_dir/"blood_iron_greyhaven_a22_report.json").write_text(
    json.dumps(report,indent=2,sort_keys=True)+"\n",encoding="utf-8")
print("A22_REPORT="+json.dumps(report,sort_keys=True))

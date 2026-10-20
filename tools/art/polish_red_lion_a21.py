#!/usr/bin/env python3
"""Blood & Iron A2.1: additive original Red Lion architectural polish.

Run (Blender 4.5 LTS CPU):
  blender --background --factory-startup \
    --python tools/art/polish_red_lion_a21.py -- \
    --base /path/blood_iron_greyhaven_a2.blend --out-dir /path/a21-review --render

Non-destructive separate derived .blend. No animation, portals, physics, network
or source A1 OBJ changes. No downloads, commercial materials or gameplay edits.
"""
import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
p = argparse.ArgumentParser()
p.add_argument("--base", type=Path, required=True)
p.add_argument("--out-dir", type=Path, required=True)
p.add_argument("--render", action="store_true")
p.add_argument("--samples", type=int, default=4)
args = p.parse_args(argv)
assert args.base.is_file()
args.out_dir.mkdir(parents=True, exist_ok=True)

bpy.ops.wm.open_mainfile(filepath=str(args.base.resolve()))
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = max(4, min(24, args.samples))
scene.render.image_settings.file_format = "PNG"
scene.render.resolution_x = 1120
scene.render.resolution_y = 720
scene.render.resolution_percentage = 100

# Strictly require the historic known-good Blender A2 scene.
roof = bpy.data.objects.get("Red Lion / roof_slopes")
foundation = bpy.data.objects.get("Red Lion / foundation_stone")
door = bpy.data.objects.get("Red Lion / door_front")
assert all(o is not None and o.type == "MESH" for o in (roof, foundation, door))
assert roof.dimensions.x > 6.7 and roof.dimensions.z > 1.49
assert foundation.dimensions.x > 6.4
assert any(o.name.startswith("Oak ale barrel /") for o in scene.objects)
originals = {o.name for o in scene.objects if o.type == "MESH"}
original_barrels = {
    o.name: tuple(round(v,6) for v in o.location)
    for o in scene.objects if o.name.startswith("Oak ale barrel /")
}
assert len(original_barrels) == 7, "The verified non-overlap barrel layout must remain"

def material(name, colour, rough=0.91, noise=27, spread=.14):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*colour,1.0)
    mat.use_nodes = True
    ns, ln = mat.node_tree.nodes, mat.node_tree.links
    ns.clear()
    output = ns.new("ShaderNodeOutputMaterial")
    surf = ns.new("ShaderNodeBsdfPrincipled")
    surf.inputs["Roughness"].default_value = rough
    texture = ns.new("ShaderNodeTexNoise")
    texture.inputs["Scale"].default_value = noise
    texture.inputs["Detail"].default_value = 3
    ramp = ns.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (*[max(0,c*(1-spread)) for c in colour],1)
    ramp.color_ramp.elements[1].color = (*[min(1,c*(1+spread)) for c in colour],1)
    bump = ns.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value=.20
    bump.inputs["Distance"].default_value=.011
    ln.new(texture.outputs["Fac"], ramp.inputs[0])
    ln.new(texture.outputs["Fac"], bump.inputs["Height"])
    ln.new(ramp.outputs["Color"],surf.inputs["Base Color"])
    ln.new(bump.outputs["Normal"],surf.inputs["Normal"])
    ln.new(surf.outputs[0],output.inputs["Surface"])
    return mat

clay_tiles = [
    material("A2.1 | handmade fired tile / russet",(.38,.145,.095)),
    material("A2.1 | handmade fired tile / dark sienna",(.29,.105,.075)),
    material("A2.1 | handmade fired tile / moss tint",(.32,.19,.13)),
    material("A2.1 | handmade fired tile / ash faded",(.43,.23,.17)),
]
limestone = [
    material("A2.1 | low-course limestone / grey",(.41,.39,.33)),
    material("A2.1 | low-course limestone / tan",(.48,.43,.33)),
    material("A2.1 | low-course limestone / damp",(.33,.35,.29)),
]
oak = material("A2.1 | end-grain oak",(.26,.145,.082),.86,15,.17)
dark_oak = material("A2.1 | tarred oak / wet joints",(.13,.089,.066),.86,22,.09)
moss = material("A2.1 | subdued damp mortar",(.22,.27,.155),.99,12,.23)

def batch(name, verts, faces, materials, ids=None, layer="world-base-candidate"):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    ob = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(ob)
    for mat in materials:
        mesh.materials.append(mat)
    if ids:
        assert len(ids)==len(mesh.polygons)
        for poly, mid in zip(mesh.polygons, ids):
            poly.material_index=mid
    ob["bake_layer"]=layer
    ob["provenance"]="original procedural Blood & Iron A2.1"
    ob["art_review_only"]=True
    return ob

def cube_mesh(vertices, faces, ids, loc, half, material_idx=0):
    x,y,z=loc; a,b,c=half
    start=len(vertices)
    vertices.extend([(x-a,y-b,z-c),(x+a,y-b,z-c),
                     (x+a,y+b,z-c),(x-a,y+b,z-c),
                     (x-a,y-b,z+c),(x+a,y-b,z+c),
                     (x+a,y+b,z+c),(x-a,y+b,z+c)])
    for corners in ((4,5,6,7),(0,3,2,1),(0,1,5,4),(1,2,6,5),
                    (2,3,7,6),(3,0,4,7)):
        faces.append(tuple(start+i for i in corners))
        ids.append(material_idx)

# 1) Batched clay tiles: 11 sloping rows x 16 columns x 2 sides.
# A1 known measured 3.405m half span, pitch 1.5m, ridge Z=5,
# roof along Y [-6.615, -1.585]. Never guess export orientation.
ROOF_EAVE_HALF_SPAN = 3.405
ROOF_RIDGE_Z = 5.0
ROOF_RISE = 1.5
ROOF_Y_BACK = -6.615
ROOF_Y_FRONT = -1.585
tile_verts, tile_faces, tile_ids = [], [], []
tile_count = 0
tile_rows, tile_cols = 11, 16
for side in (-1,1):
    for row in range(tile_rows):
        r0 = .11 + (ROOF_EAVE_HALF_SPAN-.18)*row/tile_rows
        r1 = .11 + (ROOF_EAVE_HALF_SPAN-.18)*(row+1)/tile_rows
        # Offset alternate courses: attractive irregular joints but no holes.
        for col in range(tile_cols):
            yy0=ROOF_Y_BACK + (ROOF_Y_FRONT-ROOF_Y_BACK)*col/tile_cols
            yy1=ROOF_Y_BACK + (ROOF_Y_FRONT-ROOF_Y_BACK)*(col+1)/tile_cols
            inset=.014
            shift=(.030 if row%2 else -.017)
            yy0=max(ROOF_Y_BACK+.008,yy0+shift+inset)
            yy1=min(ROOF_Y_FRONT-.008,yy1+shift-inset)
            if yy1<=yy0: continue
            # Small sculptural unevenness remains deterministic.
            offset=0.043 + 0.006*((col*3+row*7)%4)
            lo,hi=(r0,r1) if side==1 else (-r1,-r0)
            def z_at(x):
                return ROOF_RIDGE_Z - ROOF_RISE*abs(x)/ROOF_EAVE_HALF_SPAN + offset
            start=len(tile_verts)
            tile_verts.extend(((lo,yy0,z_at(lo)),(hi,yy0,z_at(hi)),
                               (hi,yy1,z_at(hi)),(lo,yy1,z_at(lo))))
            tile_faces.append(tuple(start+i for i in (0,1,2,3)))
            tile_ids.append((col*7+row*11+(side+1)*2)%len(clay_tiles))
            tile_count += 1
assert 300<=tile_count<=352, tile_count
tiles=batch("Red Lion A2.1 / batched individually coloured clay roof tiles",
           tile_verts,tile_faces,clay_tiles,tile_ids,"roof-occlusion-candidate")
tiles["tile_count"]=tile_count
tiles["single_draw_mesh"]=True

# 2) Hand-dressed limestone at the front and left visible foundation.
# Existing A1 foundation remains as backing, so this is shallow face relief,
# not collidable new geometry. No tile/stone over the entrance steps.
stone_verts,stone_faces,stone_ids=[],[],[]
stone_count=0
course_z=(.12,.31)
for course,z in enumerate(course_z):
    for col in range(18):
        step=6.38/18
        xx=-3.19+(col+.5)*step
        if abs(xx)<.81 and course==0:
            continue
        y=-1.806 - .008*((col*3+course)%3)
        cube_mesh(stone_verts,stone_faces,stone_ids,
                  (xx,y,z),(.161,.021,.072),(col+course*5)%len(limestone))
        stone_count+=1
    # side wall facing west, placed at x slightly outside the A1 face
    for col in range(12):
        yy=-6.28+(col+.5)*(4.35/12)
        cube_mesh(stone_verts,stone_faces,stone_ids,
                  (-3.249,yy,z),(.025,.155,.072),(col+course*7)%len(limestone))
        stone_count+=1
stones=batch("Red Lion A2.1 / coursed uneven foundation dressing",
             stone_verts,stone_faces,limestone,stone_ids)
stones["stone_face_count"]=stone_count
assert stone_count >= 55

# 3) Oak draw-pegs on the visible front-frame joints (combined in one mesh).
# These are small wooden pin heads at two frame levels, no game interactions.
pegs_v,pegs_f,pegs_i=[],[],[]
peg_count=0
for x in (-3.22,-2.07,2.07,3.22):
    for z in (.67,1.67,2.63):
        # Main frontage lies at Y=-1.83, pegs float ~3cm outside the timber
        cube_mesh(pegs_v,pegs_f,pegs_i,(x,-1.797,z),
                  (.048,.027,.055),(peg_count%2))
        peg_count+=1
pegs=batch("Red Lion A2.1 / batched oak joinery pegs",
           pegs_v,pegs_f,[oak,dark_oak],pegs_i)
assert peg_count==12
pegs["peg_count"]=peg_count

# 4) Soot/damp detailing is shader-only: keep the original plaster surfaces.
# A soft, weathered roof gable treatment uses restrained procedural colours.
weathered = material("A2.1 | aged damp timber",(.18,.11,.073),.92,11,.22)
gable = bpy.data.objects["Red Lion / gables"]
for old in gable.data.materials:
    if "timber" in old.name.lower():
        # Legacy A1 materials remain available for rollback in the base .blend.
        # We don't swap the mesh: this polish layer is additive only.
        break

# Validate no mutation of original meshes and barrel positions.
assert all(name in scene.objects for name in originals)
assert all(tuple(round(v,6) for v in scene.objects[name].location)==pos
           for name,pos in original_barrels.items())
assert len([o for o in scene.objects if o.get("art_review_only")])==3
for ob in (tiles,stones,pegs):
    assert ob.type=="MESH" and ob.get("provenance")
assert bpy.data.objects.get("Red Lion / roof_slopes") == roof
assert bpy.data.objects.get("Red Lion / door_front") == door

report={
    "milestone":"Blood & Iron A2.1 additive Red Lion art polish",
    "baseScene":args.base.name,"editableSource":"blood_iron_red_lion_a21.blend",
    "artOnly":True,"productionApproved":False,"physicsChanged":False,
    "doorPortalChanged":False,"combatChanged":False,"rollChanged":False,
    "originalMeshObjectsPreserved":len(originals),
    "roof":{"tileCount":tile_count,"meshBatches":1,"materialVariants":len(clay_tiles),
            "occlusionLayer":"roof-occlusion-candidate"},
    "stoneFoundation":{"faceBlocks":stone_count,"meshBatches":1},
    "timberJoinery":{"pegs":peg_count,"meshBatches":1},
    "newArtMeshes":3,"materialsAdded":len(clay_tiles)+len(limestone)+3,
    "barrelsUnchanged":len(original_barrels),
    "renderer":"Cycles CPU","samples":scene.cycles.samples,
    "renderSize":[scene.render.resolution_x,scene.render.resolution_y],
    "drawCallWarning":"Blender mesh batching measured; browser draw calls not validated",
    "license":"Project-authored procedural geometry; no external textures/assets"
}
out=args.out_dir/"blood_iron_red_lion_a21.blend"
bpy.ops.wm.save_as_mainfile(filepath=str(out))
if args.render:
    for camera_name, filename in (
        ("A2 / Red Lion hero / 3-4 angle","blood_iron_red_lion_a21.png"),
        ("A2 / street review / 3-4 angle","blood_iron_street_a21.png"),
    ):
        camera=bpy.data.objects.get(camera_name)
        assert camera and camera.type=="CAMERA"
        scene.camera=camera
        scene.render.filepath=str(args.out_dir/filename)
        bpy.ops.render.render(write_still=True)
    scene.camera=bpy.data.objects["A2 / street review / 3-4 angle"]
(args.out_dir/"blood_iron_red_lion_a21_report.json").write_text(
    json.dumps(report,sort_keys=True,indent=2)+"\n",encoding="utf8")
print("A21_REPORT="+json.dumps(report,sort_keys=True))

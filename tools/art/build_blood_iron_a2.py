#!/usr/bin/env python3
"""Blood & Iron A2: original procedural medieval street, Blender 4.5 LTS.

Run with blender --background --python tools/art/build_blood_iron_a2.py -- \
    --a1-obj assets/environment/greyhaven/red_lion_blockout.obj \
    --out-dir <directory> [--render]

No network, texture downloads, random placement, physics, portals or engine code.
1 authoring meter = 40 game world units (visual comparison ONLY).
This is an ART-REVIEW SCENE, not a playable or photorealistic production export.
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
p.add_argument("--a1-obj", type=Path, required=True)
p.add_argument("--out-dir", type=Path, required=True)
p.add_argument("--render", action="store_true")
p.add_argument("--samples", type=int, default=16)
args = p.parse_args(argv)
args.out_dir.mkdir(parents=True, exist_ok=True)
assert args.a1_obj.is_file(), args.a1_obj

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
for material in list(bpy.data.materials):
    bpy.data.materials.remove(material)

scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"  # Windows GT 630 / 2 GB: never assume working GPU path
scene.cycles.samples = max(4, min(args.samples, 64))
scene.render.resolution_x = 1120
scene.render.resolution_y = 720
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.view_settings.view_transform = "AgX"
scene.world.color = (0.24, 0.28, 0.33)
scene.unit_settings.system = "METRIC"
scene.render.film_transparent = False

def mat(name, rgb, rough=0.83, noise_scale=14, variation=0.14, bump=0.18, metal=0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*rgb, 1)
    m.use_nodes = True
    n = m.node_tree.nodes
    n.clear()
    out = n.new("ShaderNodeOutputMaterial")
    bsdf = n.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    tex = n.new("ShaderNodeTexNoise")
    tex.inputs["Scale"].default_value = noise_scale
    tex.inputs["Detail"].default_value = 3
    tex.inputs["Roughness"].default_value = 0.7
    ramps = n.new("ShaderNodeValToRGB")
    ramps.color_ramp.elements[0].position = 0.18
    ramps.color_ramp.elements[1].position = 0.83
    dark = tuple(max(0.0, c * (1 - variation)) for c in rgb)
    light = tuple(min(1.0, c * (1 + variation)) for c in rgb)
    ramps.color_ramp.elements[0].color = (*dark, 1)
    ramps.color_ramp.elements[1].color = (*light, 1)
    links = m.node_tree.links
    links.new(tex.outputs["Fac"], ramps.inputs[0])
    links.new(ramps.outputs["Color"], bsdf.inputs["Base Color"])
    if bump:
        bn = n.new("ShaderNodeBump")
        bn.inputs["Strength"].default_value = bump
        bn.inputs["Distance"].default_value = 0.025
        links.new(tex.outputs["Fac"], bn.inputs["Height"])
        links.new(bn.outputs["Normal"], bsdf.inputs["Normal"])
    links.new(bsdf.outputs[0], out.inputs["Surface"])
    return m

stone = mat("A2 | worn limestone / procedural", (.42,.39,.32), .94, 24,.20,.35)
plaster = mat("A2 | rain-stained lime plaster", (.68,.62,.50), .95, 7,.22,.13)
timber = mat("A2 | aged oak grain", (.21,.12,.075), .88, 11,.30,.24)
oak = mat("A2 | warm oak joinery", (.35,.20,.105), .79, 13,.25,.16)
tile = mat("A2 | fired clay tiles", (.43,.165,.105), .89, 18,.32,.26)
slate = mat("A2 | dark weathered slate", (.22,.26,.28), .87, 20,.18,.24)
straw = mat("A2 | sun-bleached thatch", (.51,.39,.20), .99, 31,.27,.25)
iron = mat("A2 | forged black iron", (.08,.075,.070), .52, 34,.18,.14,.75)
glass = mat("A2 | leaded smoke glass", (.075,.11,.12), .31, 4,.13,.08,.18)
soil = mat("A2 | damp compact earth", (.19,.17,.105), .99, 9,.36,.20)
grass = mat("A2 | late-autumn meadow", (.21,.27,.12), .97, 11,.31,.15)
road = mat("A2 | blue-grey cobbles", (.35,.35,.32), .95, 24,.30,.3)
leaf = mat("A2 | oak foliage", (.19,.24,.105), .97, 15,.45,.1)
leafgold = mat("A2 | October leaves", (.45,.26,.07), .94, 13,.32,.1)
ember = mat("A2 | forge embers", (.8,.19,.03), .63, 6,.1,0)
red = mat("A2 | painted red lion", (.44,.12,.08), .81, 12,.18,.15)

def box(name, loc, dims, material, bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    ob = bpy.context.object
    ob.name = name
    ob.dimensions = dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    ob.data.materials.append(material)
    if bevel:
        mod = ob.modifiers.new("soft weathered edges", "BEVEL")
        mod.width = min(bevel, min(dims)*.25)
        mod.segments = 1
        ob.modifiers.new("weighted corners", "WEIGHTED_NORMAL")
    return ob

def beam(name, start, end, thickness, material):
    a,b=Vector(start),Vector(end)
    ob=box(name,(a+b)/2,(thickness,thickness,(b-a).length),material)
    ob.rotation_euler=(b-a).to_track_quat("Z","Y").to_euler()
    return ob

def uv(name, pos, radius, material, segments=10, rings=6):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, radius=radius, location=pos)
    ob=bpy.context.object
    ob.name=name
    ob.data.materials.append(material)
    for poly in ob.data.polygons: poly.use_smooth=True
    return ob

def cylinder(name, pos, radius, depth, material, verts=12, rot=None):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=depth, location=pos)
    ob=bpy.context.object
    ob.name=name
    if rot: ob.rotation_euler=rot
    ob.data.materials.append(material)
    return ob

def roof_prism(name, cx,cy,w,d,h, rise, material, gable_material, rot=0):
    # Ridge runs on local Y; actual gables are closed rather than one flat plane.
    x0,x1=-w/2-.24,w/2+.24
    y0,y1=-d/2-.30,d/2+.30
    pts=[(x0,y0,h),(0,y0,h+rise),(x1,y0,h),
         (x0,y1,h),(0,y1,h+rise),(x1,y1,h)]
    co,si=math.cos(rot),math.sin(rot)
    vs=[(cx+x*co-y*si,cy+x*si+y*co,z) for x,y,z in pts]
    fs=[(0,1,4,3),(1,2,5,4),(0,2,1),(3,4,5),(0,3,5,2)]
    mesh=bpy.data.meshes.new(name)
    mesh.from_pydata(vs,[],fs)
    mesh.materials.append(material)
    mesh.materials.append(gable_material)
    mesh.polygons[2].material_index=1
    mesh.polygons[3].material_index=1
    obj=bpy.data.objects.new(name,mesh)
    scene.collection.objects.link(obj)
    return obj

def local(cx,cy,rot,x,y,z):
    return (cx + x*math.cos(rot)-y*math.sin(rot),
            cy + x*math.sin(rot)+y*math.cos(rot),z)

def facade_box(name,cx,cy,rot,x,y,z,dx,dy,dz,material,bevel=0):
    obj=box(name,local(cx,cy,rot,x,y,z),(dx,dy,dz),material,bevel)
    obj.rotation_euler.z=rot
    return obj

def house(name,x,y,w,d,eave,rise,wallmat,roofmat,rot=0,chimney=False):
    facade_box(name+" / rubble foundation",x,y,rot,0,0,.28,w+.25,d+.25,.56,stone,.07)
    facade_box(name+" / plaster walls",x,y,rot,0,0,(eave+.56)/2,w,d,eave-.56,wallmat,.04)
    roof_prism(name+" / roof occlusion",x,y,w,d,eave,rise,roofmat,wallmat,rot)
    # Shallow roof-tile rows give readable scale before any image-texture baking.
    for j in range(7):
        xx=(j+1)*(w/2)/8
        for side in (-1,1):
            zz=eave+rise*(1-xx/(w/2+.24))+.035
            facade_box(name+" / laid roof courses",x,y,rot,side*xx,0,zz,.055,d+.43,.055,roofmat)
    for lx in (-w/2+.09,0,w/2-.09):
        facade_box(name+" / vertical timber",x,y,rot,lx,d/2+.055,eave/2,.15,.17,eave-.45,timber)
    for z in (.68,1.65,eave-.13):
        facade_box(name+" / horizontal timber",x,y,rot,0,d/2+.10,z,w+.1,.16,.13,timber)
    for side in (-1,1):
        xx=side*(w*.29)
        facade_box(name+" / leadlight",x,y,rot,xx,d/2+.115,1.78,.67,.08,.78,glass)
        facade_box(name+" / glazed muntin",x,y,rot,xx,d/2+.18,1.78,.065,.08,.78,oak)
        facade_box(name+" / glazed transom",x,y,rot,xx,d/2+.18,1.83,.70,.08,.055,oak)
        facade_box(name+" / shutter",x,y,rot,xx+side*.49,d/2+.13,1.76,.22,.12,.86,oak)
    facade_box(name+" / oak door",x,y,rot,0,d/2+.13,1.19,1.0,.15,2.18,oak,.03)
    facade_box(name+" / iron hinges",x,y,rot,-.38,d/2+.23,1.42,.22,.07,.055,iron)
    facade_box(name+" / doorstep",x,y,rot,0,d/2+.62,.13,1.35,.9,.25,stone,.04)
    for side in (-1,1):
        # Diagonal oak braces at entrance show traditional half-timber construction.
        a=local(x,y,rot,side*(w*.47),d/2+.16,.9)
        b=local(x,y,rot,side*(w*.25),d/2+.16,1.56)
        beam(name+" / diagonal brace",a,b,.10,timber)
    if chimney:
        facade_box(name+" / chimney stone",x,y,rot,w*.31,-d*.16,eave+.3,.60,.62,2.5,stone,.07)
        facade_box(name+" / chimney cap",x,y,rot,w*.31,-d*.16,eave+1.6,.81,.82,.25,stone,.05)

# Red Lion: keep original A1 scale and material IDs, but enhance shaders.
pre=set(bpy.context.scene.objects)
# Import by Blender OBJ group so the original A1 barrel cluster can be replaced
# art-side, without editing the historical A1 OBJ or any portal geometry.
bpy.ops.wm.obj_import(filepath=str(args.a1_obj.resolve()), forward_axis="Y",
                      up_axis="Z", use_split_groups=True)
imported=[obj for obj in scene.objects if obj not in pre]
a1_barrel_groups=[obj for obj in imported if obj.name=="tavern_barn_accessories"]
assert len(a1_barrel_groups)==1, "A1 barrel group must remain independently importable"
for ob in a1_barrel_groups:
    bpy.data.objects.remove(ob, do_unlink=True)
imported=[obj for obj in imported if obj not in a1_barrel_groups]
replaced={"limestone":stone,"limewash":plaster,"old_timber":timber,
          "roof_tile":tile,"dark_wood":oak,"window":glass,
          "iron":iron,"red_lion":red}
for ob in imported:
    ob.location.y-=4.1
    ob.name="Red Lion / "+ob.name
    if ob.type=="MESH":
        for i,old in enumerate(ob.data.materials):
            if old:
                key=old.name.lower().split(".")[0]
                if key in replaced: ob.data.materials[i]=replaced[key]

# A deliberately composed street study, NOT a network/world placement manifest.
house("Gable Merchant", -12.8,-4.4,5.2,4.5,3.9,1.9,plaster,slate,chimney=True)
house("Tanner's Cottage", 12.7,-4.4,4.25,4.35,3.25,1.4,plaster,straw,chimney=True)
house("Stone Weaver", -13.1,10.1,5.3,4.7,3.1,1.35,stone,tile,math.pi,chimney=True)
house("Blacksmith", 12.6,10.0,5.9,5.0,3.65,1.5,plaster,slate,math.pi,chimney=True)
# A2.7.1: place the outdoor forge to the west of the anvil, outside
# the entrance/doorstep corridor. Visual authoring only, no collision rules.
# Forge x bounds [8.65,9.95], anvil x bounds [10.275,11.125]:
# 0.325 m separation. Door is centered x=12.6, y≈7.37.
box("Blacksmith / open forge hearth",(9.3,6.05,.62),(1.3,.8,1.1),stone,.1)
box("Blacksmith / orange embers",(9.3,5.70,.92),(.78,.08,.31),ember)
box("Blacksmith / anvil",(10.7,6.4,.92),(.85,.46,.27),iron,.06)
box("Blacksmith / anvil stand",(10.7,6.4,.51),(.45,.42,.63),timber,.05)

# Stable authored cobbles, one combined mesh instead of hundreds of draw objects.
box("Landscape / countryside", (0,2,-.13),(52,34,.25),grass)
box("Road / earth subbase", (0,2.6,.018),(49,6.8,.07),soil)
verts,faces=[],[]
stones=0
for row in range(12):
    yy=-.61+row*.55
    for col in range(86):
        xx=-24.0+col*.57+(row%2)*.285
        stagger=((col*7+row*11)%9)/9
        cx=xx+(stagger-.5)*.055
        cy=yy+((row*5+col*13)%7-3)*.019
        dx=.45 + (col%3)*.018
        dy=.43 + (row%4)*.009
        z=.054 + ((col+row*2)%5)*.004
        base=len(verts)
        verts.extend([(cx-dx/2,cy-dy/2,z),(cx+dx/2,cy-dy/2,z),
          (cx+dx/2,cy+dy/2,z),(cx-dx/2,cy+dy/2,z),
          (cx-dx/2,cy-dy/2,z+.085),(cx+dx/2,cy-dy/2,z+.085),
          (cx+dx/2,cy+dy/2,z+.085),(cx-dx/2,cy+dy/2,z+.085)])
        for f in [(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]:
            faces.append(tuple(base+i for i in f))
        stones+=1
mesh=bpy.data.meshes.new("authored-cobbles-mesh")
mesh.from_pydata(verts,[],faces)
mesh.materials.append(road)
obj=bpy.data.objects.new("Road / 1032 batched cobbles",mesh)
scene.collection.objects.link(obj)

def tree(name,x,y,scale,autumn=False):
    cylinder(name+" / trunk",(x,y,scale*.72),.16*scale,1.5*scale,timber,9)
    for j,xyz in enumerate(((0,0,1.65),(-.47,.1,2.05),(.45,.3,2.09),(.1,-.42,2.3))):
        ob=uv(name+f" / leaf-cluster-{j}",(x+xyz[0]*scale,y+xyz[1]*scale,xyz[2]*scale),.74*scale,leafgold if autumn else leaf)
        ob.scale=(1.18,1.04,.75)

for i,(x,y,s) in enumerate([(-21,-8,1.45),(-19,13,1.2),(-6,12,1.05),
                            (3,12.8,1.25),(20,12.7,1.45),(21,-7,1.2)]):
    tree("Oak "+str(i+1),x,y,s,i%3==0)
for i,(x,y) in enumerate([(-18,-1.5),(-17,7.3),(-6,8.1),(1.5,8.1),(6.6,8),
                           (17,7.7),(19,-1.8),(-5,-1.4),(4.2,-1.4)]):
    for j in range(3):
        uv(f"Ground cover {i} {j}",(x+.34*j,y+.15*(j%2),.15),.26,grass,8,4)

# Fence segments, wooden cart, barrels and small forge props.
for yy in (-1.9,7.6):
    for x in (-20,-19,-18,18,19,20):
        box("Fence / split oak post",(x,yy,.57),(.12,.13,1.14),oak,.02)
    for x in (-19,-18,19,20):
        box("Fence / split oak rail",(x-.5,yy,.56),(1.02,.10,.10),timber)
        box("Fence / top rail",(x-.5,yy,.91),(1.02,.10,.10),timber)

box("Handcart / plank bed",(5.9,-1.45,.63),(2.8,1.15,.21),oak,.04)
box("Handcart / iron-bound edge",(5.9,-1.45,.85),(2.9,.12,.29),timber)
for x in (5.05,6.73):
    for y in (-2.12,-.78):
        cylinder("Handcart / wheel",(x,y,.48),.45,.14,oak,16,rot=(math.pi/2,0,0))
        cylinder("Handcart / hub",(x,y,.48),.12,.16,iron,12,rot=(math.pi/2,0,0))
# Outer iron band is wider than the barrel body; use its diameter for
# separation. These replace the original overlapping A1 cluster and the
# earlier overlapping street trio. All coordinates are authoring meters.
BARREL_OUTER_RADIUS = .315
BARREL_MIN_GAP = .10
BARREL_LAYOUT = (
    ("red-lion-left-1", -2.42, -1.53),
    ("red-lion-left-2", -3.21, -1.54),
    ("red-lion-right", 2.45, -1.45),
    ("street-left-1", -5.05, -1.45),
    ("street-left-2", -5.83, -1.52),
    ("street-left-3", -4.58, -2.28),
    ("blacksmith", 16.8, 7.6),
)
barrel_min_clearance = float("inf")
for i, (name, x, y) in enumerate(BARREL_LAYOUT):
    for other_name, ox, oy in BARREL_LAYOUT[:i]:
        edge_gap = math.hypot(x-ox,y-oy) - 2 * BARREL_OUTER_RADIUS
        barrel_min_clearance = min(barrel_min_clearance, edge_gap)
        assert edge_gap >= BARREL_MIN_GAP-1e-9, (
            f"Barrels overlap / too close: {name} and {other_name} "
            f"have only {edge_gap:.3f} m edge clearance"
        )
    cylinder(f"Oak ale barrel / {name}",(x,y,.51),.30,.92,timber,12)
    cylinder(f"Barrel iron band / {name}",(x,y,.77),BARREL_OUTER_RADIUS,.07,iron,12)
    cylinder(f"Barrel iron foot / {name}",(x,y,.26),BARREL_OUTER_RADIUS,.06,iron,12)

# Atmospheric but legible, neutral daylight. All lighting is render-only.
world=scene.world
world.use_nodes=True
world.node_tree.nodes["Background"].inputs["Color"].default_value=(.28,.37,.48,1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value=.48

bpy.ops.object.light_add(type="SUN", location=(1,0,18))
sun=bpy.context.object
sun.name="A2 / overcast low October sun"
sun.rotation_euler=(math.radians(27),math.radians(-24),math.radians(-23))
sun.data.energy=1.6
sun.data.angle=math.radians(14)
bpy.ops.object.light_add(type="AREA", location=(-8,12,22))
fill=bpy.context.object
fill.name="A2 / soft sky bounce"
fill.data.energy=1800
fill.data.shape="DISK"
fill.data.size=22

def camera(name,loc,target,scale):
    bpy.ops.object.camera_add(location=loc)
    cam=bpy.context.object
    cam.name=name
    cam.rotation_euler=(Vector(target)-cam.location).to_track_quat("-Z","Y").to_euler()
    cam.data.type="ORTHO"
    cam.data.ortho_scale=scale
    return cam

wide=camera("A2 / street review / 3-4 angle",(31,42,35),(0,2,1),43)
close=camera("A2 / Red Lion hero / 3-4 angle",(16,14,14),(0,-3.2,1.8),14.4)
scene.camera=wide

# Explicit render-specific layers: game engine draw order is NOT modified.
for obj in scene.objects:
    if obj.type=="MESH" and ("roof" in obj.name.lower() or "gable" in obj.name.lower()):
        obj["bake_layer"]="roof-occlusion-candidate"
    elif obj.type=="MESH":
        obj["bake_layer"]="world-base-candidate"

blend=args.out_dir/"blood_iron_greyhaven_a2.blend"
bpy.ops.wm.save_as_mainfile(filepath=str(blend))
report={
    "milestone":"Blood & Iron A2 environment look-dev (not game integrated)",
    "sourceA1":args.a1_obj.name,"metersPerWorldUnit":0.025,
    "editableSource":blend.name,"renderer":"Cycles CPU","samples":scene.cycles.samples,
    "sceneMeshes":len([o for o in scene.objects if o.type=="MESH"]),
    "materialCount":len(bpy.data.materials),"batchedCobblestones":stones,
    "barrels":{"count":len(BARREL_LAYOUT),"outerRadiusMeters":BARREL_OUTER_RADIUS,
               "minimumRequiredGapMeters":BARREL_MIN_GAP,
               "measuredMinimumEdgeClearanceMeters":round(barrel_min_clearance,3),
               "removedOverlappingSourceGroup":True},
    "buildings":["Red Lion A1 enhanced","Gable Merchant","Tanner's Cottage",
                 "Stone Weaver","Blacksmith"],
    "textures":"100% procedural Blender shader nodes; no external reference assets",
    "renderResolution":[1120,720],
    "occlusion":"Candidate tags only; no runtime occlusion or portal implementation",
    "knights":"Not imported in A2 composition; integration/comparison still required",
    "artOnly":True
}
if args.render:
    scene.camera=wide
    scene.render.filepath=str(args.out_dir/"blood_iron_street_a2.png")
    bpy.ops.render.render(write_still=True)
    scene.camera=close
    scene.render.filepath=str(args.out_dir/"blood_iron_red_lion_a2.png")
    bpy.ops.render.render(write_still=True)
    scene.camera=wide
(args.out_dir/"blood_iron_a2_report.json").write_text(json.dumps(report,indent=2)+"\n",encoding="utf8")
print("BLOOD_IRON_A2_REPORT="+json.dumps(report,sort_keys=True))

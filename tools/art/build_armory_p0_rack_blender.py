"""Moon Games 3B P0 original Blender art source for smith rack and sword.
Usage: blender -b -t 2 --python tools/art/build_armory_p0_rack_blender.py -- --outdir <dir>
Authors real editable Blender geometry; exports transparent original rack/sword PNGs
for deterministic Pillow lossless WebP postprocessing. World sockets NOT chosen.
"""
import bpy,sys,argparse,math,json
from pathlib import Path
from mathutils import Vector
p=argparse.ArgumentParser()
p.add_argument("--outdir",required=True)
a=p.parse_args(sys.argv[sys.argv.index("--")+1:])
out=Path(a.outdir).resolve()
out.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action="SELECT");bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene
scene.render.engine="CYCLES"
scene.cycles.samples=8
scene.cycles.device="CPU"
scene.render.film_transparent=True
scene.render.resolution_percentage=100
scene.render.image_settings.file_format="PNG"
scene.render.image_settings.color_mode="RGBA"
scene.render.image_settings.color_depth="8"
scene.view_settings.view_transform="Standard"
scene.render.threads_mode="FIXED";scene.render.threads=2
def material(name,color,metal=0,rough=.72):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1)
 m.use_nodes=True
 b=m.node_tree.nodes.get("Principled BSDF")
 b.inputs["Base Color"].default_value=(*color,1)
 b.inputs["Metallic"].default_value=metal
 b.inputs["Roughness"].default_value=rough
 return m
oak=material("P0 | smoked oak, iron-banded",(.19,.104,.055),0,.88)
woodlight=material("P0 | wear-polished oak edge",(.31,.18,.09),0,.76)
iron=material("P0 | aged forged iron",(.085,.086,.073),.8,.48)
steel=material("P0 | bright forged blade",(.55,.60,.59),.78,.25)
steelshade=material("P0 | blade central ridge",(.78,.83,.81),.85,.25)
grip=material("P0 | dark leather grip",(.14,.072,.035),.09,.9)
bronze=material("P0 | worn brass guard",(.42,.28,.12),.65,.44)
rack=[]
sword=[]
def cube(collection,name,at,dims,mat,bevel=.025):
 bpy.ops.mesh.primitive_cube_add(size=1,location=at)
 o=bpy.context.object;o.name=name;o.dimensions=dims
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 o.data.materials.append(mat)
 if bevel:
  mod=o.modifiers.new("Hand-forged soft edge",type="BEVEL")
  mod.width=bevel;mod.segments=2
  bpy.context.view_layer.objects.active=o
  bpy.ops.object.modifier_apply(modifier=mod.name)
  o.modifiers.new("Weighted corner normals",type="WEIGHTED_NORMAL")
 collection.append(o);return o
def ball(collection,name,at,scale,mat):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=6,radius=1,location=at)
 o=bpy.context.object;o.name=name;o.scale=scale;o.data.materials.append(mat)
 collection.append(o);return o
# Gallery-like exposed four-slot wall rack; not invented collision geometry.
for side,x in (("W",-2.01),("E",2.01)):
 cube(rack,f"Rack {side} hewn oak post",(x,0,.94),(.23,.23,1.74),oak)
 cube(rack,f"Rack {side} projecting ground foot",(x,-.22,.15),(.54,.70,.24),oak)
 for z in (.44,1.30):
  ball(rack,f"Rack {side} hand-forged pin at {z}",(x,-.145,z),(.047,.03,.047),iron)
for z,depth in ((.65,.28),(1.38,.23)):
 cube(rack,f"Rack horizontal weathered oak rail z{z}",(0,.03,z),(4.17,depth,.25),oak)
 cube(rack,f"Rack upper worn lip z{z}",(0,-.13,z),(3.98,.048,.056),woodlight,.012)
for k,x in enumerate((-1.5,-.5,.5,1.5),1):
 cube(rack,f"Rack socket {k} iron hook top",(x,-.19,1.26),(.13,.33,.08),iron,.012)
 cube(rack,f"Rack socket {k} iron hook lip",(x,-.36,1.12),(.12,.06,.28),iron,.01)
 ball(rack,f"Rack socket {k} rivet",(x,-.19,1.39),(.04,.034,.04),iron)
 cube(rack,f"Rack socket {k} heel spacer",(x,-.21,.66),(.16,.16,.1),iron,.012)
# Editable sword model: individually alpha-cropped, NEVER an equipped state.
cube(sword,"Sword leather-wrapped tang",(0,0,.42),(.115,.095,.43),grip,.021)
cube(sword,"Sword forged crossguard",(0,0,.67),(.51,.125,.085),iron,.028)
cube(sword,"Sword brass guard trim",(0,-.069,.675),(.42,.014,.02),bronze,.006)
ball(sword,"Sword faceted pommel",(0,0,.16),(.105,.10,.105),iron)
# Diamond-profile taper with a central ridge
verts=[
 (-.118,-.044,.72),(.118,-.044,.72),(.118,.044,.72),(-.118,.044,.72),
 (-.082,-.035,1.58),(.082,-.035,1.58),(.082,.035,1.58),(-.082,.035,1.58),
 (0,0,1.94)]
faces=[
 (0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7),
 (4,5,8),(5,6,8),(6,7,8),(7,4,8),(0,3,2,1)]
mesh=bpy.data.meshes.new("Sword hand-forged faceted blade geometry")
mesh.from_pydata(verts,[],faces);mesh.update()
o=bpy.data.objects.new("Sword sword-shaped tapered iron blade",mesh)
bpy.context.collection.objects.link(o);o.data.materials.append(steel);sword.append(o)
cube(sword,"Sword narrow blade fuller",(0,-.05,1.12),(.027,.015,.69),steelshade,.005)
# Camera front/above for readable side and dimensionality.
camera_data=bpy.data.cameras.new("P0 rack 2.5D source camera")
camera=bpy.data.objects.new("P0 rack 2.5D source camera",camera_data)
scene.collection.objects.link(camera)
camera.location=(.1,-7.3,4.1)
target=Vector((0,0,1.02))
camera.rotation_euler=(target- camera.location).to_track_quat('-Z','Y').to_euler()
camera_data.type="ORTHO";scene.camera=camera
world=bpy.data.worlds.new("Alpha neutral environment");scene.world=world
world.use_nodes=True
world.node_tree.nodes.get("Background").inputs["Color"].default_value=(.45,.47,.47,1)
world.node_tree.nodes.get("Background").inputs["Strength"].default_value=.8
light=bpy.data.lights.new("Warm iron forge window softbox",type="AREA")
li=bpy.data.objects.new("Warm iron forge window softbox",light)
scene.collection.objects.link(li);li.location=(-3,-3,5);light.energy=750;light.shape="RECTANGLE";light.size=5;light.size_y=4

scene["P0_ART_NOT_WORLD_GEOMETRY"]="Editable rack and one sword visual sprite; sockets TBD by World #488"
scene["SOURCE_ART_OWNER"]="Moon Games / Graphics 3B"
scene["AUTHORITATIVE_ITEM_OWNERSHIP"]="Core 8B + Items 2B, never art"
source=out/"blacksmith_armory_p0_source.blend"
bpy.ops.wm.save_as_mainfile(filepath=str(source),compress=True,check_existing=False)
assert source.stat().st_size>10000

def render(name,show,hide,dims,ortho_scale,target_z):
 for x in show:x.hide_render=False
 for x in hide:x.hide_render=True
 camera.location=(0,-7.3,4.1 if name=="rack" else 3.35)
 target=Vector((0,0,target_z))
 camera.rotation_euler=(target-camera.location).to_track_quat("-Z","Y").to_euler()
 camera_data.ortho_scale=ortho_scale
 scene.render.resolution_x,scene.render.resolution_y=dims
 scene.render.filepath=str(out/("armory_"+name+"_source.png"))
 bpy.ops.render.render(write_still=True)
 path=Path(scene.render.filepath)
 assert path.stat().st_size>3500
 return dict(file=path.name,sourcePixels=list(dims),bytes=path.stat().st_size)

records={}
records["rack"]=render("rack",rack,sword,(240,166),3.1,.87)
records["sword"]=render("sword",sword,rack,(42,115),2.13,1.04)
(out/"blender_source_render.json").write_text(json.dumps({
  "rackOriginalMeshCount":len(rack),"swordOriginalMeshCount":len(sword),
  "originalBlenderSource":source.name,"renders":records,
  "worldSocketCoordinatesApproved":False,"serverItemIdentityAssigned":False,
  "graphicsOnly":True,"productionApproved":False
},indent=2)+"\n","utf8")
print("ARMORY_P0_BLENDER="+json.dumps(records))

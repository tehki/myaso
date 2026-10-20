"""Graphics 3A — original procedural adult human base-body proof of source.
Creates editable Blender/GLB sources and 8x4 RGBA idle frames.
Anatomy is intentionally an early neutral form study, not production realism.
No existing owner/third-party models are read or overwritten.
Blender 4.5.14: blender -b --python tools/art/build_adult_body_a0.py -- --body adult-masculine --outdir assets/characters/adult-body --frames-dir tmp/adult-masculine
"""
import bpy, math, pathlib, argparse, sys, json
from mathutils import Vector
from math import pi
args=sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
parser=argparse.ArgumentParser()
parser.add_argument("--body",choices=["adult-masculine","adult-feminine"],required=True)
parser.add_argument("--outdir",required=True)
parser.add_argument("--frames-dir",required=True)
a=parser.parse_args(args)
out=pathlib.Path(a.outdir).resolve();out.mkdir(parents=True,exist_ok=True)
frames=pathlib.Path(a.frames_dir).resolve();frames.mkdir(parents=True,exist_ok=True)
female=a.body=="adult-feminine"
bpy.ops.wm.read_factory_settings(use_empty=True)
sc=bpy.context.scene
sc.render.fps=60
sc.frame_start=1;sc.frame_end=13
# First-party neutral anatomical forms, no garments or permanently equipped items.
skin=bpy.data.materials.new("Warm natural skin - original procedural")
skin.diffuse_color=(.52,.335,.255,1) if female else (.43,.265,.195,1)
skin.use_nodes=True
skin.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value=skin.diffuse_color
skin.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value=.84
parts=[]
def ellipse(name,loc,radii,mat=skin):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=16,location=loc)
    o=bpy.context.object;o.name=name
    o.scale=radii
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(mat);parts.append(o)
    return o
def segment(name,start,end,radii):
    p=Vector(start);q=Vector(end);d=q-p
    o=ellipse(name,(p+q)/2,(radii[0],radii[1],d.length*.65))
    o.rotation_euler=d.to_track_quat("Z","Y").to_euler()
    bpy.context.view_layer.objects.active=o
    bpy.ops.object.transform_apply(location=False,rotation=True,scale=False)
    return o
shoulder=.355 if not female else .308
hip=.262 if not female else .306
chest=.290 if not female else .265
waist=.225 if not female else .207
ellipse("pelvis", (0,0,.93),(hip,.160,.219))
ellipse("abdomen", (0,0,1.126),(waist,.157,.225))
ellipse("ribcage", (0,0,1.35),(chest,.192,.274))
ellipse("shoulder girdle", (0,0,1.438),(shoulder,.153,.152))
ellipse("neck", (0,0,1.584),(.079,.075,.102))
ellipse("head skull", (0,-.006,1.716),(.117,.107,.144))
ellipse("jaw", (0,-.031,1.651),(.095,.086,.078))
ellipse("nose", (0,-.105,1.701),(.027,.037,.040))
for sign,side in [(-1,"Left"),(1,"Right")]:
    ellipse(side+" ear",(sign*.12,0,1.714),(.022,.029,.047))
    x=sign
    segment(side+" upper arm",(x*shoulder,0,1.456),(x*.463,-.013,1.182),(.077 if not female else .064,.074 if not female else .060))
    segment(side+" forearm",(x*.463,-.013,1.184),(x*.516,-.048,.955),(.066 if not female else .055,.060 if not female else .052))
    ellipse(side+" hand",(x*.524,-.061,.871),(.058,.041,.104))
    segment(side+" thigh",(x*.137,0,.895),(x*.161,-.008,.535),(.112 if not female else .119,.109))
    segment(side+" calf",(x*.162,-.006,.53),(x*.165,.012,.160),(.090,.086))
    ellipse(side+" ankle",(x*.165,-.005,.124),(.075,.067,.105))
    ellipse(side+" foot",(x*.165,-.095,.083),(.087,.163,.071))
if female:
    for sign in (-1,1):
        ellipse("natural bust contour "+str(sign),(sign*.127,-.161,1.385),(.123,.084,.116))
else:
    # Neutral form study of an adult body, not a sexual display.
    ellipse("pelvic anatomy neutral",(0,-.122,.805),(.054,.047,.076))
# Preserve a joined skin mesh with no embedded armor/clothes/weapons.
bpy.ops.object.select_all(action="DESELECT")
for o in parts:o.select_set(True)
bpy.context.view_layer.objects.active=parts[0]
bpy.ops.object.join()
body=bpy.context.object;body.name=a.body+" original skin"
body.data.remesh_voxel_size=.022
try:
    bpy.ops.object.voxel_remesh()
    print("VOXEL_REMESH_OK",len(body.data.vertices),flush=True)
except Exception as e:
    print("VOXEL_REMESH_FALLBACK",str(e),flush=True)
for face in body.data.polygons:face.use_smooth=True
# 22 named adult-neutral biped bones, independently editable rig.
ar=bpy.data.armatures.new(a.body+" rig")
rig=bpy.data.objects.new(a.body+" rig",ar);sc.collection.objects.link(rig)
bpy.ops.object.select_all(action="DESELECT")
rig.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.object.mode_set(mode="EDIT")
bones=[
 ("Hips",(0,0,.91),(0,0,1.04),None),
 ("Spine",(0,0,1.04),(0,0,1.225),"Hips"),
 ("Spine1",(0,0,1.225),(0,0,1.374),"Spine"),
 ("Spine2",(0,0,1.374),(0,0,1.513),"Spine1"),
 ("Neck",(0,0,1.513),(0,0,1.600),"Spine2"),
 ("Head",(0,0,1.6),(0,0,1.791),"Neck"),
]
for sign,side in [(-1,"Left"),(1,"Right")]:
    bones += [
      (side+"Shoulder",(0,0,1.464),(sign*shoulder,0,1.447),"Spine2"),
      (side+"Arm",(sign*shoulder,0,1.447),(sign*.463,-.01,1.181),side+"Shoulder"),
      (side+"ForeArm",(sign*.463,-.01,1.181),(sign*.516,-.04,.949),side+"Arm"),
      (side+"Hand",(sign*.516,-.04,.949),(sign*.53,-.075,.837),side+"ForeArm"),
      (side+"UpLeg",(sign*.135,0,.898),(sign*.164,0,.53),"Hips"),
      (side+"Leg",(sign*.164,0,.53),(sign*.165,0,.154),side+"UpLeg"),
      (side+"Foot",(sign*.165,0,.154),(sign*.165,-.151,.079),side+"Leg"),
      (side+"ToeBase",(sign*.165,-.151,.079),(sign*.165,-.237,.083),side+"Foot"),
    ]
# Keep 22: 6 spine/head + 8 x 2 = 22.
assert len(bones)==22,len(bones)
for name,start,end,parent in bones:
    b=ar.edit_bones.new(name);b.head=start;b.tail=end;b.roll=0
for name,start,end,parent in bones:
    if parent:ar.edit_bones[name].parent=ar.edit_bones[parent]
bpy.ops.object.mode_set(mode="OBJECT")
# Smooth weights from closest bone segments. Correctness is preview-level;
# no claim of anatomical production-quality deformation yet.
groups={name:body.vertex_groups.new(name=name) for name,*_ in bones}
geometry=[(name,Vector(start),Vector(end)) for name,start,end,_ in bones]
for vert in body.data.vertices:
    pt=body.matrix_world@vert.co
    ds=[]
    for name,s,e in geometry:
        v=e-s
        fraction=max(0,min(1,(pt-s).dot(v)/(v.length_squared or 1)))
        distance=(pt-(s+fraction*v)).length
        ds.append((distance,name))
    ds.sort()
    close=ds[:3]
    ws=[1/(.037+d)**4 for d,_ in close]
    total=sum(ws)
    for (d,name),w in zip(close,ws):
        if w/total>.002:groups[name].add([vert.index],w/total,"REPLACE")
m=body.modifiers.new("Editably rigged skin","ARMATURE");m.object=rig
body.parent=rig
# Small genuine breathing idle, 4 samples; future locomotion must be authored separately.
pose_keys=[(1,0),(5,1),(9,0),(13,-1)]
for frame,phase in pose_keys:
    for pb in rig.pose.bones:pb.rotation_mode="XYZ";pb.rotation_euler=(0,0,0)
    rig.pose.bones["Spine2"].rotation_euler[0]=phase*.024
    rig.pose.bones["Head"].rotation_euler[2]=phase*.016
    rig.pose.bones["LeftArm"].rotation_euler[1]=phase*.012
    rig.pose.bones["RightArm"].rotation_euler[1]=-phase*.012
    for name in ("Spine2","Head","LeftArm","RightArm"):
        rig.pose.bones[name].keyframe_insert(data_path="rotation_euler",frame=frame,group=name)
# render setup
sc.frame_set(1)
world=bpy.data.worlds.new("Daylit neutral workshop");sc.world=world;world.use_nodes=True
world.node_tree.nodes["Background"].inputs["Color"].default_value=(.40,.47,.55,1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value=.75
def light(name,location,power):
    ld=bpy.data.lights.new(name,"AREA")
    ob=bpy.data.objects.new(name,ld);sc.collection.objects.link(ob)
    ob.location=location
    ob.rotation_euler=(Vector((0,0,.99))-ob.location).to_track_quat("-Z","Y").to_euler()
    ld.energy=power;ld.shape="DISK";ld.size=3.0
light("soft warm key",(2,-3,4),300)
light("soft cool fill",(-2,2.2,3),240)
cam_data=bpy.data.cameras.new("8 facing original sprite bake")
cam=bpy.data.objects.new("8 facing original sprite bake",cam_data);sc.collection.objects.link(cam);sc.camera=cam
cam_data.type="ORTHO";cam_data.ortho_scale=2.22
sc.render.engine="CYCLES";sc.cycles.device="CPU";sc.cycles.samples=2
sc.render.threads_mode="FIXED";sc.render.threads=4
sc.render.resolution_x=160;sc.render.resolution_y=160;sc.render.resolution_percentage=100
sc.render.film_transparent=True
sc.render.image_settings.file_format="PNG";sc.render.image_settings.color_mode="RGBA";sc.render.image_settings.color_depth="8"
sc.view_settings.view_transform="Standard"
sc.render.filepath=str(frames/"idle-preview.png")
# Keep first-party editable scene, rig and GLB with authored idle action.
blend=out/(a.body+".blend")
bpy.ops.wm.save_as_mainfile(filepath=str(blend))
glb=out/(a.body+".glb")
bpy.ops.export_scene.gltf(filepath=str(glb),export_format="GLB",export_animations=True,export_nla_strips=False)
assert blend.is_file() and glb.is_file()
count=0
for direction in range(8):
    azimuth=direction*pi/4
    position=Vector((3.5*math.sin(azimuth),-3.5*math.cos(azimuth),2.55))
    cam.location=position;cam.rotation_euler=(Vector((0,0,.95))-position).to_track_quat("-Z","Y").to_euler()
    for fi,frame in enumerate((1,5,9,13)):
        sc.frame_set(frame)
        filename=frames/("row%02d_frame%02d.png"%(direction,fi))
        sc.render.filepath=str(filename)
        bpy.ops.render.render(write_still=True)
        assert filename.stat().st_size>400,filename
        count+=1
        print("BODY_IDLE_FRAME",a.body,direction,fi,filename.stat().st_size,flush=True)
summary={"bodyPresentation":a.body,"sourceType":"original procedural Blender 4.5.14","meshVertices":len(body.data.vertices),
"rigBoneNames":[name for name,*_ in bones],"atlasDirections":8,"idleFramesPerDirection":4,
"directionOrder":["south","southwest","west","northwest","north","northeast","east","southeast"],
"sourceFrameSize":160,"modelBlend":blend.name,"modelGlb":glb.name,
"noClothingArmorOrWeapons":True,"productionReady":False,"authoritativeGameModified":False}
(out/(a.body+"-source-report.json")).write_text(json.dumps(summary,indent=2),encoding="utf-8")
print("ADULT_BODY_COMPLETE",json.dumps(summary),flush=True)

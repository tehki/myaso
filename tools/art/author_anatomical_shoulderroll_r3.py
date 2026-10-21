"""Graphics 3A R3 — MakeHuman CC0 anatomical adults and grounded shoulder-roll study.

Offline Blender 4.5.14 source generator. The MakeHuman base mesh and gender
morph graphical assets are CC0, not GPL/AGPL code. Does not import or ship any
MakeHuman executable code. The game runtime and Combat authority are untouched.
"""
import pathlib,sys,argparse,math,gzip,json
import bpy
from mathutils import Vector,Quaternion
from math import pi,sin,cos,radians
args=sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
parser=argparse.ArgumentParser()
parser.add_argument("--body",choices=("adult-masculine","adult-feminine"),required=True)
parser.add_argument("--mpfb",default="assets/characters/upstream-makehuman-r4")
parser.add_argument("--a1-source",default="assets/characters/adult-body-a1")
parser.add_argument("--out",default="assets/characters/adult-anatomy-r3")
parser.add_argument("--frames",default=".r3-frames")
parser.add_argument("--smoke",action="store_true")
opts=parser.parse_args(args)
data=pathlib.Path(opts.mpfb).resolve()
obj=data/"3dobjs/base.obj"
assert obj.is_file(),f"Missing CC0 model {obj}"
out=pathlib.Path(opts.out).resolve();out.mkdir(parents=True,exist_ok=True)
frames=pathlib.Path(opts.frames).resolve()/opts.body;frames.mkdir(parents=True,exist_ok=True)
female=opts.body=="adult-feminine"
raw=obj.read_text(encoding="utf8").splitlines()
verts=[];faces=[];group=None
for ln in raw:
    if ln.startswith("v "):
        verts.append([float(x) for x in ln.split()[1:4]])
    elif ln.startswith("g "):
        group=ln[2:].strip()
    elif group=="body" and ln.startswith("f "):
        faces.append([int(t.split("/")[0])-1 for t in ln.split()[1:]])
assert len(verts)>18000 and len(faces)>10000,(len(verts),len(faces))
gender="female" if female else "male"
weights=[("caucasian",1/3),("asian",1/3),("african",1/3)]
targets=[]
for pop,weight in weights:
    f=data/f"targets/macrodetails/{pop}-{gender}-young.target.gz"
    assert f.is_file(),f
    changes=0
    with gzip.open(f,"rt") as stream:
        for ln in stream:
            if not ln.strip() or ln.startswith("#"):continue
            idx,dx,dy,dz=ln.split()[:4]
            idx=int(idx)
            if idx>=len(verts):continue
            verts[idx][0]+=float(dx)*weight
            verts[idx][1]+=float(dy)*weight
            verts[idx][2]+=float(dz)*weight
            changes+=1
    targets.append({"name":f.name,"weight":weight,"entries":changes})
# Convert MakeHuman Y-up and +Z-front into myaso.io +Z-up, -Y-forward.
scale=1.82/(max(p[1] for p in verts)-min(p[1] for p in verts))
feet=min(v[1] for v in verts)
converted=[(p[0]*scale,-p[2]*scale,(p[1]-feet)*scale) for p in verts]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.scene.render.fps=60
source_a1=pathlib.Path(opts.a1_source).resolve()/(opts.body+"-locomotion-a1.glb")
bpy.ops.import_scene.gltf(filepath=str(source_a1))
rig=next(x for x in bpy.data.objects if x.type=="ARMATURE")
old_meshes=[o for o in bpy.data.objects if o.type=="MESH"]
for o in old_meshes:bpy.data.objects.remove(o,do_unlink=True)
mesh=bpy.data.meshes.new("CC0 MakeHuman adult anatomical body mesh")
mesh.from_pydata(converted,[],faces)
mesh.update()
body=bpy.data.objects.new(opts.body+" CC0 human anatomical mesh",mesh)
bpy.context.scene.collection.objects.link(body)
for poly in mesh.polygons:poly.use_smooth=True
skin=bpy.data.materials.new("CC0 anatomical human skin, original material")
skin.use_nodes=True
color=(.52,.340,.265,1) if female else (.43,.282,.214,1)
shader=skin.node_tree.nodes.get("Principled BSDF")
shader.inputs["Base Color"].default_value=color
shader.inputs["Roughness"].default_value=.82
noise=skin.node_tree.nodes.new("ShaderNodeTexNoise")
noise.inputs["Scale"].default_value=150
bump=skin.node_tree.nodes.new("ShaderNodeBump")
bump.inputs["Strength"].default_value=.09
bump.inputs["Distance"].default_value=.003
skin.node_tree.links.new(noise.outputs["Fac"],bump.inputs["Height"])
skin.node_tree.links.new(bump.outputs["Normal"],shader.inputs["Normal"])
skin.diffuse_color=color
body.data.materials.append(skin)
# Rig source compatibility: 22 original named adult bones; bind generated
# human skin with multiple smooth nearest-limb influences (review only).
bones=[(bone.name,Vector(bone.head_local),Vector(bone.tail_local))
       for bone in rig.data.bones]
assert len(bones)==22
groups={name:body.vertex_groups.new(name=name) for name,_,_ in bones}
for v in mesh.vertices:
    p=Vector(v.co)
    ranked=[]
    for name,start,end in bones:
        axis=end-start
        t=max(0,min(1,(p-start).dot(axis)/(axis.length_squared or 1)))
        dist=(p-(start+t*axis)).length
        ranked.append((dist,name))
    ranked.sort()
    best=ranked[:3]
    weights_=[1/(.025+d)**4 for d,_ in best]
    total=sum(weights_)
    for (dist,name),w in zip(best,weights_):
        if w/total>.002:groups[name].add([v.index],w/total,"REPLACE")
body.parent=rig
am=body.modifiers.new("CC0 body skinning to game biped","ARMATURE")
am.object=rig
acts={a.name:a for a in bpy.data.actions}
assert {"idle","walk","run"}<=set(acts)
for tr in rig.animation_data.nla_tracks:tr.mute=True
rig.animation_data.action=None
for pb in rig.pose.bones:pb.rotation_mode="QUATERNION"
def pose_rotation(name,axis,angle):
    pb=rig.pose.bones[name];q=pb.bone.matrix_local.to_quaternion()
    pb.rotation_quaternion=q.inverted()@Quaternion(axis,angle)@q
def neutral():
    for pb in rig.pose.bones:
        pb.location=(0,0,0)
        pb.rotation_quaternion=Quaternion((1,0,0,0))
roll=bpy.data.actions.new("roll_r3_shoulder_ground")
rig.animation_data.action=roll
rig.rotation_mode="XYZ"
# The old A2 rotated Hips 360 degrees at almost fixed belly position.
# This roll drives the whole armature *forward 1m*, braces asymmetrically
# over a shoulder, tucks knees and returns to feet, source action 350ms.
trajectory=[
 (1,0,0,0,0,0,0),
 (2,0,.025,.2,.40,.18,.02),
 (3,8,.08,.43,.7,.54,.07),
 (4,33,.17,.56,1.0,.89,.12),
 (5,62,.27,.60,1.2,1.1,.2),
 (7,124,.43,.53,1.3,1.3,.29),
 (9,205,.61,.44,1.3,1.2,.25),
 (11,269,.77,.3,1.13,.9,.16),
 (13,309,.86,.24,.82,.69,.1),
 (16,344,.94,.13,.62,.4,.06),
 (19,356,.98,.07,.24,.15,.01),
 (22,360,1.00,0,0,0,0),
]
rest_sample=[Vector(mesh.vertices[i].co)
  for i in range(0,len(mesh.vertices),max(1,len(mesh.vertices)//2500))]
records=[]
for frame,degrees,travel,spine,knee,brace,lateral in trajectory:
    neutral()
    rig.rotation_euler=(radians(degrees),radians(lateral*22),radians(lateral*9))
    rig.location=(0,-travel,0)
    pose_rotation("Spine",Vector((1,0,0)),spine*.55)
    pose_rotation("Spine1",Vector((1,0,0)),spine*.50)
    pose_rotation("Spine2",Vector((1,0,0)),spine*.25)
    pose_rotation("Head",Vector((1,0,0)),-spine*.85)
    for side in ("Left","Right"):
        pose_rotation(side+"UpLeg",Vector((1,0,0)),-knee*.63)
        pose_rotation(side+"Leg",Vector((1,0,0)),knee*.9)
        pose_rotation(side+"Foot",Vector((1,0,0)),-knee*.22)
        pose_rotation(side+"Arm",Vector((1,0,0)),brace*(.42 if side=="Left" else .70))
        pose_rotation(side+"ForeArm",Vector((1,0,0)),-brace*.7)
    rotate=rig.rotation_euler.to_matrix()
    # Fast proxy based on CC0 rest geometry; not a genuine contact solved
    # physics joint. Live Greyhaven ground contact remains an open QA gate.
    minz=min((rotate@v).z for v in rest_sample)
    rig.location.z=.030-minz
    for pb in rig.pose.bones:
        pb.keyframe_insert(data_path="rotation_quaternion",frame=frame,group=pb.name)
    rig.keyframe_insert(data_path="location",frame=frame,group="root translated")
    rig.keyframe_insert(data_path="rotation_euler",frame=frame,group="shoulder roll")
    records.append({"frame":frame,"rollDegrees":degrees,
      "forwardMeters":travel,"rootHeight":round(rig.location.z,4),
      "proxyFloorZ":.030})
for fc in roll.fcurves:
    for key in fc.keyframe_points:key.interpolation="BEZIER"
roll.use_fake_user=True
sc=bpy.context.scene;sc.frame_start=1;sc.frame_end=22
blend=out/(opts.body+"-anatomical-shoulderroll-r3.blend")
bpy.ops.wm.save_as_mainfile(filepath=str(blend))
glb=out/(opts.body+"-anatomical-shoulderroll-r3.glb")
bpy.ops.export_scene.gltf(filepath=str(glb),export_format="GLB",
    export_animations=True,export_nla_strips=False,export_animation_mode="ACTIONS")
assert blend.is_file() and glb.is_file()
world=bpy.data.worlds.new("R3 daylight");sc.world=world;world.use_nodes=True
world.node_tree.nodes["Background"].inputs["Color"].default_value=(.48,.5,.51,1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value=.75
def lamp(name,location,power):
    d=bpy.data.lights.new(name,"AREA");o=bpy.data.objects.new(name,d)
    sc.collection.objects.link(o);o.location=location
    o.rotation_euler=(Vector((0,-.5,.96))-o.location).to_track_quat("-Z","Y").to_euler()
    d.energy=power;d.size=3
lamp("R3 warm key",(2,-3,4),280)
lamp("R3 cool fill",(-2,2.2,3),220)
camdata=bpy.data.cameras.new("R3 eight-way camera")
cam=bpy.data.objects.new("R3 eight-way camera",camdata)
sc.collection.objects.link(cam);sc.camera=cam
camdata.type="ORTHO";camdata.ortho_scale=2.22
sc.render.engine="CYCLES";sc.cycles.device="CPU";sc.cycles.samples=2
sc.render.threads_mode="FIXED";sc.render.threads=4
sc.render.resolution_x=160;sc.render.resolution_y=160;sc.render.resolution_percentage=100
sc.render.film_transparent=True
sc.render.image_settings.file_format="PNG";sc.render.image_settings.color_mode="RGBA"
sc.view_settings.view_transform="Standard"
clips={"idle":(1,5,9,13),"walk":(1,5,9,13),
       "run":(1,5,9,13),"roll":(1,3,5,7,9,11,15,22)}
rendered={}
for clip,samples in clips.items():
    act=roll if clip=="roll" else acts[clip]
    rig.animation_data.action=act
    if act.slots:rig.animation_data.action_slot=act.slots[0]
    if clip!="roll":rig.rotation_euler=(0,0,0);rig.location=(0,0,0)
    count=0
    for direction in range(8):
        if opts.smoke and direction not in (0,2):continue
        t=direction*pi/4
        target=Vector((0,-.5 if clip=="roll" else 0,.92))
        eye=target+Vector((3.5*sin(t),-3.5*cos(t),1.6))
        cam.location=eye
        cam.rotation_euler=(target-eye).to_track_quat("-Z","Y").to_euler()
        for index,f in enumerate(samples):
            if opts.smoke and index not in ([0,2,4,6,7] if clip=="roll" else [0,2]):continue
            sc.frame_set(f)
            if clip!="roll":rig.rotation_euler=(0,0,0);rig.location=(0,0,0)
            path=frames/f"{clip}_row{direction:02d}_frame{index:02d}.png"
            sc.render.filepath=str(path);bpy.ops.render.render(write_still=True)
            assert path.is_file() and path.stat().st_size>300,path
            count+=1
            print("R3_FRAME",opts.body,clip,direction,index,path.stat().st_size,flush=True)
    rendered[clip]=count
report={"bodyPresentation":opts.body,
  "geometrySource":"MakeHuman Community official core basemesh and bundled CC0 morphs",
  "sourceLicense":"CC0-1.0",
  "sourceRepo":"https://github.com/makehumancommunity/mpfb2",
  "sourceBaseFile":"src/mpfb/data/3dobjs/base.obj",
  "morphTargets":targets,"sourceVertices":len(mesh.vertices),
  "bodyFaces":len(mesh.polygons),"sourceBoneCount":len(rig.data.bones),
  "actions":["idle","walk","run","roll_r3_shoulder_ground"],
  "rootTrajectory":records,"forwardTravelMeters":1,
  "rollSourceMs":350,"dodgeActiveMs":170,"recoveryMs":180,
  "groundProxyOnly":True,"trueGroundContactVerified":False,
  "productionActive":False,"humanVisualApproved":False,
  "smoke":opts.smoke,"renderedFrames":rendered}
(out/(opts.body+"-anatomical-shoulderroll-r3.json")).write_text(
    json.dumps(report,indent=2),encoding="utf8")
print("R3_ANATOMICAL_DONE",json.dumps({
 "body":opts.body,"vertices":len(mesh.vertices),"faces":len(mesh.polygons),
 "frames":rendered}),flush=True)

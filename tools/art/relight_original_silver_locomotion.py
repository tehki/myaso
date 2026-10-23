"""Graphics 3A: authentic owner Silver Knight locomotion relight in Blender 5.2.
DRAFT art review only. Reuse already accepted Roll Cycles studio lighting.
Original owner mesh is loaded locally; never copy or redistribute its GLB.
"""
import argparse
import hashlib
import json
import math
import sys
from pathlib import Path
import bpy
from mathutils import Vector

CLIPS={"idle":4,"walk":8,"sprint":8,"jump":6}
ORIGINAL_ACTION={"idle":"idle","walk":"walk_loop","sprint":"sprint_loop","jump":"jump_loop"}
SOURCE_SHA="d679fccd00df868d600b4c5e2fcf8a4a46cc062dbd432be5b6a7f533eb30141f"
argv=sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
p=argparse.ArgumentParser()
p.add_argument("--source",required=True)
p.add_argument("--output",required=True)
p.add_argument("--samples",type=int,default=3)
p.add_argument("--ortho-scale",type=float,default=1.66,help="Original Roll studio camera framing; use 1.29 for legacy-matched apparent size")
p.add_argument("--smoke",action="store_true")
p.add_argument("--inspect",action="store_true")
p.add_argument("--action",choices=["all",*CLIPS],default="all")
args=p.parse_args(argv)
source=Path(args.source).resolve()
actual_sha=hashlib.sha256(source.read_bytes()).hexdigest()
assert actual_sha==SOURCE_SHA,("Unexpected model; refusing to relight",actual_sha)
out=Path(args.output).resolve()
out.mkdir(parents=True,exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
sc=bpy.context.scene
sc.render.fps=60
bpy.ops.import_scene.gltf(filepath=str(source))
rig=next(o for o in bpy.data.objects if o.type=="ARMATURE")
assert len(rig.data.bones)==22
print("GRAPHICS3A_OWNER_SOURCE",actual_sha,"bones",len(rig.data.bones),flush=True)
for a in bpy.data.actions:
    print("ORIGINAL_ACTION",a.name,"range",tuple(a.frame_range),"slots",len(a.slots),flush=True)
if args.inspect:sys.exit(0)
for clip in CLIPS:
    assert bpy.data.actions.get(ORIGINAL_ACTION[clip]),f"Missing real owner action {clip} ({ORIGINAL_ACTION[clip]})"

# Exactly the first-party Silver Roll source studio, not pixel retouching.
for o in bpy.data.objects:
    if o.type=="MESH" and not any(m.type=="ARMATURE" for m in o.modifiers):
        o.hide_render=True
sc.render.engine="CYCLES"
sc.cycles.device="CPU"
sc.cycles.samples=args.samples
sc.render.threads_mode="FIXED"
sc.render.threads=8
sc.render.film_transparent=True
sc.render.resolution_x=160
sc.render.resolution_y=160
sc.render.resolution_percentage=100
sc.render.image_settings.file_format="PNG"
sc.render.image_settings.color_mode="RGBA"
sc.render.image_settings.color_depth="8"
sc.render.image_settings.compression=15
sc.view_settings.view_transform="Standard"
sc.view_settings.look="Medium High Contrast"
world=sc.world or bpy.data.worlds.new("Knight studio")
sc.world=world
world.use_nodes=True
world.node_tree.nodes.get("Background").inputs["Color"].default_value=(.45,.5,.57,1)
world.node_tree.nodes.get("Background").inputs["Strength"].default_value=.65
def lamp(name,position,power,color):
    light=bpy.data.lights.new(name,"AREA")
    obj=bpy.data.objects.new(name,light)
    sc.collection.objects.link(obj)
    obj.location=position
    obj.rotation_euler=(Vector((0,0,-.08))-obj.location).to_track_quat("-Z","Y").to_euler()
    light.energy=power
    light.color=color
    light.shape="DISK"
    light.size=3.6
lamp("Original Roll key",(1.4,-1.7,3.3),210,(1,.90,.78))
lamp("Original Roll fill",(-1.4,1.1,2.7),180,(.73,.82,1))
camera_data=bpy.data.cameras.new("Original Roll eight directions")
camera=bpy.data.objects.new("Original Roll eight directions",camera_data)
sc.collection.objects.link(camera)
sc.camera=camera
camera_data.type="ORTHO"
assert 1.2<=args.ortho_scale<=1.9, "Review-only approved camera framing bounds"
camera_data.ortho_scale=args.ortho_scale
focus=Vector((0,0,-.07))
manifest={"sourceSHA256":actual_sha,"originalRigBones":22,
          "lighting":"SOURCE Blender Cycles, exact original Silver Roll key/fill/world",
          "rows":8,"frameSize":160,"actions":{},"authoritativeGameplayChanged":False,
          "sourceAssetChanged":False,"originalMeshRedistributed":False,"cameraOrthoScale":args.ortho_scale}
count=0
for action_name,frames in CLIPS.items():
    if args.action not in ("all",action_name):continue
    action=bpy.data.actions[ORIGINAL_ACTION[action_name]]
    rig.animation_data.action=action
    assert len(action.slots)>=1
    rig.animation_data.action_slot=action.slots[0]
    for track in rig.animation_data.nla_tracks:track.mute=True
    start,end=action.frame_range
    # Cyclic clips sample the source interval without duplicate last->first;
    # noncyclic jump includes its source landing endpoint.
    if action_name=="jump":
        times=[float(start)+(float(end)-float(start))*i/(frames-1) for i in range(frames)]
    else:
        times=[float(start)+(float(end)-float(start))*i/frames for i in range(frames)]
    manifest["actions"][action_name]={"frames":frames,"sourceFrameRange":[float(start),float(end)],"sampleTimes":times}
    folder=out/action_name
    folder.mkdir(parents=True,exist_ok=True)
    for direction in range(8):
        if args.smoke and direction not in (0,2,6):continue
        angle=2*math.pi*direction/8
        camera.location=(3.25*math.sin(angle),-3.25*math.cos(angle),2.65)
        camera.rotation_euler=(focus-Vector(camera.location)).to_track_quat("-Z","Y").to_euler()
        for frame_index,time in enumerate(times):
            if args.smoke and frame_index not in (0,frames//2):continue
            sc.frame_set(math.floor(time),subframe=time-math.floor(time))
            file=folder/f"row{direction:02d}_frame{frame_index:02d}.png"
            sc.render.filepath=str(file)
            bpy.ops.render.render(write_still=True)
            assert file.stat().st_size>1024,file
            count+=1
            print("ORIGINAL_STUDIO_FRAME",action_name,direction,frame_index,round(time,3),file.stat().st_size,flush=True)
print("ORIGINAL_LOCOMOTION_RELIGHT_COMPLETED",count,"smoke",args.smoke,flush=True)
(out/"manifest.source.json").write_text(json.dumps(manifest,indent=2)+"\n",encoding="utf8")

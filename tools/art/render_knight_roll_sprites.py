"""Reproducible CPU-only Blender 4.5 bake of an A3 GLB's roll action.
Usage: blender -b --python tools/art/render_knight_roll_sprites.py -- --source PATH --output-dir DIR [--smoke]
Render 8 directions x 8 phases. Model source is locally supplied, not committed.
"""
import argparse
import math
import sys
from pathlib import Path
import bpy
from mathutils import Vector

def run():
    argv=sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
    p=argparse.ArgumentParser()
    p.add_argument("--source",required=True)
    p.add_argument("--output-dir",required=True)
    p.add_argument("--smoke",action="store_true")
    p.add_argument("--samples",type=int,default=3)
    p.add_argument("--height-offset",type=float,default=0.0)
    args=p.parse_args(argv)
    source=Path(args.source)
    output=Path(args.output_dir)
    assert source.is_file(),source
    output.mkdir(parents=True,exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps=60
    # glTF importer maps seconds to frames using FPS configured *here*.
    bpy.ops.import_scene.gltf(filepath=str(source))
    rig=next(o for o in bpy.data.objects if o.type=="ARMATURE")
    assert len(rig.data.bones)==22
    action=bpy.data.actions["roll"]
    rig.animation_data.action=action
    rig.animation_data.action_slot=action.slots[0]
    for track in rig.animation_data.nla_tracks:track.mute=True
    for o in bpy.data.objects:
        if o.type=="MESH" and not any(m.type=="ARMATURE" for m in o.modifiers):
            o.hide_render=True
    sc=bpy.context.scene
    sc.render.engine="CYCLES"
    sc.cycles.device="CPU"
    sc.cycles.samples=args.samples
    sc.render.threads_mode="FIXED"
    sc.render.threads=2
    sc.render.film_transparent=True
    sc.render.resolution_x=160
    sc.render.resolution_y=160
    sc.render.resolution_percentage=100
    sc.render.image_settings.file_format="PNG"
    sc.render.image_settings.color_mode="RGBA"
    sc.render.image_settings.color_depth="8"
    sc.render.image_settings.compression=15
    sc.render.fps=60
    sc.view_settings.view_transform="Standard"
    sc.view_settings.look="Medium High Contrast"
    world=sc.world or bpy.data.worlds.new("Knight studio")
    sc.world=world
    world.use_nodes=True
    bg=world.node_tree.nodes.get("Background")
    bg.inputs["Color"].default_value=(.45,.5,.57,1)
    bg.inputs["Strength"].default_value=.65
    def lamp(name,location,power,color):
        l=bpy.data.lights.new(name,"AREA")
        ob=bpy.data.objects.new(name,l)
        sc.collection.objects.link(ob)
        ob.location=location
        ob.rotation_euler=(Vector((0,0,-.08))-ob.location).to_track_quat("-Z","Y").to_euler()
        l.energy=power
        l.color=color
        l.shape="DISK"
        l.size=3.6
    lamp("key",(1.4,-1.7,3.3),210,(1,.90,.78))
    lamp("fill",(-1.4,1.1,2.7),180,(.73,.82,1))
    camera_data=bpy.data.cameras.new("Eight facing directions")
    camera=bpy.data.objects.new("Eight facing directions",camera_data)
    sc.collection.objects.link(camera)
    sc.camera=camera
    camera_data.type="ORTHO"
    camera_data.ortho_scale=1.66
    focus=Vector((0,0,-.07+args.height_offset))
    sample_frames=(1,3,5,7,9,11,15,22)
    count=0
    for direction in range(8):
        if args.smoke and direction not in (0,3):continue
        a=2*math.pi*direction/8
        camera.location=(3.25*math.sin(a),-3.25*math.cos(a),2.65+args.height_offset)
        camera.rotation_euler=(focus-Vector(camera.location)).to_track_quat("-Z","Y").to_euler()
        for col,frame in enumerate(sample_frames):
            if args.smoke and col not in (0,4):continue
            sc.frame_set(frame)
            target=output/f"row{direction:02d}_frame{col:02d}.png"
            sc.render.filepath=str(target)
            bpy.ops.render.render(write_still=True)
            assert target.stat().st_size>1024,target
            count+=1
            print(f"SPRITE_DONE {direction} {col} {frame} {target.stat().st_size}",flush=True)
    print(f"BAKE_FINISHED {count} {output}",flush=True)

if __name__=="__main__":run()

#!/usr/bin/env python3
"""Blood & Iron A2.6: independent 3/4 architectural roof and wall sprite masters.

Art-review only. Intentionally keeps the visually approved Blender 3/4
camera rotation; DOES NOT claim game XY projection compatibility. Sprite is
visually anchored at its door ground point. Original A2.2 scene, portal/collision,
combat, A3 animations and browser client are not changed or saved.
"""
import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector

argv=sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
p=argparse.ArgumentParser()
p.add_argument("--scene",type=Path,required=True)
p.add_argument("--out-dir",type=Path,required=True)
p.add_argument("--samples",type=int,default=4)
p.add_argument("--canvas",type=int,default=640)
p.add_argument("--only",choices=("red_lion","gable_merchant","blacksmith"),default=None)
args=p.parse_args(argv)
assert args.scene.is_file()
assert args.canvas in (512,640,768)
args.out_dir.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(args.scene.resolve()))
scene=bpy.context.scene
scene.render.engine="CYCLES"
scene.cycles.device="CPU"
scene.cycles.samples=max(4,min(args.samples,16))
scene.render.film_transparent=True
scene.render.image_settings.file_format="PNG"
scene.render.image_settings.color_mode="RGBA"
scene.render.image_settings.color_depth="8"
scene.render.resolution_x=scene.render.resolution_y=args.canvas
scene.render.resolution_percentage=100

old_camera=bpy.data.objects.get("A2 / Red Lion hero / 3-4 angle")
assert old_camera and old_camera.type=="CAMERA"
assert old_camera.data.type=="ORTHO"
rotation=old_camera.rotation_euler.copy()
scale=old_camera.data.ortho_scale

bpy.ops.object.camera_add(location=Vector((0,0,0)))
camera=bpy.context.object
camera.name="A2.6 / fixed 3-4 sprite review camera"
camera.data.type="ORTHO"
camera.data.ortho_scale=scale
camera.rotation_euler=rotation
scene.camera=camera

BUILDINGS=(
    ("red_lion","Red Lion","Red Lion / door_front"),
    ("gable_merchant","Gable Merchant","Gable Merchant / oak door"),
    ("blacksmith","Blacksmith","Blacksmith / oak door"),
)
ORIGINAL={o.name:o.hide_render for o in scene.objects if o.type=="MESH"}
BARRELS={o.name:tuple(round(v,6) for v in o.location)
         for o in scene.objects if o.name.startswith("Oak ale barrel /")}
assert len(BARRELS)==7

# A2.7.1 visually relocate ONLY the authored forge prop pair. Existing
# previously committed A2.2 Blender source remains unchanged and recoverable.
# This accepts either the historical source .blend or a future Blender scene
# built from the corrected A2 generator, so rebuilds are idempotent.
workyard_source={
    "Blacksmith / open forge hearth":(13.3,6.95,.62),
    "Blacksmith / orange embers":(13.3,6.48,.92),
}
workyard_target={
    "Blacksmith / open forge hearth":(9.3,6.05,.62),
    "Blacksmith / orange embers":(9.3,5.70,.92),
}
workyard_previous={}
for name,target in workyard_target.items():
    obj=bpy.data.objects.get(name)
    assert obj is not None and obj.type=="MESH",name
    pos=tuple(round(x,3) for x in obj.location)
    workyard_previous[name]=list(pos)
    assert pos in (workyard_source[name],target), (
        name+" has unreviewed prior art coordinates "+str(pos))
    obj.location=target
bpy.context.view_layer.update()

def xy_bounds(ob):
    pts=[ob.matrix_world @ Vector(v) for v in ob.bound_box]
    return (min(p.x for p in pts),min(p.y for p in pts),
            max(p.x for p in pts),max(p.y for p in pts))

forge=xy_bounds(bpy.data.objects["Blacksmith / open forge hearth"])
anvil=xy_bounds(bpy.data.objects["Blacksmith / anvil"])
door=xy_bounds(bpy.data.objects["Blacksmith / oak door"])
step=xy_bounds(bpy.data.objects["Blacksmith / doorstep"])
forge_anvil_gap=anvil[0]-forge[2]
# The door approach corridor is centered on the real door opening at x=12.6,
# 1.90m wide and extends from the workyard up past the entry step.
entrance_lane=(11.65,5.65,13.55,7.6)
def intersects(a,b):
    return a[0]<b[2] and a[2]>b[0] and a[1]<b[3] and a[3]>b[1]
assert .25<=forge_anvil_gap<=.5,forge_anvil_gap
assert not intersects(forge,entrance_lane),"Forge obstructs Blacksmith entrance corridor"
assert not intersects(anvil,entrance_lane),"Anvil obstructs Blacksmith entrance corridor"
assert not intersects(forge,door) and not intersects(forge,step)
assert not intersects(anvil,door) and not intersects(anvil,step)
assert tuple(round(x,3) for x in bpy.data.objects["Blacksmith / anvil"].location)==(10.7,6.4,.92)
workyard_qa={
    "correctedForgeCenterXYZ":[9.3,6.05,.62],
    "correctedEmbersCenterXYZ":[9.3,5.7,.92],
    "originalForgeCenterXYZ":workyard_previous["Blacksmith / open forge hearth"],
    "forgeToAnvilHorizontalClearanceMeters":round(forge_anvil_gap,3),
    "forgingPropsInEntranceCorridor":False,
    "entranceCorridorXYBounds":[*entrance_lane],
    "doorAndStepUnmodified":True,
    "gameCollisionModified":False,
    "originalBlenderSceneSaved":False,
}

def member(ob,name):
    return ob.type=="MESH" and (ob.name.startswith(name+" /") or
                                ob.name.startswith(name+" A2."))

def roof(ob,name):
    if not member(ob,name):return False
    label=ob.name
    if name=="Red Lion":
        return label.startswith("Red Lion / roof_") or label.startswith(
            "Red Lion A2.1 / batched individually coloured clay roof tiles") or (
            label.startswith("Red Lion / chimney"))
    return (label==name+" / roof occlusion"
        or label.startswith(name+" / laid roof courses")
        or (label.startswith(name+" A2.2 / batched ") and label.endswith(" roof"))
        or label.startswith(name+" / chimney"))

def camera_pixel(v):
    uv=world_to_camera_view(scene,camera,v)
    return (uv.x*args.canvas,(1-uv.y)*args.canvas)

report={
  "milestone":"Blood & Iron A2.6 separate 3-4 building billboard masters",
  "scene":args.scene.name,"canvas":[args.canvas,args.canvas],
  "renderEngine":"Cycles CPU","samples":scene.cycles.samples,
  "visualCameraSource":old_camera.name,
  "visualCameraScale":scale,
  "cameraRotationEulerRad":[round(v,6) for v in rotation],
  "gameXYProjectionMatched":False,
  "sourceSceneModified":False,
  "gameplayChanged":False,
  "A3RollChanged":False,
  "productionApproved":False,
  "drawInBrowserApproved":False,
  "blacksmithWorkyard":workyard_qa,
  "buildings":{}
}
if args.only:
    previous=args.out_dir/"greyhaven_a26_render_report.json"
    assert previous.is_file(), "Partial render requires existing complete baseline report"
    previous_report=json.loads(previous.read_text(encoding="utf8"))
    assert set(previous_report["buildings"])=={"red_lion","gable_merchant","blacksmith"}
    assert previous_report["scene"]==args.scene.name
    assert previous_report["canvas"]==[args.canvas,args.canvas]
    report["buildings"]=previous_report["buildings"]
for slug,name,door_name in BUILDINGS:
    if args.only and slug!=args.only:
        continue
    door=bpy.data.objects.get(door_name)
    assert door is not None and door.type=="MESH",door_name
    corners=[door.matrix_world @ Vector(v) for v in door.bound_box]
    anchor=Vector((
       (min(v.x for v in corners)+max(v.x for v in corners))/2,
       (min(v.y for v in corners)+max(v.y for v in corners))/2,
       0))
    # At a fixed 3/4 camera orientation, point the optical axis at the
    # visual door-ground pivot for each building, NOT world-authoritative XY.
    # Blacksmith was deliberately rotated 180 degrees to face the street
    # in the fixed authored world; from the original shared art camera its
    # blank REAR facade was visible. Face its actual front for an isolated
    # visual billboard without rotating the building or changing game XY.
    facade_turn=math.pi if slug=="blacksmith" else 0.0
    from mathutils import Quaternion
    face_rotation=Quaternion((0,0,1),facade_turn) @ rotation.to_quaternion()
    camera.rotation_euler=face_rotation.to_euler()
    camera.location=anchor+face_rotation@Vector((0,0,40))
    bpy.context.view_layer.update()
    origin=camera_pixel(anchor)
    assert abs(origin[0]-args.canvas/2)<.01
    assert abs(origin[1]-args.canvas/2)<.01
    x=camera_pixel(anchor+Vector((1,0,0)))
    y=camera_pixel(anchor+Vector((0,1,0)))
    xv=(x[0]-origin[0],x[1]-origin[1])
    yv=(y[0]-origin[0],y[1]-origin[1])
    mismatches=[
        math.hypot(xv[0]-33.6,xv[1]),
        math.hypot(yv[0],yv[1]-33.6)
    ]
    # Enforce this is NOT quietly labelled as a game-XY matched output.
    assert max(mismatches)>10
    grouped=[o.name for o in scene.objects if member(o,name)]
    assert len(grouped)>=12,(name,len(grouped))
    results={}
    for layer in ("base","roof","whole"):
        for ob in scene.objects:
            if ob.type!="MESH":continue
            visible=(member(ob,name) and (layer=="whole" or
                     roof(ob,name)==(layer=="roof")))
            ob.hide_render=ORIGINAL[ob.name] or not visible
        included=[o.name for o in scene.objects if
                  o.type=="MESH" and not o.hide_render]
        assert included
        assert all(member(scene.objects[n],name) for n in included)
        if layer!="whole":
            assert all(roof(scene.objects[n],name)==(layer=="roof")
                       for n in included)
        output=args.out_dir/(slug+"_a26_"+layer+"_master.png")
        scene.render.filepath=str(output)
        bpy.ops.render.render(write_still=True)
        assert output.is_file() and output.stat().st_size>1000
        results[layer]={"master":output.name,"pngBytes":output.stat().st_size,
                        "renderVisibleMeshes":len(included)}
    report["buildings"][slug]={
      "sourceObjectPrefix":name,
      "visualDoorGroundAnchorMeters":[round(v,5) for v in anchor],
      "anchorPixels":[round(v,5) for v in origin],
      "blenderGroundBasisX":[round(v,5) for v in xv],
      "blenderGroundBasisY":[round(v,5) for v in yv],
      "facadeRelativeCameraTurnDegrees":round(math.degrees(facade_turn),3),
      "actualCameraEulerRad":[round(v,6) for v in camera.rotation_euler],
      "maxXYGameProjectionMismatchPixelsPerMeter":round(max(mismatches),3),
      "runtimeDoorOrPivotValidated":False,
      "layers":results,
    }
for ob in scene.objects:
    if ob.type=="MESH":ob.hide_render=ORIGINAL[ob.name]
assert all(scene.objects[n].hide_render==flag for n,flag in ORIGINAL.items())
assert all(tuple(round(v,6) for v in scene.objects[n].location)==loc
           for n,loc in BARRELS.items())
(args.out_dir/"greyhaven_a26_render_report.json").write_text(
    json.dumps(report,sort_keys=True,indent=2)+"\n",encoding="utf8")
print("A26_REPORT="+json.dumps(report,sort_keys=True))

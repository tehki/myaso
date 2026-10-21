"""A2.10 offline Blender door bounds: same A2.6 Red Lion review camera."""
import bpy,json,sys
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
from pathlib import Path
argv=sys.argv[sys.argv.index("--")+1:]
scene_path,output=map(Path,argv)
bpy.ops.wm.open_mainfile(filepath=str(scene_path.resolve()))
s=bpy.context.scene
reference=bpy.data.objects["A2 / Red Lion hero / 3-4 angle"]
door=bpy.data.objects["Red Lion / door_front"]
corners=[door.matrix_world@Vector(p) for p in door.bound_box]
a=Vector(((min(p.x for p in corners)+max(p.x for p in corners))/2,
 (min(p.y for p in corners)+max(p.y for p in corners))/2,0))
bpy.ops.object.camera_add()
cam=bpy.context.object
cam.data.type="ORTHO"
cam.data.ortho_scale=reference.data.ortho_scale
cam.rotation_euler=reference.rotation_euler.copy()
cam.location=a+cam.rotation_euler.to_quaternion()@Vector((0,0,40))
s.camera=cam
s.render.resolution_x=s.render.resolution_y=640
s.render.resolution_percentage=100
bpy.context.view_layer.update()
def px(v):
 q=world_to_camera_view(s,cam,v)
 return q.x*640,(1-q.y)*640
points=[px(v) for v in corners]
left=min(v[0] for v in points);right=max(v[0] for v in points)
top=min(v[1] for v in points);bottom=max(v[1] for v in points)
zheight=max(v.z for v in corners)-min(v.z for v in corners)
height=bottom-top
assert 20<height<230 and 1.5<zheight<3.2
assert max(abs(t-320) for t in px(a))<.01
report=dict(milestone="Blood & Iron A2.10 visual door measurement",
sourceScene=scene_path.name,doorObject=door.name,cameraSource=reference.name,
canvas=[640,640],projectedDoorBoundsPx=[round(t,3) for t in [left,top,right,bottom]],
projectedDoorBoundingHeightPx=round(height,3),authoredDoorHeightMeters=round(zheight,4),
doorGroundPixel=[round(v,3) for v in px(a)],
cinematicThreeQuarterOnly=True,gameXYMatched=False,
productionSpriteScaleApproved=False,gameplayModified=False,
anatomicalFootPivotValidated=False,sourceBlendModified=False)
output.parent.mkdir(parents=True,exist_ok=True)
output.write_text(json.dumps(report,indent=2,sort_keys=True)+"\n",encoding="utf8")
print("A210_DOOR="+json.dumps(report))

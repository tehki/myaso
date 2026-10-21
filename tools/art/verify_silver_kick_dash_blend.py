"""Graphics 3A: independently reload edited action-only Blender source.
Requires Blender 4.5, not part of generic GitHub Node CI.
"""
import bpy,sys,json
from pathlib import Path
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
source=Path(sys.argv[-1]).resolve()
assert source.is_file()
bpy.ops.wm.open_mainfile(filepath=str(source))
arms=[o for o in bpy.data.objects if o.type=="ARMATURE"]
meshes=[o for o in bpy.data.objects if o.type=="MESH"]
assert len(arms)==1 and len(arms[0].data.bones)==22
assert not meshes,"Action-only source must not redistribute original owner mesh"
rig=arms[0]
actions={a.name:a for a in bpy.data.actions if a.name.startswith("Graphics3A_P0_Silver_")}
assert sorted(actions)==["Graphics3A_P0_Silver_Dash_140ms","Graphics3A_P0_Silver_Kick_380ms"]
results={}
for name,act in actions.items():
 assert len(act.slots)==1,(name,len(act.slots))
 rig.animation_data.action=act
 rig.animation_data.action_slot=act.slots[0]
 first,last=act.frame_range
 bpy.context.scene.frame_set(round(first))
 start=[rig.pose.bones[n].rotation_quaternion.copy() for n in ["mixamorig:RightUpLeg","mixamorig:Spine"]]
 bpy.context.scene.frame_set(round((first+last)/2))
 mid=[rig.pose.bones[n].rotation_quaternion.copy() for n in ["mixamorig:RightUpLeg","mixamorig:Spine"]]
 deltas=[(q1.rotation_difference(q2)).angle for q1,q2 in zip(start,mid)]
 assert max(deltas)>.12,("Static source action",name,deltas)
 results[name]={"startFrame":round(first,3),"endFrame":round(last,3),
    "slotCount":len(act.slots),"poseDifferenceRadians":[round(x,4) for x in deltas]}
print("EDITABLE_ACTION_SOURCE_PASS",json.dumps({"rigBones":22,"ownerSourceMeshBundled":False,"actions":results}),flush=True)

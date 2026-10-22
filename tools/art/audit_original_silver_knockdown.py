"""Independently reopen saved editable original Silver knockdown action-only .blend."""
import bpy,sys,json,hashlib,math
from pathlib import Path
args=sys.argv[sys.argv.index("--")+1:]
source=Path(args[0]).resolve();output=Path(args[1]).resolve()
assert source.is_file()
arm=next(x for x in bpy.data.objects if x.type=="ARMATURE")
assert len(arm.pose.bones)==22
assert not any(x.type=="MESH" for x in bpy.data.objects),"No original owner Silver mesh may be shipped"
action=bpy.data.actions.get("Graphics3A_Silver_Victim_Knockdown_360ms")
assert action and action.slots
assert abs(float(action.frame_range[0])-1)<.001
assert abs(float(action.frame_range[1])-22.6)<.001
arm.animation_data.action=action;arm.animation_data.action_slot=action.slots[0]
scene=bpy.context.scene
sourceRoot=arm.matrix_world.copy()
def at(fr):
 scene.frame_set(int(fr),subframe=fr-int(fr))
 bpy.context.view_layer.update()
 b=arm.pose.bones
 def point(name):
  return arm.matrix_world @ b["mixamorig:"+name].head
 return {"headZ":point("Head").z,"leftToeZ":point("LeftToeBase").z,
  "rightToeZ":point("RightToeBase").z,"spineZ":point("Spine").z}
neutral=at(1)
down=at(10.6)
exit=at(22.6)
head_drop=neutral["headZ"]-down["headZ"]
assert .12 < head_drop < 1.0,head_drop
assert abs(exit["headZ"]-neutral["headZ"])<.006
assert max(abs(arm.matrix_world[i][j]-sourceRoot[i][j]) for i in range(4) for j in range(4))<1e-8
report={
 "sourceBlendSha256":hashlib.sha256(source.read_bytes()).hexdigest(),
 "originalArmatureBones":22,"originalOwnerMeshBundled":False,
 "actionName":action.name,"actionFrameRange":[float(x) for x in action.frame_range],
 "actionNominalDurationMs":360,
 "headWorldZDropSourceUnits":round(head_drop,6),
 "neutralReference":neutral,"collapseReference":down,"recoveryReference":exit,
 "actorRootWorldTransformUnchanged":True,
 "realTerrainSoleContactTested":False,
 "clientServerKnockdownSyncTested":False,"gameplayIntegrated":False,
 "humanVisualApproved":False
}
output.write_text(json.dumps(report,indent=2)+"\n")
print("ORIGINAL_SILVER_KNOCKDOWN_INDEPENDENT_REOPEN_AUDIT",json.dumps(report),flush=True)

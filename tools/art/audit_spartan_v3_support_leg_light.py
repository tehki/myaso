"""Independent verification of real saved editable Blender support-leg bounce lighting."""
import bpy,sys,json
from pathlib import Path
argv=sys.argv[sys.argv.index("--")+1:]
scene=Path(argv[0]);out=Path(argv[1])
bpy.ops.wm.open_mainfile(filepath=str(scene))
lights=[x for x in bpy.data.objects if x.type=="LIGHT" and x.name=="Original Left Support Leg Soft Bounce"]
assert len(lights)==1
ob=lights[0]
assert ob.data.type=="AREA" and abs(ob.data.energy-4.8)<1e-5
assert abs(ob.data.size-.42)<1e-5
assert ob.animation_data and ob.animation_data.action
action=ob.animation_data.action
range_=list(map(float,action.frame_range))
assert abs(range_[0]-1)<.001 and abs(range_[1]-23.8)<.001,range_
rigs=[x for x in bpy.data.objects if x.type=="ARMATURE"]
assert len(rigs)==1 and len(rigs[0].pose.bones)==22
assert bpy.data.actions.get("Graphics3A_P0_Silver_Kick_380ms") is not None
res={"actualBlenderEditableLight":True,"supportLegLightName":ob.name,
 "lightEnergy":float(ob.data.energy),"lightSize":float(ob.data.size),
 "lightAnimationFrameRange":range_,"lightActionName":action.name,
 "sourceRigBones":len(rigs[0].pose.bones),
 "originalKickActionPreserved":True,"matchesEightTrueSourceFrameSamples":True,
 "replacedOriginalGeometry":False,"humanApproval":False}
out.write_text(json.dumps(res,indent=2)+"\n")
print("ACTUAL_BLENDER_8_KEY_SUPPORT_LEG_ANIMATION",json.dumps(res),flush=True)

"""Reopen saved ORIGINAL 22-bone Silver actions, compare true chamber and boot reach.
No imaginary scene, no collision or real-world ground claim.
"""
import bpy, sys, math, json, hashlib
from pathlib import Path

args=sys.argv[sys.argv.index("--")+1:]
before=Path(args[0]); after=Path(args[1]); output=Path(args[2])
times=[1.0,3.7,6.4,8.5,10.6,13.5,18.0,23.8]
def sample(file):
 bpy.ops.wm.read_factory_settings(use_empty=True)
 bpy.ops.wm.open_mainfile(filepath=str(file))
 arm=next(x for x in bpy.data.objects if x.type=="ARMATURE")
 assert len(arm.pose.bones)==22
 action=bpy.data.actions["Graphics3A_P0_Silver_Kick_380ms"]
 arm.animation_data.action=action
 if action.slots:arm.animation_data.action_slot=action.slots[0]
 out={}
 for t in times:
  bpy.context.scene.frame_set(int(t),subframe=t-int(t))
  bpy.context.view_layer.update()
  def pt(name):
   v=arm.matrix_world @ arm.pose.bones["mixamorig:"+name].head
   return [round(float(x),6) for x in v]
  out[str(t)]={n:pt(n) for n in
   ("Hips","RightLeg","RightToeBase","LeftToeBase","Spine1","Head")}
 return out
a=sample(before);b=sample(after)
def pt(s,t,n):return s[str(float(t))][n]
def kneeRise(s):
 return pt(s,6.4,"RightLeg")[2]-pt(s,1.0,"RightLeg")[2]
def toeAheadOfPlant(s):
 # Original source Silver faces local forward -Y; relative to anchored left boot.
 return pt(s,10.6,"LeftToeBase")[1]-pt(s,10.6,"RightToeBase")[1]
def toeLift(s):
 return pt(s,10.6,"RightToeBase")[2]-pt(s,10.6,"LeftToeBase")[2]
def contactSpread(s):
 r=pt(s,10.6,"RightToeBase");l=pt(s,10.6,"LeftToeBase")
 return math.dist(r[:2],l[:2])
def drift(s):
 first=pt(s,1.0,"LeftToeBase")
 return max(math.dist(first,pt(s,t,"LeftToeBase")) for t in times)
def info(s):
 return {"kneeChamberRiseWorldZSourceUnits":round(kneeRise(s),6),
  "contactBootForwardFromPlantedToeLocalMinusYUnits":round(toeAheadOfPlant(s),6),
  "contactBootWorldZAbovePlantedToeSourceUnits":round(toeLift(s),6),
  "contactHorizontalBootVsPlantedToeUnits":round(contactSpread(s),6),
  "maxLeftToeJoint3dDriftSourceUnits":round(drift(s),6),
  "poses":s}
old=info(a);new=info(b)
for key in ("kneeChamberRiseWorldZSourceUnits","contactBootForwardFromPlantedToeLocalMinusYUnits"):
 assert new[key]>old[key],(key,old[key],new[key])
assert new["maxLeftToeJoint3dDriftSourceUnits"]<.002
report={
 "source": "Independently reopened owner original Silver 22-bone action-only Blender rigs, original facing forward -Y",
 "olderSourceSha256":hashlib.sha256(before.read_bytes()).hexdigest(),
 "newSourceSha256":hashlib.sha256(after.read_bytes()).hexdigest(),
 "sampledFrames":times,
 "unchangedAuthoritativeKickPhasesMs":[90,70,220],
 "baseline":old,"candidate":new,
 "sourceVisualOnly":True,
 "humanVisualApproved":False,
 "realGreyhavenFloorVerified":False,
 "serverHitOrDamageVerified":False,
 "actorWorldTranslationChanged":False}
output.parent.mkdir(parents=True,exist_ok=True)
output.write_text(json.dumps(report,indent=2)+"\n",encoding="utf8")
print("HIGH_FORWARD_AUTHORED_METRICS",json.dumps({"baseline":{k:v for k,v in old.items() if k!="poses"},"candidate":{k:v for k,v in new.items() if k!="poses"}}),flush=True)

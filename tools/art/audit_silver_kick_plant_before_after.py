"""Compare two real EDITABLE Blender Silver rig action files (source only).
Original native bone positions; no claim of real world floor/collisions.
"""
import bpy,math,json,sys
from pathlib import Path
from mathutils import Vector
if "--" not in sys.argv:raise SystemExit("Expected -- ORIGINAL_BLEND CORRECTED_BLEND OUTPUT")
args=sys.argv[sys.argv.index("--")+1:]
assert len(args)==3,args
before,after,out=map(lambda p:Path(p).resolve(),args)
name="Graphics3A_P0_Silver_Kick_380ms"
samples=sorted(set([1.0,3.7,6.4,8.5,10.6,13.5,18.0,23.8]+[float(i) for i in range(1,24)]+[i+.5 for i in range(1,23)]))
def evaluate(path):
 bpy.ops.wm.read_factory_settings(use_empty=True)
 bpy.ops.wm.open_mainfile(filepath=str(path))
 rig=next(o for o in bpy.data.objects if o.type=="ARMATURE")
 assert len(rig.data.bones)==22 and len([o for o in bpy.data.objects if o.type=="MESH"])==0
 act=bpy.data.actions[name];rig.animation_data.action=act
 rig.animation_data.action_slot=act.slots[0]
 positions=[]
 for frame in samples:
  bpy.context.scene.frame_set(int(frame),subframe=frame-int(frame))
  bpy.context.view_layer.update()
  toe=rig.matrix_world@rig.pose.bones["mixamorig:LeftToeBase"].head
  hip=rig.matrix_world@rig.pose.bones["mixamorig:Hips"].head
  head=rig.matrix_world@rig.pose.bones["mixamorig:Head"].head
  positions.append((toe.copy(),hip.copy(),head.copy()))
 anchor=positions[0][0]
 rows=[]
 for frame,(toe,hip,head) in zip(samples,positions):
  torso=head-hip
  rows.append({"frame":frame,
     "toeXYDisplacement":round(math.hypot(toe.x-anchor.x,toe.y-anchor.y),6),
     "toeXYZDisplacement":round((toe-anchor).length,6),
     "torsoTiltDegrees":round(math.degrees(math.atan2(math.hypot(torso.x,torso.y),abs(torso.z))),3)})
 return {"maxToeXY":max(x["toeXYDisplacement"] for x in rows),
         "maxToeXYZ":max(x["toeXYZDisplacement"] for x in rows),
         "maxTorsoTilt":max(x["torsoTiltDegrees"] for x in rows),
         "sourceActionFrames":list(act.frame_range),
         "sampleCount":len(samples),"samples":rows}
old=evaluate(before)
new=evaluate(after)
assert new["maxToeXYZ"]<old["maxToeXYZ"]*.5,(old["maxToeXYZ"],new["maxToeXYZ"])
assert new["maxToeXY"]<old["maxToeXY"]*.5,(old["maxToeXY"],new["maxToeXY"])
assert new["sampleCount"]>=45
record={
 "label":"Source bone toe motion ONLY: no verified Greyhaven floor, IK, root translation, or multiplayer",
 "humanApproved":False,"sourceGroundIsActualWorldGround":False,
 "actorRootMovementChanged":False,"realGameTest":False,
 "baselineHead":"72afc96514193e8c8c0fa9ac206b277c1e937fc7",
 "original":old,"corrected":new,
 "relativeXYZReductionPct":round(100*(1-new["maxToeXYZ"]/old["maxToeXYZ"]),1),
 "relativeXYReductionPct":round(100*(1-new["maxToeXY"]/old["maxToeXY"]),1)}
out.parent.mkdir(parents=True,exist_ok=True)
out.write_text(json.dumps(record,indent=2)+"\n",encoding="utf8")
print("FOOT_PLANT_SOURCE_COMPARE",json.dumps({
 "samples":new["sampleCount"],"originalToeXYZ":old["maxToeXYZ"],
 "candidateToeXYZ":new["maxToeXYZ"],
 "xyzReductionPercent":record["relativeXYZReductionPct"],
 "candidateMaxTilt":new["maxTorsoTilt"]}),flush=True)

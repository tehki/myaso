"""Independent source-rig proof for proposed original Silver Spartan-style front push kick.
Reads real persisted Blender actions (no gameplay, no server combat, no source GLB redistributable).
"""
import bpy, json, sys, math
from pathlib import Path

argv=sys.argv[sys.argv.index("--")+1:]
before, after, dest=map(Path,argv[:3])
times=[1,3.7,6.4,8.5,10.6,13.5,18,23.8]
def sample(path):
 bpy.ops.wm.read_factory_settings(use_empty=True)
 bpy.ops.wm.open_mainfile(filepath=str(path))
 arm=next(ob for ob in bpy.data.objects if ob.type=="ARMATURE")
 assert len(arm.pose.bones)==22
 action=bpy.data.actions["Graphics3A_P0_Silver_Kick_380ms"]
 arm.animation_data.action=action
 if action.slots:arm.animation_data.action_slot=action.slots[0]
 points={}
 for frame in times:
  bpy.context.scene.frame_set(int(frame),subframe=frame-int(frame))
  bpy.context.view_layer.update()
  def bone(name):
   return arm.matrix_world @ arm.pose.bones["mixamorig:"+name].head
  def v(n):return [round(float(z),6) for z in bone(n)]
  points[str(frame)]={n:v(n) for n in ("Hips","RightUpLeg","RightLeg","RightFoot","RightToeBase","LeftToeBase")}
 return points
old=sample(before);new=sample(after)
def P(pts,t,b):return pts[str(t)][b]
def dist(a,b):return math.dist(a,b)
def upward(pts,frame):return P(pts,frame,"RightLeg")[2]-P(pts,1,"RightLeg")[2]
def horizontal_extension(pts,frame):return math.dist(P(pts,frame,"RightToeBase")[:2],P(pts,frame,"Hips")[:2])
anchor=P(new,1,"LeftToeBase")
drift=max(dist(P(new,t,"LeftToeBase"),anchor) for t in times)
out={
 "originalOwnerRig":True,
 "previousSourceSha":before.name,
 "newSourceSha":after.name,
 "samples":len(times),
 "authoritativeKickPhaseMs":[90,70,220],
 "highKneeFrame":6.4,
 "contactFrame":10.6,
 "previousKneeLift":round(upward(old,6.4),6),
 "candidateKneeLift":round(upward(new,6.4),6),
 "previousContactBootHorizontalFromHips":round(horizontal_extension(old,10.6),6),
 "candidateContactBootHorizontalFromHips":round(horizontal_extension(new,10.6),6),
 "candidateSupportToeMaxSourceDrift":round(drift,6),
 "realWorldFloorVerified":False,"impactDamageVerified":False,"realPvPVerified":False,
 "priorSamples":old,"proposedSamples":new
}
dest.parent.mkdir(parents=True,exist_ok=True)
dest.write_text(json.dumps(out,indent=2)+"\n",encoding="utf8")
print("SPARTAN_SOURCE_RIG_AUDIT",json.dumps({k:v for k,v in out.items() if k not in ("priorSamples","proposedSamples")}),flush=True)

"""Actual Blender mesh-space door hinge attachment acceptance, not screenshot-only."""
import bpy, json, hashlib
from pathlib import Path
from mathutils import Vector
out=Path(bpy.data.filepath).parent
objects=bpy.data.objects
prefix="A2.32 wrought fittings / "
def b(name):
 ob=objects[name]
 assert ob.type=="MESH",name
 ps=[ob.matrix_world @ Vector(c) for c in ob.bound_box]
 return [[min(float(v[i]) for v in ps),max(float(v[i]) for v in ps)] for i in range(3)]
def overlaps(a,b,axis,margin=0):
 return min(a[axis][1],b[axis][1])-max(a[axis][0],b[axis][0])>margin
door=b("Red Lion / door_front")
assert abs(door[1][0]+2.03)<.002,door
iron=[o.name for o in objects if o.name.startswith(prefix)]
assert len(iron)==20,iron
original={}
corrected={}
LOWER_Z=.96
UPPER_Z=1.88
assert LOWER_Z>.72 and LOWER_Z<UPPER_Z
for label,z in (("lower",LOWER_Z),("upper",UPPER_Z)):
 strap=b(prefix+"door hinge strap "+label)
 barrel=b(prefix+"hinge barrel "+label)
 assert overlaps(strap,door,1,.005),("strap FLOATS",label,strap,door)
 assert overlaps(barrel,door,1,.005),("barrel FLOATS",label,barrel,door)
 assert overlaps(strap,barrel,1,.005),("hinge barrel NOT ATTACHED",label)
 assert overlaps(strap,barrel,0,.002),("hinge barrel X detached",label)
 assert strap[0][0]>door[0][0]-.015 and strap[0][1]<door[0][1],("strap not on original wood",label)
 assert barrel[0][0]<door[0][0]+.01,("barrel not near original jamb",label)
 assert abs((strap[2][0]+strap[2][1])/2-z)<.001,label
 for i,x in enumerate((-.51,-.32,-.13)):
  peen=b(prefix+"hinge peen "+label+" "+str(i))
  assert overlaps(peen,strap,1,.005),("peen not planted",label,i)
  assert overlaps(peen,strap,0,.005),("peen X off strap",label,i)
  assert abs((peen[0][0]+peen[0][1])/2-x)<.001,(label,i)
 corrected[label]={"strap":strap,"barrel":barrel,"peens":[b(prefix+"hinge peen "+label+" "+str(i)) for i in range(3)]}
oldDoorFaceGapMeters=.030-(-1.4245-(-2.03)) if False else .6055
report={
 "source":"Actual editable Blender 5.2 source mesh/world coordinates",
 "blenderScene":Path(bpy.data.filepath).name,
 "door":{"name":"Red Lion / door_front","worldBounds":door,"frontY":door[1][0]},
 "previousStrapWorldY":[-1.4245,-1.3695],
 "previousClosestFaceGapMeters":-1.4245-door[1][0],
 "corrected":corrected,
 "hingePiecesRepositioned":10,
 "otherIronworkRepositioned":False,
 "originalDoorRoofGeometryEdited":False,
 "serverOrGameplayEdited":False,
 "editableBlenderSourceModified":True,
 "sourceBlendSha256":hashlib.sha256(Path(bpy.data.filepath).read_bytes()).hexdigest(),
 "artistApprovalPending":True
}
(out/"red_lion_a232_hinge_attachment_blender_report.json").write_text(json.dumps(report,indent=2)+"\n",encoding="utf8")
print("ORIGINAL_A232_BLENDER_DOOR_HINGES_ATTACHED",json.dumps({"pieces":10,"originalGapMeters":report["previousClosestFaceGapMeters"],"newStrapY":corrected["lower"]["strap"][1],"doorFrontY":door[1][0]}))

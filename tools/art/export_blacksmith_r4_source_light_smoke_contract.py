#!/usr/bin/env python3
"""Read R4 actual Blender geometry, export scene-space source-only 3C anchors.

World9 placement, entrances, light pools and live smoke are NOT authorized by
this file. Graphic3C must map only after World9 approves the replacement.
"""
import argparse
import hashlib
import json
import sys
from pathlib import Path
import bpy
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

def main():
    argv=sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
    p=argparse.ArgumentParser()
    p.add_argument("--source-report",required=True)
    p.add_argument("--output",required=True)
    a=p.parse_args(argv)
    report=json.loads(Path(a.source_report).read_text(encoding="utf-8"))
    dusk=report["actualDoorGlassDuskAndOriginalChimneySmoke"]
    smoke=dusk["smoke"]
    door=dusk["door"]
    scene=bpy.context.scene
    cam=scene.camera
    if cam is None or cam.data.type!="ORTHO" or cam.data.ortho_scale!=18.0:
        raise ValueError("Real original Blacksmith R4 Blender source camera required")
    if (smoke["sourceModel"]!="Prop_Chimney"
        or smoke["nativeCyclesVolumetricObjects"]!=8
        or door["actualSourceModel"]!="Door_1_Round"
        or door["realOriginalGlassMaterialSlots"]!=1):
        raise ValueError("Real source chimney/door-glass source missing")
    top=Vector((*smoke["actualSourceChimneyCenterXY"],smoke["actualSourceChimneyTopZ"]))
    b=door["measuredOriginalGlassBounds"]
    glazing=Vector(tuple(sum(b[k])/2 for k in ("x","y","z")))
    if not (4<top.z<8 and 1<glazing.z<2):
        raise ValueError("Physically measured scene anchors outside original source")
    def project(x):
        p=world_to_camera_view(scene,cam,x)
        if not (0<p.x<1 and 0<p.y<1 and p.z>0):
            raise ValueError("Source anchor not visible in approved Blender R4 projection")
        return {"x":round(p.x*640,6),"y":round((1-p.y)*640,6),
                "originalCameraOnly":True}
    contract={
      "schema":1,"kind":"graphics3b-blacksmith-r4-original-blender-3c-handoff",
      "nativeBlenderSceneSha256":report["sourceBlendSha256"],
      "creatorOriginalCommit":report["pinnedSourceCommit"],
      "sourceModels":{"chimney":"Prop_Chimney","door":"Door_1_Round"},
      "blenderSourceMeters":{
        "chimneyTop":[round(q,9) for q in top],
        "doorGlassCenter":[round(q,9) for q in glazing],
        "originalSmokeGeometryPuffs":8,
        "originalSmokeShader":"Cycles Principled Volume / 4D Noise",
        "sourceDoorGlassRealVertices":door["realOriginalGlassPolygons"]},
      "originalBlenderSourceProjectionOnly":{
        "width":640,"height":640,"orthoScale":18.0,
        "chimneyTopPixel":project(top),"doorGlassCenterPixel":project(glazing)},
      "ownerAcceptedSourceDayDuskArt":True,
      "3cResponsibilities":{
        "liveSmoke":True,"outdoorLighting":True,"ambientLanterns":True,
        "noDuplicatedLightHalos":True},
      "3bResponsibilities":{"sourceDoorGlassDuskOnly":True,
                           "sourceWindowGlassDuskOnly":True,
                           "cosmeticSourceForgeLightOnly":True},
      "worldAuthoritativeXY":None,"worldOwnedBuildingIdReadOnly":"smith",
      "originalWorldMap":"moonvale-overworld",
      "requiresWorld9ApprovedGeometryAndCameraTransform":True,
      "newRuntimeEmitterAuthorized":False,
      "newEntrancePortalAuthorized":False,
      "serverCollisionOrItemAuthorityChanged":False,
      "realNativeWorldGameplayProof":False,
      "defaultOff":True,"publicReleaseApproved":False
    }
    output=Path(a.output)
    output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps(contract,indent=2)+"\n",encoding="utf-8")
    print("GRAPHICS3B_BLACKSMITH_R4_REAL_BLENDER_3C_ANCHOR_CONTRACT_PASS "+
          json.dumps({"chimney":contract["blenderSourceMeters"]["chimneyTop"],
                     "chimneyPixel":contract["originalBlenderSourceProjectionOnly"]["chimneyTopPixel"],
                     "doorPixel":contract["originalBlenderSourceProjectionOnly"]["doorGlassCenterPixel"]}))
if __name__=="__main__":
    main()

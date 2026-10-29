#!/usr/bin/env python3
"""Fail-closed review-only native Blender R4 2.5D roof/foreground/wall proof."""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image,ImageChops
ROLES=("walls","foreground","roof")
def sha(b):return hashlib.sha256(b).hexdigest()
def verify(base):
    child=base/"r4-layers"
    m=json.loads((child/"blacksmith-r4-actual-blender-occlusion-layers.json").read_text())
    r=json.loads((child/"blacksmith-r4-blender-raycast-report.json").read_text())
    smoke=json.loads((child/"blacksmith-r4-source-atmosphere-contract.json").read_text())
    approved=json.loads((base/"blacksmith-r4-blender-2d5-review-manifest.json").read_text())
    if (m["schema"]!=1 or m["kind"]!="graphics3b-blacksmith-r4-original-blender-actual-3d-raycast-layers"
        or m["approvedOriginalBlenderSha256"]!=approved["genuineSourceBlenderSha256"]
        or m["approvedSourceOriginalCreatorCommit"]!=approved["approvedSourcePinnedCommit"]
        or m["originalOwnerApprovedVisualPixelsPreserved"] is not True
        or m["genuineEvaluatedBlender3DRaycastClassifications"] is not True
        or m["roofGeometryUntouched"] is not True
        or m["originalRedLionUntouched"] is not True
        or m["world9SmithFacadeReplacementAuthorized"] is not False
        or m["actualGameOcclusionOrMultiplayerPassed"] is not False
        or m["mergingDeploymentAuthorized"] is not False
        or r["genuineEvaluatedSceneMeshRaycast"] is not True
        or r["projection"]!="true_original_blender_ortho_view_frame"
        or r["classValues"]!={"unknown":0,"walls":64,"foreground":128,"roof":192}
        or r["counts"]["roof"]<1000 or r["counts"]["walls"]<1000
        or r["counts"]["foreground"]<1000):
        raise ValueError("Unsafe provenance, source mismatch or counterfeit game authority")
    if (smoke.get("kind")!="graphics3b-blacksmith-r4-original-blender-3c-handoff"
        or smoke["nativeBlenderSceneSha256"]!=m["approvedOriginalBlenderSha256"]
        or smoke["creatorOriginalCommit"]!=m["approvedSourceOriginalCreatorCommit"]
        or smoke["worldAuthoritativeXY"] is not None
        or smoke["worldOwnedBuildingIdReadOnly"]!="smith"
        or smoke["newRuntimeEmitterAuthorized"] is not False
        or smoke["newEntrancePortalAuthorized"] is not False
        or smoke["serverCollisionOrItemAuthorityChanged"] is not False
        or smoke["requiresWorld9ApprovedGeometryAndCameraTransform"] is not True
        or smoke["blenderSourceMeters"]["originalSmokeGeometryPuffs"]!=8):
        raise ValueError("Graphics 3C must not receive fabricated World9 coordinates")
    with Image.open(child/"blacksmith-r4-blender-actual-occlusion-classes.png") as im:
        if im.size!=(640,640) or im.mode!="L":raise ValueError("Not Blender raycast mask")
        mask=im.tobytes()
    if len(mask)!=640*640 or set(mask)!={0,64,128,192}:
        raise ValueError("Not real original Blender raycast classes")
    actual={str(n):mask.count(n) for n in (0,64,128,192)}
    for role,key in (("unknown",0),("walls",64),("foreground",128),("roof",192)):
        if actual[str(key)]!=r["counts"][role]:
            raise ValueError("Native raycast source report does not match actual mask")
    combined_sizes={}
    for mood in ("day","dusk"):
        entry=m["images"][mood]
        source=child/("greyhaven-blacksmith-r4-source-"+mood+".png")
        raw=source.read_bytes()
        if (sha(raw)!=entry["sourceSha256"] or
            entry["sourceSha256"]!=approved["images"][mood]["sourceBlenderPngSha256"]):
            raise ValueError("Not byte-identity owner approved original Blender source: "+mood)
        with Image.open(source) as im:
            if im.size!=(640,640):raise ValueError("Unexpected approved Blender view")
            original=im.convert("RGBA")
        composite=Image.new("RGBA",(640,640))
        counts={"walls":0,"foreground":0,"roof":0,"unclassified_visible_fallback_walls":0}
        totalbytes=0
        for name in ROLES:
            info=entry["separateLayers"][name]
            filepath=child/info["webp"]
            bytes_=filepath.read_bytes()
            if sha(bytes_)!=info["webpSha256"] or len(bytes_)!=info["webpBytes"]:
                raise ValueError("Source backed lossless WebP SHA mismatch")
            totalbytes+=len(bytes_)
            with Image.open(filepath) as image:
                if image.format!="WEBP" or image.size!=(640,640):
                    raise ValueError("Incorrect game preview WebP dimensions")
                pixels=image.convert("RGBA")
            if pixels.getchannel("A").getbbox() is None:
                raise ValueError("No visual layer pixels: "+name)
            # Pixel ownership comes from native ray cast, not guessed coords.
            alpha=pixels.getchannel("A").tobytes()
            orig=original.getchannel("A").tobytes()
            expected_label={"walls":64,"foreground":128,"roof":192}[name]
            for i,(a,b) in enumerate(zip(alpha,orig)):
                if a>0:
                    if a!=b or (mask[i]!=expected_label and not(name=="walls" and mask[i]==0)):
                        raise ValueError("Layer pixels not owned by native Blender geometry")
                    counts[name]+=1
                    if name=="walls" and mask[i]==0:
                        counts["unclassified_visible_fallback_walls"]+=1
            composite=Image.alpha_composite(composite,pixels)
            if info["pixels"]!=counts[name] or not info["originalPixelColorsPreserved"]:
                raise ValueError("Rendered source layer pixel proof changed")
        if ImageChops.difference(original,composite).getbbox() is not None:
            raise ValueError("Original real Blender visual pixels changed after 3-layer compose")
        if dict(entry["geometryLabeledVisiblePixels"])!=counts:
            raise ValueError("Original Blender geometry ownership counts changed")
        if counts["unclassified_visible_fallback_walls"]>int(sum(counts[x] for x in ROLES)*.13):
            raise ValueError("Too many non-mesh visual pixels: not a geometry proof")
        combined_sizes[mood]=totalbytes
    print("GRAPHICS3B_BLACKSMITH_R4_REAL_NATIVE_BLENDER_WALL_FOREGROUND_ROOF_LAYER_PASS "+
          json.dumps({"bytes":combined_sizes,"creatorSourcesPreserved":True,
                      "actualGameplayProof":False},sort_keys=True))
if __name__=="__main__":
    p=argparse.ArgumentParser();p.add_argument("--base",required=True,type=Path)
    args=p.parse_args();verify(args.base)

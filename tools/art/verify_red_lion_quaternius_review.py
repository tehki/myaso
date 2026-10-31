#!/usr/bin/env python3
"""Fail-closed original CC0 Quaternius Red Lion replacement art review.

This verifies original model/asset provenance and absence of old A2.32 meshes.
Does not assert live runtime integration, 4-player QA or gameplay authority.
"""
import argparse,hashlib,json
from pathlib import Path
from PIL import Image

PIN="21104b4045261c28fc312360841ed1a7b0ac8782"
def sha(content):return hashlib.sha256(content).hexdigest()
def verify(path):
    manifest=json.loads((path/"manifest.json").read_text(encoding="utf-8"))
    if (manifest["schema"]!=1
        or manifest["kind"]!="graphics3b-red-lion-quaternius-full-asset-replacement"
        or manifest["sourceCommit"]!=PIN
        or manifest["sourceLicense"]!="CC0-1.0"
        or manifest["oldRedLionArtSuperseded"] is not True
        or manifest["originalA232ModelIncluded"] is not False
        or manifest["gameRuntimeReplaced"] is not False
        or manifest["artReviewOnly"] is not True
        or manifest["worldReadOnly"]["authoredBuildingId"]!="red-lion"
        or manifest["worldReadOnly"]["unchangedServerCollision"] is not True
        or manifest["worldReadOnly"]["unchangedEntranceAuthority"] is not True):
        raise ValueError("Red Lion Quaternius replacement must retain source/world boundaries")
    parts=manifest["parts"]
    models=[x["model"] for x in parts]
    crate=next(x for x in parts if x["model"]=="Prop_Crate")
    art=manifest.get("artCorrections",{})
    foliage=art.get("foliage",{})
    if (crate["at"]!=[5.35,-4.3,0] or
        any(x["model"]=="Prop_Vine2" for x in parts) or
        foliage.get("location")!=[5.55,-5.85,0.08] or
        foliage.get("leafCount")!=9 or
        art.get("sign",{}).get("board")!=[0,-4.55,3.55] or
        art.get("chimneySmoke",{}).get("dayVisible") is not False or
        art.get("chimneySmoke",{}).get("duskVisible") is not True):
        raise ValueError("Owner-requested geometry correction manifest drift")
    if (len(parts)!=33 or
        len(models)<30 or
        models.count("Roof_Front_Brick6")!=2 or
        models.count("Roof_RoundTiles_6x8")!=1 or
        models.count("Door_1_Round")!=1 or
        models.count("Window_Wide_Round1")<6):
        raise ValueError("Full original tavern and day/dusk glazing parts missing")
    if any("a232" in name.lower() or "original_red_lion" in name.lower() for name in models):
        raise ValueError("Prior Red Lion A2.32 model must NOT appear")
    source=json.loads((path/"review-only"/"red-lion-quaternius-review-manifest.json").read_text())
    if (source["kind"]!="graphics3b-quaternius-red-lion-complete-visual-replacement-review"
        or source["pinnedQuaterniusCC0Commit"]!=PIN
        or source["ownerRequestedRetirementOfA232"] is not True
        or source["oldRedLionA232MeshesUsed"] is not False
        or source["creatorModelInstances"]!=len(parts)
        or source.get("artistGroundFoliageLeaves")!=9
        or source["genuineSourceGlazing"] is not True
        or source["genuineOriginalRoofAndGables"] is not True
        or source["sourceArtOnly"] is not True
        or source["world9VisualPlacementTested"] is not False
        or source["world9GameplayAuthorityUnchanged"] is not True
        or source["runtimeOldAssetNotYetReplaced"] is not True):
        raise ValueError("Unverified source-model identity or exaggerated gameplay claim")
    measured=source.get("measuredCorrections",{})
    smoke=source.get("duskChimneySmoke",{})
    if (measured.get("signClearanceAboveWindows",0)<.25
        or measured.get("crateRoofClearance",0)<.4
        or measured.get("foliageRoofClearance",0)<.4
        or measured.get("foliageCrateGap",0)<.15
        or measured.get("foliageBounds",{}).get("z",[999,999])[0]<0
        or measured.get("foliageBounds",{}).get("z",[999,999])[1]>.2
        or smoke.get("continuousClosedVolumeMesh") is not True
        or smoke.get("actualCyclesVolumeMaterial") is not True
        or smoke.get("dayVisible") is not False
        or smoke.get("duskVisible") is not True):
        raise ValueError("Blender did not prove raised sign, non-overlapping crate, grounded foliage and dusk-only smoke")
    images=source["images"]
    if sorted(images)!=["day","dusk"]:
        raise ValueError("Missing one source mood")
    for mood in ("day","dusk"):
        data=images[mood]
        name="red-lion-quaternius-"+mood+"-review.webp"
        if (data["webp"]!=name or data["width"]!=960 or data["height"]!=720
            or data["alphaPixelExact"] is not True
            or len(data["sourcePngSha256"])!=64):
            raise ValueError("Original source camera and image provenance drift")
        raw=(path/"review-only"/name).read_bytes()
        if sha(raw)!=data["webpSha256"] or len(raw)!=data["bytes"]:
            raise ValueError("Genuine pinned source sprite changed")
        with Image.open(path/"review-only"/name) as im:
            if im.format!="WEBP" or im.size!=(960,720):
                raise ValueError("Not real 960×720 Blender WebP")
            a=im.convert("RGBA").getchannel("A")
            if list(a.getbbox() or [])!=data["alphaBounds"] or a.getextrema()[0]==255:
                raise ValueError("Original source transparent facade lost")
    if images["day"]["webpSha256"]==images["dusk"]["webpSha256"]:
        raise ValueError("Real day and dusk cannot be byte-identical")
    print("GRAPHICS3B_QUATERNIUS_RED_LION_COMPLETE_REPLACEMENT_SOURCE_REVIEW_PASS "+
          json.dumps({"creatorParts":len(parts),"daySha256":images["day"]["webpSha256"],
                      "duskSha256":images["dusk"]["webpSha256"],
                      "originalA232Meshes":0,"runtimeUnchanged":True},sort_keys=True))
if __name__=="__main__":
    a=argparse.ArgumentParser();a.add_argument("--dir",required=True,type=Path)
    verify(a.parse_args().dir)

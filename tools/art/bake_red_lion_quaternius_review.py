#!/usr/bin/env python3
"""Convert genuine original Quaternius Red Lion Blender RGBA into alpha-exact WebPs.
These are honest art review sprites, not already-placed World9 runtime assets.
"""
import argparse,hashlib,json
from pathlib import Path
from PIL import Image

def digest(x):return hashlib.sha256(x).hexdigest()

def run(source,out):
    report=json.loads((source/"red-lion-quaternius-provenance.json").read_text(encoding="utf-8"))
    if (report["kind"]!="graphics3b-red-lion-quaternius-full-asset-replacement"
        or report["creatorPinnedCommit"]!="21104b4045261c28fc312360841ed1a7b0ac8782"
        or report["license"]!="CC0-1.0"
        or report["sourceOnly"] is not True
        or report["oldRedLionVisualModelSuperseded"] is not True
        or report["originalA232MeshCount"]!=0
        or report["actualCreatorInstances"]<32
        or report["actualCreatorVertices"]<15000
        or report["genuineGlazingSlots"]<5
        or report["actualGables"]!=2
        or report.get("actualArtistGroundFoliageLeaves")!=9
        or report["gameRuntimeNotChanged"] is not True):
        raise ValueError("Not an authentic complete original Quaternius Red Lion replacement")
    measured=report.get("measuredCorrections",{})
    smoke=report.get("sourceChimney",{})
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
        raise ValueError("Owner-requested sign, crate, ground foliage or dusk chimney smoke correction failed measured geometry checks")
    out.mkdir(parents=True,exist_ok=True)
    captures={}
    for mood in ("day","dusk"):
        orig=(source/("red-lion-quaternius-"+mood+".png"))
        record=next(x for x in report["captured"] if x["mood"]==mood)
        payload=orig.read_bytes()
        if len(payload)!=record["bytes"] or digest(payload)!=record["sha256"]:
            raise ValueError("Creator-authentic Blender frame hash mismatch")
        with Image.open(orig) as image:
            if image.format!="PNG" or image.size!=(960,720):
                raise ValueError("Blender source camera size drift")
            rgba=image.convert("RGBA")
            alpha=rgba.getchannel("A")
            box=alpha.getbbox()
            if not box or box[2]-box[0]<450 or box[3]-box[1]<350 or alpha.getextrema()[0]==255:
                raise ValueError("Original facade missing or alpha lost")
            target=out/("red-lion-quaternius-"+mood+"-review.webp")
            rgba.save(target,"WEBP",quality=90,method=6,exact=True)
            with Image.open(target) as check:
                if check.format!="WEBP" or check.size!=rgba.size:
                    raise ValueError("WebP source dimensions changed")
                if check.convert("RGBA").getchannel("A").tobytes()!=alpha.tobytes():
                    raise ValueError("Original Blender alpha is not pixel-exact")
            blob=target.read_bytes()
            if len(blob)>=len(payload):raise ValueError("WebP conversion did not shrink original PNG")
            captures[mood]={"webp":target.name,"webpSha256":digest(blob),
                            "bytes":len(blob),"sourcePngSha256":record["sha256"],
                            "alphaBounds":list(box),"alphaPixelExact":True,
                            "width":960,"height":720,"originalBlenderDayDusk":True}
    if captures["day"]["webpSha256"]==captures["dusk"]["webpSha256"]:
        raise ValueError("Real source day/dusk are identical")
    manifest={"schema":1,"kind":"graphics3b-quaternius-red-lion-complete-visual-replacement-review",
              "ownerRequestedRetirementOfA232":True,
              "pinnedQuaterniusCC0Commit":report["creatorPinnedCommit"],
              "sourceBlendSha256":report["originalEditableBlendSha256"],
              "creatorModelInstances":report["actualCreatorInstances"],
              "artistGroundFoliageLeaves":report["actualArtistGroundFoliageLeaves"],
              "oldRedLionA232MeshesUsed":False,
              "genuineSourceGlazing":True,"genuineOriginalRoofAndGables":True,
              "measuredCorrections":measured,"duskChimneySmoke":smoke,
              "images":captures,"sourceArtOnly":True,"world9VisualPlacementTested":False,
              "world9GameplayAuthorityUnchanged":True,"runtimeOldAssetNotYetReplaced":True,
              "noMergeOrDeployment":True}
    (out/"red-lion-quaternius-review-manifest.json").write_text(json.dumps(manifest,indent=2)+"\n")
    print("GRAPHICS3B_RED_LION_QUATERNIUS_ALPHA_PREVIEW_PASS",json.dumps(captures,sort_keys=True))

if __name__=="__main__":
    p=argparse.ArgumentParser();p.add_argument("--source",type=Path,required=True)
    p.add_argument("--out",type=Path,required=True);a=p.parse_args()
    run(a.source,a.out)

#!/usr/bin/env python3
"""Split approved Blender R4 day/dusk using real scene raycast labels.

Input mask is produced exclusively from actual evaluated Blender geometry;
original RGBA pixels remain completely unaltered in three disjoint layers.
Lossless WebPs can be recomposed exactly. No game integration asserted.
"""
import argparse
import hashlib
import json
from collections import Counter
from pathlib import Path
from PIL import Image, ImageChops

LABELS={64:"walls",128:"foreground",192:"roof"}
def digest(data):
    return hashlib.sha256(data).hexdigest()

def split(native, mask, target, report):
    target.mkdir(parents=True,exist_ok=True)
    with Image.open(mask) as m:
        if m.size!=(640,640) or m.mode!="L":
            raise ValueError("Require 640×640 genuine Blender geometry raymask")
        classes=m.tobytes()
    if len(classes)!=640*640 or not set(classes).issubset({0,64,128,192}):
        raise ValueError("Unexpected projected real-mesh label")
    breakdown=Counter()
    imageData={}
    all_layers={}
    for mood in ("day","dusk"):
        src=native/("greyhaven-blacksmith-"+mood+".png")
        blob=src.read_bytes()
        evidence=next((x for x in report["captured"] if x["mood"]==mood),None)
        if not evidence or digest(blob)!=evidence["sha256"]:
            raise ValueError("Original owner-accepted Cycles source sha mismatch: "+mood)
        with Image.open(src) as obj:
            if obj.size!=(640,640) or obj.format!="PNG":
                raise ValueError("Approved Blender camera/image contract has drifted")
            original=obj.convert("RGBA")
            pixels=original.tobytes()
        rgba={name:bytearray(len(pixels)) for name in LABELS.values()}
        local=Counter()
        for pixelIndex, label in enumerate(classes):
            k=pixelIndex*4
            a=pixels[k+3]
            if not a:
                # An all-transparent source pixel is visually empty on all passes.
                continue
            name=LABELS.get(label,"walls")
            rgba[name][k:k+4]=pixels[k:k+4]
            local[name]+=1
            if label==0:local["unclassified_visible_fallback_walls"]+=1
        # Actual 3D classification must retain substantial walls/roof/foreground.
        if min(local[k] for k in LABELS.values())<200 or \
                local["unclassified_visible_fallback_walls"]>int((sum(local[k] for k in LABELS.values()))*.13):
            raise ValueError("Real Blender geometry role hit coverage too poor "+str(local))
        transparent=Image.new("RGBA",(640,640))
        pngComposite=transparent.copy()
        webpComposite=transparent.copy()
        layers={}
        for name in ("walls","foreground","roof"):
            view=Image.frombytes("RGBA",(640,640),bytes(rgba[name]))
            pngComposite=Image.alpha_composite(pngComposite,view)
            pngName="blacksmith-r4-"+mood+"-"+name+"-pixel-exact.png"
            webpName="blacksmith-r4-"+mood+"-"+name+"-lossless.webp"
            view.save(target/pngName,format="PNG",optimize=True)
            view.save(target/webpName,format="WEBP",lossless=True,method=6,exact=True)
            with Image.open(target/webpName) as output:
                decoded=output.convert("RGBA")
            webpComposite=Image.alpha_composite(webpComposite,decoded)
            if decoded.tobytes()!=view.tobytes():
                raise ValueError("Lossless original asset channel corruption: "+webpName)
            if decoded.getchannel("A").tobytes()!=view.getchannel("A").tobytes():
                raise ValueError("Pixel-perfect alpha loss")
            layers[name]={"png":pngName,"webp":webpName,
                          "webpSha256":digest((target/webpName).read_bytes()),
                          "webpBytes":(target/webpName).stat().st_size,
                          "pixels":local[name],"originalPixelColorsPreserved":True,
                          "maskFromOriginalEvaluated3DBlenderGeometry":True}
            all_layers[(mood,name)]=view
        pngIdentical=ImageChops.difference(pngComposite,original).getbbox() is None
        webpIdentical=ImageChops.difference(webpComposite,original).getbbox() is None
        # PNG with alpha0 hidden RGB can differ, verify original meaningful pixels.
        origRaw=original.tobytes()
        compRaw=webpComposite.tobytes()
        visibleIdentical=all(
            origRaw[i:i+4]==compRaw[i:i+4]
            for i in range(0,len(origRaw),4) if origRaw[i+3]!=0)
        if not visibleIdentical or pngComposite.getchannel("A").tobytes()!=original.getchannel("A").tobytes():
            raise ValueError("Original Blender actual visible pixels cannot be recovered")
        if not webpIdentical or not pngIdentical:
            raise ValueError("Original Blender RGBA not byte-identical when recomposed")
        imageData[mood]={"sourceSha256":digest(blob),"sourcePngBytes":len(blob),
                          "geometryLabeledVisiblePixels":dict(local),
                          "fullRgbaRecompositionByteIdentical":True,
                          "losslessWebpRgbaRecompositionByteIdentical":True,
                          "separateLayers":layers}
        breakdown.update(local)
    manifest={"schema":1,"kind":"graphics3b-blacksmith-r4-original-blender-actual-3d-raycast-layers",
      "camera":{"projection":"actual Blender source orthographic","width":640,"height":640,
                "blenderOrthoScale":18.0},
      "approvedOriginalBlenderSha256":report["sourceBlendSha256"],
      "approvedSourceOriginalCreatorCommit":report["pinnedSourceCommit"],
      "originalOwnerApprovedVisualPixelsPreserved":True,
      "genuineEvaluatedBlender3DRaycastClassifications":True,
      "roofGeometryUntouched":True,"originalRedLionUntouched":True,
      "images":imageData,"counts":dict(breakdown),
      "sourceOnly":True,"defaultOff":True,
      "world9SmithFacadeReplacementAuthorized":False,
      "actualGameOcclusionOrMultiplayerPassed":False,
      "runtimeAtmosphereChanged":False,"mergingDeploymentAuthorized":False}
    name="blacksmith-r4-actual-blender-occlusion-layers.json"
    (target/name).write_text(json.dumps(manifest,indent=2)+"\n",encoding="utf-8")
    print("GRAPHICS3B_R4_BLENDER_LAYER_PIXEL_EXACT_RECOMPOSITION_PASS "+
         json.dumps({"counts":dict(breakdown),
          "byteSizes":{m:sum(x["webpBytes"] for x in imageData[m]["separateLayers"].values())
                       for m in ("day","dusk")}},sort_keys=True))

if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("--source",type=Path,required=True)
    p.add_argument("--mask",type=Path,required=True)
    p.add_argument("--output",type=Path,required=True)
    a=p.parse_args()
    report=json.loads((a.source/"greyhaven-blacksmith-source-report.json").read_text())
    if (report.get("sourceOnly")!=True or report.get("placedInRuntime")!=False
        or report.get("realImportedModuleCount")!=15
        or report.get("actualDoorGlassDuskAndOriginalChimneySmoke",{}).get("smoke",{}).get("nativeCyclesVolumetricObjects")!=8):
        raise ValueError("Not original approved R4 Blender source")
    split(a.source,a.mask,a.output,report)

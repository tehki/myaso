#!/usr/bin/env python3
"""Bake approved real-Blender Blacksmith R4 to portable review-only WebPs.

Retain authentic source-alpha and Blender sha256. This is NOT a World9
replacement grant, not a game prefab, and not release-ready multiplayer art.
"""
import argparse
import hashlib
import json
from pathlib import Path

try:
    from PIL import Image
except ImportError as exc:
    raise SystemExit("Pillow required for genuine Blender sprite baking") from exc


def sha256(value):
    return hashlib.sha256(value).hexdigest()


def read_report(source):
    p = source / "greyhaven-blacksmith-source-report.json"
    report = json.loads(p.read_text(encoding="utf-8"))
    if (report.get("kind") != "graphics3b-original-blacksmith-p1-review"
        or report.get("sourceLicense") != "CC0-1.0"
        or report.get("pinnedSourceCommit") != "21104b4045261c28fc312360841ed1a7b0ac8782"
        or report.get("realImportedModuleCount") != 15
        or report.get("realImportedVertexCount", 0) < 7000
        or report.get("sourceOnly") is not True
        or report.get("placedInRuntime") is not False
        or report.get("productionAuthorized") is not False
        or report.get("originalCottagePreserved") is not True
        or report.get("originalRedLionPreserved") is not True):
        raise ValueError("Invalid creator-authentic Blacksmith R4 native Blender source")

    fixes = report.get("ownerRequestedBlenderGeometryFix", {})
    clear = fixes.get("actualCollisionFreeGeometry", {})
    if (not fixes.get("realGables", {}).get("doubleSidedTriangleClosure")
        or fixes.get("authenticDoorMeshCount", 0) < 1
        or fixes.get("authenticWindowShutterMeshCount", 0) < 1
        or fixes.get("authenticWindowGlassMaterialSlots", 0) < 1
        or not clear.get("usingActualEvaluatedWorldMeshBounds")
        or not clear.get("noForgeRoofIntersection")
        or not clear.get("noCreatorBoxToolIntersection")
        or clear.get("roofVsForgeClearanceMeters", -1) < 0.16
        or clear.get("crateVsHammerClearanceMeters", -1) < 0.10
        or clear.get("crateVsWorkbenchClearanceMeters", -1) < 0.10):
        raise ValueError("Approved roof, original doors and crate geometry are not qualified")

    dusk = report.get("actualDoorGlassDuskAndOriginalChimneySmoke", {})
    door, smoke = dusk.get("door", {}), dusk.get("smoke", {})
    if (dusk.get("realBlenderSourceOnly") is not True
        or dusk.get("originalGameUnaffected") is not True
        or door.get("actualSourceModel") != "Door_1_Round"
        or door.get("realOriginalGlassPolygons", 0) < 1
        or door.get("realOriginalGlassMaterialSlots") != 1
        or door.get("originalDayMaterialRestored") is not True
        or door.get("duskOnlyWarmAmber") is not True
        or door.get("syntheticGlassOverlay") is not False
        or smoke.get("sourceModel") != "Prop_Chimney"
        or smoke.get("nativeCyclesVolumetricObjects") != 8
        or smoke.get("actual4DNoiseDensity") is not True
        or smoke.get("duskOnly") is not True
        or smoke.get("gameEmitterChanged") is not False
        or smoke.get("originalChimneyMeshUnchanged") is not True):
        raise ValueError("Actual door-glass/light or chimney-smoke authoring missing")

    cap = report.get("captured", [])
    if len(cap) != 2 or [x.get("mood") for x in cap] != ["day", "dusk"]:
        raise ValueError("Native source must include original day AND dusk")
    return report


def bake(source, dest):
    report = read_report(source)
    dest.mkdir(parents=True, exist_ok=True)
    images = {}
    for mood, frame in zip(("day", "dusk"), report["captured"]):
        original_name = "greyhaven-blacksmith-" + mood + ".png"
        if frame["name"] != original_name:
            raise ValueError("Noncanonical Blender frame name")
        native = (source / original_name).read_bytes()
        if sha256(native) != frame["sha256"] or len(native) != frame["bytes"]:
            raise ValueError("Blender frame is not byte-identical to original report")
        with Image.open(source / original_name) as img:
            if img.size != (640, 640) or img.format != "PNG":
                raise ValueError("Only original 640px RGBA Blender art is allowed")
            rgba = img.convert("RGBA")
            alpha = rgba.getchannel("A")
            bounds = alpha.getbbox()
            if not bounds or bounds[2]-bounds[0] < 230 or bounds[3]-bounds[1] < 240:
                raise ValueError("Original Blacksmith 3D facade is missing or cropped")
            if min(alpha.getextrema()) == 255:
                raise ValueError("Blacksmith screenshot lost its transparency")
            filename = "greyhaven-blacksmith-r4-" + mood + "-2d5-review.webp"
            outfile = dest / filename
            rgba.save(outfile, "WEBP", quality=90, method=6, exact=True)
            with Image.open(outfile) as reread:
                if reread.format != "WEBP" or reread.size != rgba.size:
                    raise ValueError("WebP source lost original dimensions")
                if reread.convert("RGBA").getchannel("A").tobytes() != alpha.tobytes():
                    raise ValueError("Genuine Blender alpha was not preserved")
            converted = outfile.read_bytes()
            if not 0 < len(converted) < len(native):
                raise ValueError("Blender source WebP failed practical transfer-size gate")
            images[mood] = {
                "file":filename,"width":640,"height":640,
                "sourceBlenderPngSha256":frame["sha256"],
                "sourceBytes":len(native),"spriteSha256":sha256(converted),
                "spriteBytes":len(converted),"alphaBoundsPx":list(bounds),
                "alphaPixelBytesUnchanged":True,
            }
    if images["day"]["sourceBlenderPngSha256"] == images["dusk"]["sourceBlenderPngSha256"]:
        raise ValueError("Day and dusk must differ in real Cycles source")
    output = {
        "schema":1,
        "kind":"graphics3b-blacksmith-r4-original-blender-2d5-review",
        "source":"actual native Blender 4.5.14 and original Quaternius CC0",
        "ownerVisualDirectionApproved":True,
        "genuineSourceBlenderSha256":report["sourceBlendSha256"],
        "approvedSourcePinnedCommit":report["pinnedSourceCommit"],
        "importedCreatorModules":report["realImportedModuleCount"],
        "realCreatorVertices":report["realImportedVertexCount"],
        "originalDoorGlassAndRoofSmoke":True,
        "realGeometryCollisionClearanceVerified":True,
        "images":images,
        "readOnlyWorldReference":{"mapId":"moonvale-overworld","candidateAuthoredId":"smith"},
        "world9FacadeReplacementAuthorized":False,
        "authoredWorldPlacementModified":False,
        "realFourPlayerWorld9IntegrationTested":False,
        "gameplayItemsPortalsCombatChanged":False,
        "mergeDeployAuthorized":False,
    }
    manifest = dest / "blacksmith-r4-blender-2d5-review-manifest.json"
    manifest.write_text(json.dumps(output,indent=2)+"\n",encoding="utf-8")
    print("GRAPHICS3B_BLACKSMITH_R4_SOURCE_BACKED_REVIEW_WEBP_ALPHA_PASS "
          +json.dumps({"day":images["day"]["spriteSha256"],
                       "dusk":images["dusk"]["spriteSha256"],
                       "alphaPreserved":True,"originalWorld9Untouched":True}))


def main():
    args = argparse.ArgumentParser()
    args.add_argument("--source",type=Path,required=True)
    args.add_argument("--dest",type=Path,required=True)
    p = args.parse_args()
    bake(p.source,p.dest)


if __name__ == "__main__":
    main()

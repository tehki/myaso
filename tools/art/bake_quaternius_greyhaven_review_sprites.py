#!/usr/bin/env python3
"""Graphics3B P1: bake genuine original Quaternius V2 Blender frames as REVIEW-ONLY 2.5D WebPs.

This does NOT grant World9 facade replacement, occupancy, door, server collision,
runtime item/world mutation or placement; assets are confined to CI artifacts.
"""
import argparse
import hashlib
import json
from pathlib import Path

try:
    from PIL import Image
except ImportError as exc:
    raise SystemExit("Pillow required only in isolated architecture review job: "+str(exc))


def sha(data):
    return hashlib.sha256(data).hexdigest()


def run():
    p = argparse.ArgumentParser()
    p.add_argument("--source", required=True, help="existing native Blender PNGs and report directory")
    p.add_argument("--dest", required=True, help="isolated CI review directory, NOT web/ game assets")
    args = p.parse_args()
    source = Path(args.source)
    dest = Path(args.dest)
    dest.mkdir(parents=True, exist_ok=True)
    report = json.loads((source / "quaternius-greyhaven-review-report.json").read_text())
    if report.get("status") != "ORIGINAL_QUATERNIUS_FREE_STANDARD_BLENDER_ART_PREVIEW":
        raise ValueError("requires original verified Blender Quaternius result")
    if (report.get("sourceLicense") != "CC0-1.0"
            or report.get("originalRedLionOrRoofChanged") is not False
            or report.get("authoritativeWorldCollisionOrPortalChanged") is not False
            or report.get("importedSourceModules") != 14):
        raise ValueError("Blender provenance or authority invariant failed")
    camera = report.get("cameraReview", {})
    if (camera.get("projection") != "ORTHO"
            or camera.get("position") != [3, -12, 17]
            or camera.get("target") != [0, 0, 2.8]
            or camera.get("orthoScale") != 12.8
            or camera.get("liveWorld9CameraChanged") is not False):
        raise ValueError("sprite bake lacks the reviewed Greyhaven front-gable orthographic camera")
    if report.get("materialReview", {}).get("roofMaterialNodesChanged", 0) < 1:
        raise ValueError("not the genuine V2 Blood & Iron roof material review")
    alignment = report.get("doorFrameAlignment", {})
    if (alignment.get("verifiedGenuineImportedBlenderMeshes") is not True
            or alignment.get("unchangedOriginalMeshVertexData") is not True
            or alignment.get("horizontalCenterOffsetMeters", 1.0) > 0.015
            or alignment.get("depthCenterOffsetMeters", 1.0) > 0.10
            or not 0 <= alignment.get("thresholdBottomOffsetMeters", -1.0) <= 0.09):
        raise ValueError("cannot bake Quaternius cottage with unverified Blender door/arch alignment")
    dusk = report.get("duskInteriorAndChimney", {})
    glass = dusk.get("actualSourceGlassLighting", {})
    smoke = dusk.get("actualSourceChimneySmoke", {})
    if (dusk.get("blenderSceneOnly") is not True or
            dusk.get("dayGlassMaterialAndLightsPreserved") is not True or
            dusk.get("emittedDoorAndWindowGlassDuskOnly") is not True or
            dusk.get("originalMeshesAndTexturesUnchanged") is not True or
            any(glass.get(part, {}).get("genuineGlassMaterialSlots", 0) < 1
                for part in ("window", "door")) or
            smoke.get("anchorOriginalSourceModel") != "Prop_Chimney" or
            smoke.get("proceduralVolumePuffs") != 6 or
            smoke.get("animatedInGame") is not False):
        raise ValueError("actual original Blender dusk source glass and anchored smoke audit missing")
    gable = report.get("gableInfill", {})
    if (gable.get("realBlender3DPrism") is not True
            or gable.get("sourceRoofModel") != "Roof_RoundTiles_4x4"
            or gable.get("sourcePlasterPBR", "").startswith("MI_Plaster") is not True
            or gable.get("sourceTimberPBR", "").startswith("MI_WoodTrim") is not True
            or gable.get("timberBraceCount") != 3
            or gable.get("userRequestedMatchWeatheredLowerFacade") is not True
            or gable.get("originalSourcePlasterMaterialUnchanged") is not True
            or gable.get("worldSpaceNoSourceUV") is not True
            or gable.get("sourceGableAtlasNodesDisconnected") is not True
            or gable.get("sourcePlasterImageTexturesNotUsedOnGable") is not True
            or gable.get("lowContrastNoBigStain") is not True
            or gable.get("gableColorVariationLinked") is not True
            or gable.get("gableFineBumpLinked") is not True
            or gable.get("worldPositionWeatheringNoise") != 9.5
            or not 0.14 <= gable.get("roofApexSeamExtendedMeters", 0) <= 0.20
            or gable.get("roofApexHiddenTipRiseMeters") != 0.17
            or gable.get("roofApexHiddenTipForwardMeters") != 0.035
            or gable.get("flatRoughnessUnlinked") is not True
            or gable.get("plainGableMaterialName") != "BloodIron_Greyhaven_PlainGablePlaster_ReviewOnly"
            or gable.get("gableFaceAreaSquareMeters", 0) < 2.0
            or gable.get("originalRoofAndWallMeshesUnchanged") is not True
            or gable.get("unchangedDoorGlassLightingAndSmoke") is not True
            or gable.get("world9PlacementUnchanged") is not True
            or gable.get("gameplayCollisionUnchanged") is not True):
        raise ValueError("original Quaternius roof-to-wall gap lacks verified real Blender timber/plaster gable infill")
    captures = report.get("captured")
    if len(captures or []) != 2:
        raise ValueError("requires original day AND dusk source evidence")
    result = {
        "kind":"graphics3b-quaternius-real-blender-v2-review-2d5",
        "requiresExplicitArtistApproval":True,
        "serverAuthorized":False,
        "placedInWorld9":False,
        "legalWorldFootprint":None,
        "renderingOnly":True,
        "noFighterOcclusionProof":True,
        "noChangedRedLion":True,
        "sourceEdition":"Quaternius CC0 Standard",
        "sourceCreatorArchiveMirrorParityVerified":False,
        "realQuaterniusDoorFrameWorldBoundsVerified": True,
        "doorFrameCenterOffsetMeters": alignment["horizontalCenterOffsetMeters"],
        "doorFrameDepthOffsetMeters": alignment["depthCenterOffsetMeters"],
        "doorThresholdBottomOffsetMeters": alignment["thresholdBottomOffsetMeters"],
        "cameraReview": camera,
        "realSourcePBRGableInfillInBlender": True,
        "gableTimberBraceCount": gable["timberBraceCount"],
        "originalRoofAndWallMeshesUnchanged": True,
        "gablePlainPlasterNoUVTexture": True,
        "gableSourcePlasterUnchanged": True,
        "gableCenterPostRemoved": True,
        "gableSourceMatchedWeathered": True,
        "gableNoDarkApexAtlasStain": True,
        "gableApexSeamExtendedMeters": gable["roofApexSeamExtendedMeters"],
        "gableApexHiddenTipRiseMeters": gable["roofApexHiddenTipRiseMeters"],
        "gableApexHiddenTipForwardMeters": gable["roofApexHiddenTipForwardMeters"],
        "gableWeatheringWorldScale": gable["worldPositionWeatheringNoise"],
        "gableWeatheredDarkRGBA": gable["weatheredDarkRGBA"],
        "gableWeatheredLightRGBA": gable["weatheredLightRGBA"],
        "gablePlainWallRGBA": gable["plainPlasterWallRGBA"],
        "duskWindowAndDoorGlassFromGenuineBlender": True,
        "duskProceduralSmokeFromSourceChimney": True,
        "chimneySmokeAnimatedInGame": False,
        "images": {},
    }
    for mood, evidence in zip(("day","dusk"),captures):
        name = f"greyhaven-quaternius-cottage-{mood}.png"
        if evidence.get("name") != name:
            raise ValueError("source frame name/order drift")
        blob = (source / name).read_bytes()
        if len(blob) != evidence["bytes"] or sha(blob) != evidence["sha256"]:
            raise ValueError("native Blender day/dusk original PNG tampered")
        with Image.open(source / name) as input_image:
            if input_image.size != (640,640):
                raise ValueError("unexpected source Blender camera viewport")
            rgba = input_image.convert("RGBA")
            box = rgba.getchannel("A").getbbox()
            if box is None or box[2]-box[0] < 250 or box[3]-box[1] < 250:
                raise ValueError("original cottage missing, degenerate or entirely transparent")
            filename = f"greyhaven-quaternius-cottage-{mood}-2d5-review.webp"
            outfile = dest / filename
            rgba.save(outfile,format="WEBP",quality=90,method=6,exact=True)
            with Image.open(outfile) as readback:
                if readback.size != rgba.size:
                    raise ValueError("WebP output dimension corruption")
                if readback.convert("RGBA").getchannel("A").tobytes() != rgba.getchannel("A").tobytes():
                    raise ValueError("web sprite lost original fine alpha edges")
            image = outfile.read_bytes()
            if not 0 < len(image) < len(blob)*0.5:
                raise ValueError("review WebP did not meaningfully reduce source transfer size")
            result["images"][mood] = {
                "name": filename,
                "width":640,"height":640,"alphaBoundingBox":list(box),
                "sha256":sha(image),"bytes":len(image),
                "sourcePngSha256":sha(blob),"sourceBytes":len(blob)
            }
    # A reviewer can only consume the sprite pair as a standalone side-by-side art probe.
    (dest/"greyhaven-quaternius-2d5-review-manifest.json").write_text(
        json.dumps(result,indent=2)+"\n",encoding="utf-8")
    print("GRAPHICS3B_QUATERNIUS_GENUINE_2D5_PREVIEW_SPRITES_PASS "+json.dumps(result))


if __name__ == "__main__":
    run()

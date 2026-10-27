#!/usr/bin/env python3
"""Verify an immutable approved Blender R4 sprite review package.

No game-world authorization is inferred from presence of these files.
"""
import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def check(directory):
    manifest = json.loads((directory / "blacksmith-r4-blender-2d5-review-manifest.json")
                          .read_text(encoding="utf-8"))
    if (manifest.get("schema") != 1
        or manifest.get("kind") != "graphics3b-blacksmith-r4-original-blender-2d5-review"
        or manifest.get("approvedSourcePinnedCommit") != "21104b4045261c28fc312360841ed1a7b0ac8782"
        or manifest.get("importedCreatorModules") != 15
        or manifest.get("realCreatorVertices", 0) < 7000
        or manifest.get("ownerVisualDirectionApproved") is not True
        or manifest.get("originalDoorGlassAndRoofSmoke") is not True
        or manifest.get("realGeometryCollisionClearanceVerified") is not True
        or manifest.get("world9FacadeReplacementAuthorized") is not False
        or manifest.get("authoredWorldPlacementModified") is not False
        or manifest.get("realFourPlayerWorld9IntegrationTested") is not False
        or manifest.get("gameplayItemsPortalsCombatChanged") is not False
        or manifest.get("mergeDeployAuthorized") is not False):
        raise ValueError("Untrusted original Blender R4 provenance or game authority claim")
    world = manifest.get("readOnlyWorldReference", {})
    if (world.get("mapId"),world.get("candidateAuthoredId")) != (
            "moonvale-overworld", "smith"):
        raise ValueError("Wrong source-owned Blacksmith building reference")
    images=manifest.get("images",{})
    if sorted(images) != ["day", "dusk"]:
        raise ValueError("A native day and dusk preview pair is required")
    for mood in ("day","dusk"):
        record=images[mood]
        filename = "greyhaven-blacksmith-r4-" + mood + "-2d5-review.webp"
        if (record.get("file") != filename
            or record.get("width") != 640 or record.get("height") != 640
            or record.get("alphaPixelBytesUnchanged") is not True):
            raise ValueError("Native Blender frame identity invalid")
        blob=(directory / filename).read_bytes()
        if (len(blob) != record.get("spriteBytes")
            or sha256(blob) != record.get("spriteSha256")):
            raise ValueError("Review WebP diverged from native approved Blender result")
        if not blob.startswith(b"RIFF") or blob[8:12] != b"WEBP":
            raise ValueError("Not a real WebP")
        with Image.open(directory / filename) as img:
            if img.format != "WEBP" or img.size != (640,640):
                raise ValueError("WebP pixel geometry invalid")
            a=img.convert("RGBA").getchannel("A")
            actual=a.getbbox()
            if list(actual) != record.get("alphaBoundsPx") or min(a.getextrema())==255:
                raise ValueError("Original Blender alpha lost or bounds changed")
        if (not isinstance(record.get("sourceBlenderPngSha256"),str)
            or len(record["sourceBlenderPngSha256"]) != 64
            or record.get("sourceBytes",0) <= len(blob)):
            raise ValueError("Source archive signature/size invalid")
    if images["day"]["spriteSha256"] == images["dusk"]["spriteSha256"]:
        raise ValueError("Original render moods cannot share identical pixels")
    print("GRAPHICS3B_BLACKSMITH_R4_PINNED_REVIEW_WEBP_PACKAGE_PASS "
          + json.dumps({"day":images["day"]["spriteSha256"],
                        "dusk":images["dusk"]["spriteSha256"],
                        "bytes":images["day"]["spriteBytes"]+images["dusk"]["spriteBytes"],
                        "liveGameUnaffected":True}))


if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--directory",type=Path,required=True)
    args=parser.parse_args()
    check(args.directory)

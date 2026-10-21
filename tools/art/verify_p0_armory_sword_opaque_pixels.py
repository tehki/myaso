"""P0 Graphics 3C visual regression: genuine PNG-pixel opaque sword cores stay unaltered.
Consumes actual Chrome/Firefox screenshots from the pinned World493 vs
Graphics3C real-source art-only browser comparison. NO game/item authority.
Optional standalone Pillow QA; does not change production/CI browser tests.
"""
from __future__ import annotations

import hashlib
import json
import math
import sys
from pathlib import Path

from PIL import Image

if len(sys.argv) != 4:
    raise SystemExit("usage: verify_p0_armory_sword_opaque_pixels.py <3B508-exact-checkout> <browser-report> <out-json>")
art_root = Path(sys.argv[1])
report_path = Path(sys.argv[2])
out_file = Path(sys.argv[3])
report = json.loads(report_path.read_text(encoding="utf8"))
sword_path = art_root / "assets/environment/greyhaven/armory-p0/armory_sword.webp"
digest = hashlib.sha256(sword_path.read_bytes()).hexdigest()
assert digest == report["sourceHashes"]["graphics3bSword"]
sword = Image.open(sword_path).convert("RGBA")
assert sword.size == (42, 115)

pairs = []
for browser in sorted({case["browser"] for case in report["cases"]}):
    baseline = next(r for r in report["cases"] if r["browser"] == browser and r["variant"] == "world493")
    candidate = next(r for r in report["cases"] if r["browser"] == browser and r["variant"] == "graphics3c")
    assert baseline["swordRects"] == candidate["swordRects"], "Original art bounds changed by 3C"
    a = Image.open(report_path.parent / baseline["screenCaptured"]).convert("RGBA")
    b = Image.open(report_path.parent / candidate["screenCaptured"]).convert("RGBA")
    assert a.size == b.size == (640, 640)
    changed = sum(
        a.getpixel((x, y)) != b.getpixel((x, y))
        for y in range(640) for x in range(640)
    )
    assert changed > 5000, "Expected meaningful World vs 3C environmental differences"
    cores = []
    for sprite in baseline["swordRects"]:
        assert sprite["width"] == sword.width and sprite["height"] == sword.height
        sample_count = 0
        changed_core = 0
        for sy in range(2, sword.height-2):
            for sx in range(2, sword.width-2):
                # A 5x5 neighborhood of fully opaque input source pixels
                # guarantees that even bilinear interpolation cannot reveal
                # the background at the actual subpixel drawImage position.
                if any(sword.getpixel((sx+dx, sy+dy))[3] != 255
                       for dy in range(-2, 3) for dx in range(-2, 3)):
                    continue
                px = math.floor(sprite["x"] + sx + .5)
                py = math.floor(sprite["y"] + sy + .5)
                assert 0 <= px < 640 and 0 <= py < 640
                sample_count += 1
                if a.getpixel((px,py)) != b.getpixel((px,py)):
                    changed_core += 1
        assert sample_count > 150, "Insufficient true opaque source sword core samples"
        assert changed_core == 0, ("3C world layer changed opaque original sword pixel",
                                  browser,sprite["id"],changed_core)
        cores.append({"artOnlySwordId": sprite["id"],
                      "verifiedFullyOpaqueInteriorPixels":sample_count,
                      "changedPixels":changed_core})
    pairs.append({"browser":browser, "changedScenePixels":changed,
                  "opaqueSwordCores":cores,
                  "serverItemPixelsClaimed":0,"actualPickupTested":False})
result = {
    "status":"GFX3C_ORIGINAL_WEBP_OPAQUE_SWORD_CORE_PASSED",
    "worldHead":report["pins"]["world"],"graphics3bHead":report["pins"]["graphics3b"],
    "graphics3cHeadAtCapture":report["pins"]["graphics3c"],
    "sourceSwordSha256":digest,"browsers":pairs,
    "limitations":"Art-only sample sprites over real World and 3C cached Canvas; no gameplay equip, collision, source item presence, or authoritative pickup",
    "integrationReady":False,
}
out_file.parent.mkdir(parents=True, exist_ok=True)
out_file.write_text(json.dumps(result, indent=2) + "\n", encoding="utf8")
print(json.dumps({ "status":result["status"],
    "summary":[{"browser":r["browser"],"sceneChanged":r["changedScenePixels"],
                "swordCores":sum(s["verifiedFullyOpaqueInteriorPixels"] for s in r["opaqueSwordCores"])}
               for r in pairs]},indent=2))

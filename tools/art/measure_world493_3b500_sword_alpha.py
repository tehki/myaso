"""Optional P0 art-only collision test of the real Graphics 3B #500 sword WebP.
Consumes pinned Graphics 3B WebP and the prior World #493 projection JSON;
never synthesizes sword IDs, gameplay state, clicks, or authoritative items.
Requires Pillow; not part of mandatory production CI.
"""
import hashlib
import json
import math
import sys
from pathlib import Path

from PIL import Image

if len(sys.argv) != 4:
    raise SystemExit("usage: measure_world493_3b500_sword_alpha.py <pinned3b-worktree> <pinned3c-source-art-JSON> <output-JSON>")
art_dir = Path(sys.argv[1])
source = json.loads(Path(sys.argv[2]).read_text(encoding="utf8"))
sword_path = art_dir / "assets/environment/greyhaven/armory-p0/armory_sword.webp"
blob = sword_path.read_bytes()
sword_sha = hashlib.sha256(blob).hexdigest()
assert sword_sha == source["originalAssetHashes"]["sword"]["sha256"], "Source WebP digest mismatch"
im = Image.open(sword_path).convert("RGBA")
assert im.size == (42, 115), "3B actual sword dimensions changed"
alpha = im.getchannel("A")
cutoff = 64
opaque_points = [(x, y) for y in range(im.height) for x in range(im.width)
                 if alpha.getpixel((x, y)) >= cutoff]
assert opaque_points
bbox = (min(x for x,y in opaque_points), min(y for x,y in opaque_points),
        max(x for x,y in opaque_points) + 1, max(y for x,y in opaque_points) + 1)
source_px = [item["screenAnchor"]["x"] for item in source["projected"]]
all_pairs = []
for left, right in zip(source_px, source_px[1:]):
    gap = right - left
    assert math.isclose(gap, 33.6, abs_tol=1e-7)
    offsets = sorted({math.floor(gap), math.ceil(gap)})
    ambiguous = {}
    for offset in offsets:
        shared = 0
        for y in range(im.height):
            for x in range(offset, im.width):
                if alpha.getpixel((x, y)) >= cutoff and alpha.getpixel((x-offset, y)) >= cutoff:
                    shared += 1
        ambiguous[str(offset)] = shared
    all_pairs.append({"anchorGapPx": gap, "overlappingRectWidthPx": im.width-gap,
                      "testPixelOffsets": offsets, "ambiguousOpaquePixels": ambiguous})
assert all(all(value == 0 for value in item["ambiguousOpaquePixels"].values())
           for item in all_pairs), "Real opaque sword pixels overlap; requires 3B/World re-layout"
out = {
    "status": "ART_SOURCE_ALPHA_SPACING_PASS_ONLY",
    "sourceWebpSha256": sword_sha,
    "sourceSize": list(im.size),
    "hitThresholdAlpha": cutoff,
    "opaqueBoundingBoxSource": list(bbox),
    "countOpaqueSourcePixels": len(opaque_points),
    "adjacentPairs": all_pairs,
    "doesNotProve": ["actual painter depth/occlusion", "real canvas click",
                     "authoritative ItemId", "server pickup", "Chrome+Firefox gameplay"],
    "integrationReady": False,
}
dest = Path(sys.argv[3]); dest.parent.mkdir(parents=True,exist_ok=True)
dest.write_text(json.dumps(out, indent=2)+"\n", encoding="utf8")
print(json.dumps(out,indent=2))

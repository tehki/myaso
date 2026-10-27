#!/usr/bin/env python3
"""Original-source P1 Ranger 8-view STATIC rest-pose review, never gameplay sprites.

Requires a PRIVATE staged, reduced-texture glTF copy from the approved free
Quaternius Standard ZIP. Geometry and .bin must be byte-identical to originals;
texture resize is a reversible preview derivative recorded by the operator.
No playable animation or Combat/World integration occurs.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import math
import os
import time
from pathlib import Path

DIRECTIONS = 8
CELL = 160


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def validate_source(model: Path) -> dict:
    if model.name not in ("Male_Ranger.gltf", "Female_Ranger.gltf",
                          "Male_Peasant.gltf", "Female_Peasant.gltf"):
        raise ValueError("Only four owner-approved complete free Standard outfits")
    if not model.is_file():
        raise FileNotFoundError(model)
    metadata = json.loads(model.read_text(encoding="utf-8"))
    if len(metadata.get("skins", [])) != 1 or not metadata.get("meshes"):
        raise ValueError("Need exactly one original skinned outfit")
    deps = []
    for item in metadata.get("buffers", []) + metadata.get("images", []):
        uri = item.get("uri")
        if not isinstance(uri, str) or uri.startswith(("/", ".")) or (
            "/" in uri or "\\" in uri or ":" in uri or uri in (".", "..")
        ):
            raise ValueError("Nonlocal/ambiguous glTF dependencies are forbidden")
        dep = model.parent / uri
        if not dep.is_file() or dep.is_symlink():
            raise ValueError(f"Missing or unsafe glTF dependency: {uri!r}")
        deps.append({"name": uri, "sha256": sha256(dep.read_bytes()),
                     "bytes": dep.stat().st_size})
    if not deps:
        raise ValueError("Missing original mesh/texture dependencies")
    return {"model": str(model), "model_sha256": sha256(model.read_bytes()),
            "dependency_hashes": deps}


def render(model: Path, output: Path) -> dict:
    # Headless library imports only here. Protected CI validates the source
    # without ever fetching or executing third-party asset content.
    os.environ.setdefault("PYOPENGL_PLATFORM", "egl")
    # The Intel X230i Mesa EGL driver requires its software-context fallback.
    os.environ.setdefault("LIBGL_ALWAYS_SOFTWARE", "1")
    import numpy as np
    import pyrender
    import trimesh
    from PIL import Image

    source = trimesh.load(str(model), file_type="gltf",
                          force="scene", process=False)
    bounds = source.bounds
    if bounds is None:
        raise ValueError("No imported mesh geometry")
    center = np.asarray((bounds[0] + bounds[1]) / 2, dtype=float)
    height = float(bounds[1][1] - bounds[0][1])
    if not 0.75 <= height <= 5.0:
        raise ValueError("Source is not at expected original humanoid game scale")
    geometries = [pyrender.Mesh.from_trimesh(piece, smooth=False)
                  for piece in source.dump()
                  if isinstance(piece, trimesh.Trimesh) and len(piece.faces)]
    if not geometries:
        raise ValueError("No original triangle meshes found")

    def look_at(eye, target):
        up = np.asarray([0., 1., 0.])
        z = (eye - target)
        z /= np.linalg.norm(z)
        x = np.cross(up, z)
        x /= np.linalg.norm(x)
        y = np.cross(z, x)
        transform = np.eye(4)
        transform[:3, :3] = np.stack((x, y, z), axis=1)
        transform[:3, 3] = eye
        return transform

    eye = center + np.asarray([0., height * .13, max(height * 2.8, 3.5)])
    camera_pose = look_at(eye, center)
    span = max(height * 1.2, 1.8)
    camera = pyrender.OrthographicCamera(xmag=span * .61,
                                         ymag=span * .61,
                                         znear=.02, zfar=50)
    result = []
    sheet = Image.new("RGBA", (DIRECTIONS * CELL, CELL), (35, 38, 49, 255))
    output.mkdir(parents=True, exist_ok=True)
    renderer = pyrender.OffscreenRenderer(viewport_width=CELL,
                                          viewport_height=CELL,
                                          point_size=1)
    try:
        for row in range(DIRECTIONS):
            world = pyrender.Scene(bg_color=[.11, .13, .16, 0.],
                                   ambient_light=[.38, .38, .40])
            angle = row * math.pi / 4
            c, s = math.cos(angle), math.sin(angle)
            rot = np.eye(4)
            rot[:3, :3] = [[c, 0, s], [0, 1, 0], [-s, 0, c]]
            to_center = np.eye(4)
            to_center[:3, 3] = center
            from_center = np.eye(4)
            from_center[:3, 3] = -center
            pose = to_center @ rot @ from_center
            for geometry in geometries:
                world.add(geometry, pose=pose)
            world.add(camera, pose=camera_pose)
            world.add(pyrender.DirectionalLight(color=np.ones(3), intensity=2.5),
                      pose=look_at(center + np.asarray([3., 5., 4.]), center))
            world.add(pyrender.DirectionalLight(color=np.asarray([.65, .75, 1.]),
                                                intensity=1.),
                      pose=look_at(center + np.asarray([-3., 2., -2.]), center))
            start = time.monotonic()
            pixels, _ = renderer.render(world, flags=pyrender.RenderFlags.RGBA)
            coverage = int((pixels[:, :, 3] > 0).sum())
            if not 250 <= coverage <= 20_000:
                raise ValueError(f"Row {row} blank or badly clipped: {coverage}")
            picture = Image.fromarray(pixels, mode="RGBA")
            path = output / f"rest_{row:02d}.png"
            picture.save(path)
            sheet.paste(picture, (row * CELL, 0), picture)
            result.append({"direction_row": row, "sha256": sha256(path.read_bytes()),
                           "alpha_coverage_pixels": coverage,
                           "offline_render_seconds": round(time.monotonic()-start, 3)})
    finally:
        renderer.delete()

    sheet_path = output / "static_eight_view_contact_sheet.png"
    sheet.save(sheet_path)
    return {
        "eight_direction_static_rest": result,
        "sheet": str(sheet_path),
        "sheet_sha256": sha256(sheet_path.read_bytes()),
        "original_scene_bounds": bounds.tolist(),
        "note": "Rendered source geometry with private lookdev textures. Not an animated sprite atlas.",
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", type=Path, required=True,
                        help="Private review glTF (512px preview textures, original geometry)")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--inspect-only", action="store_true",
                        help="No EGL renderer required; inspect source references only")
    args = parser.parse_args()
    result = validate_source(args.model)
    result["release_status"] = "HOLD_P1_OFFLINE_VISUAL_ONLY"
    result["limitations"] = (
        "No true animation, bind-pose retarget, physical floor/grounded shadow, "
        "original full-Canvas frame intervals or multiplayer qualification"
    )
    if not args.inspect_only:
        result.update(render(args.model, args.output))
    args.output.mkdir(parents=True, exist_ok=True)
    report = args.output / "static-review.json"
    report.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": result["release_status"],
                      "report": str(report),
                      "frames": len(result.get("eight_direction_static_rest", []))}))


if __name__ == "__main__":
    main()

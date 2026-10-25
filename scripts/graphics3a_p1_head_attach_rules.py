"""Pure source-safety rules for Graphics 3A P1 headless outfit head lookdev.

No third-party asset bytes, Blender, PyOpenGL, PIL, numpy or game-runtime imports.
P1 offline art only: these checks do not authorize player model replacement.
"""
import math
from pathlib import PurePosixPath


def archive_uri(prefix: str, uri: str) -> str:
    """Allow a local ZIP dependency inside the already chosen publisher folder."""
    if not isinstance(uri, str) or not uri or uri.startswith("/") or ":" in uri or "\\" in uri:
        raise ValueError("Only local relative archive dependency URIs are permitted")
    parts = PurePosixPath(uri).parts
    if not parts or any(part in ("", ".", "..") for part in parts):
        raise ValueError("Unsafe archive dependency")
    if prefix.startswith("/") or ".." in PurePosixPath(prefix).parts:
        raise ValueError("Unsafe archive member prefix")
    return prefix + uri


def head_cut_from_mesh_top(top_y: float, clearance: float = 0.02) -> float:
    """Static lookdev cut above an outfit's top; not a neck seam approval."""
    if not (math.isfinite(top_y) and math.isfinite(clearance) and clearance >= 0):
        raise ValueError("Invalid geometry cutoff")
    return float(top_y + clearance)


def remap_joint_indices(source_names: list[str], target_names: list[str]) -> list[int]:
    """Copy no original joint-index assumptions when attaching base head."""
    if not source_names or len(set(source_names)) != len(source_names):
        raise ValueError("Source joint names must be present and unique")
    if len(set(target_names)) != len(target_names):
        raise ValueError("Target joint names must be unique")
    if set(source_names) != set(target_names):
        raise ValueError("Base and outfit bone names differ")
    return [target_names.index(name) for name in source_names]


def choose_head_faces(centroid_y, cut_y: float) -> list[int]:
    """Choose upper faces only; reject non-finite geometry rather than bypassing it."""
    if not math.isfinite(cut_y):
        raise ValueError("Invalid head cutoff")
    result = []
    for index, value in enumerate(centroid_y):
        if not math.isfinite(float(value)):
            raise ValueError("Non-finite face-centroid position")
        if value > cut_y:
            result.append(index)
    return result


def validate_upper_anchors(base_points, outfit_points, names, tolerance: float = 0.01):
    """Upper named joints must match before using base head on outfit skeleton."""
    if not math.isfinite(tolerance) or tolerance < 0:
        raise ValueError("Invalid upper anchor tolerance")
    result = {}
    for name in names:
        if name not in base_points or name not in outfit_points:
            raise ValueError(f"Missing required upper anchor: {name}")
        left, right = base_points[name], outfit_points[name]
        if len(left) < 3 or len(right) < 3:
            raise ValueError(f"Invalid upper anchor vector: {name}")
        if not all(math.isfinite(float(x)) for x in (*left[:3], *right[:3])):
            raise ValueError(f"Nonfinite upper anchor vector: {name}")
        distance = math.sqrt(sum((float(a)-float(b))**2 for a,b in zip(left[:3], right[:3])))
        if distance > tolerance:
            raise ValueError(f"Upper skeleton anchor {name} differs by {distance:.4f}m")
        result[name] = distance
    return result

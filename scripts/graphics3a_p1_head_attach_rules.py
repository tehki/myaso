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

def allowed_head_mesh_names(mode: str) -> tuple[str, ...]:
    """Explicit review-only filtering for separate Quaternius face parts.

    The source's entire body/head skin mesh stays present even when eyebrow
    or eye accessories are isolated. This does not edit or accept game assets.
    """
    bodies = ("SuperHero_Male", "Superhero_Female")
    if mode == "all":
        return ("Eyebrows", "Eyes", *bodies)
    if mode == "without-eyebrows":
        return ("Eyes", *bodies)
    if mode == "head-only":
        return bodies
    raise ValueError("Unknown offline face-component review mode")

def light_base_atlas_member(model_prefix: str, original_texture: str) -> str:
    """Use ONLY exact alternate textures bundled in the approved Standard ZIP.

    This is a private visual A/B test of publisher Dark vs Light, not
    inferred recoloring, authoring a new atlas, or runtime asset selection.
    """
    marker = "Base Characters/Godot - UE/"
    if not isinstance(model_prefix, str) or not model_prefix.endswith(marker):
        raise ValueError("Unexpected publisher Base Character model folder")
    atlas = {
        "T_Superhero_Male_Dark.png": "T_Superhero_Male_Ligh.png",
        "T_Superhero_Female_Dark_BaseColor.png": "T_Superhero_Female_Light_BaseColor.png",
    }
    if original_texture not in atlas:
        raise ValueError("No approved Base Character light atlas mapping for this texture")
    # Exact original author folder: no caller-derived URL or arbitrary filename.
    base = model_prefix[:-len(marker)]
    return base + "Base Characters/Textures/" + atlas[original_texture]

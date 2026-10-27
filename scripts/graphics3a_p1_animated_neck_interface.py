"""Offline numeric animated neck seam check for Graphics 3A P1.

Pure, source-only: expects already constructed original head/torso caps and
independently sampled local joint palettes. Does not fetch/export vendor assets,
modify game runtime, or establish visual, animation, or release approval.
"""
import math
from graphics3a_p1_lower_body_neck_cap import verify_matching_head_torso_caps


def _key(pos):
    return tuple(round(float(v), 6) for v in pos)


def _palette_matrices(palette, used_joints):
    if not isinstance(palette, dict):
        raise ValueError("Sampled joint palette must be a dictionary")
    result = {}
    for joint in used_joints:
        if joint not in palette:
            raise ValueError("Sampled pose is missing a weighted joint")
        matrix = palette[joint]
        if (not isinstance(matrix, (tuple, list)) or len(matrix) != 3 or
                any(not isinstance(row, (tuple, list)) or len(row) != 4
                    for row in matrix)):
            raise ValueError("Invalid 3x4 joint matrix")
        try:
            rows = tuple(tuple(float(v) for v in row) for row in matrix)
        except (ValueError, TypeError, OverflowError) as exc:
            raise ValueError("Invalid numeric joint matrix") from exc
        if not all(math.isfinite(v) for row in rows for v in row):
            raise ValueError("Nonfinite sampled joint matrix")
        result[joint] = rows
    return result


def _posed_vertices(cap, palette):
    used = set()
    for joints, weights in zip(cap["joints"], cap["weights"]):
        if len(joints) != 4 or len(weights) != 4:
            raise ValueError("Four source skin influences are required")
        if not all(isinstance(j, int) and not isinstance(j, bool) for j in joints):
            raise ValueError("Invalid source joint ID")
        if not all(isinstance(w, (int, float)) and math.isfinite(w) and w >= 0
                   for w in weights):
            raise ValueError("Invalid source skin weight")
        if not .999 <= sum(weights) <= 1.001:
            raise ValueError("Non-normalized skin weights")
        used.update(j for j, w in zip(joints, weights) if w > 0)
    matrices = _palette_matrices(palette, used)
    vertices = {}
    for pos, joints, weights in zip(cap["positions"], cap["joints"], cap["weights"]):
        x, y, z = (float(v) for v in pos)
        if not all(math.isfinite(v) for v in (x, y, z)):
            raise ValueError("Nonfinite original position")
        out = [0., 0., 0.]
        for joint, weight in zip(joints, weights):
            if not weight:
                continue
            for axis, (a, b, c, d) in enumerate(matrices[joint]):
                out[axis] += weight * (a*x + b*y + c*z + d)
        vertices[_key(pos)] = tuple(out)
    return vertices


def verify_animated_head_torso_seam(head_cap, torso_cap, sampled_poses,
                                    tolerance_m=1e-4):
    """Fail if attached caps diverge under independently supplied joint palettes.

    Each sample: {"name": str, "head_matrices": {joint: 3x4 matrix},
    "torso_matrices": {joint: 3x4 matrix}}. Use real pose samples from
    source authoring tools for later qualification. Artificial samples only
    validate this checker, not the publisher animations or in-game artwork.
    """
    verify_matching_head_torso_caps(head_cap, torso_cap)
    if (not isinstance(tolerance_m, (int, float)) or
            isinstance(tolerance_m, bool) or not math.isfinite(tolerance_m) or
            not 0 < tolerance_m <= .01):
        raise ValueError("Invalid animated seam tolerance")
    if not isinstance(sampled_poses, (list, tuple)) or not 1 <= len(sampled_poses) <= 64:
        raise ValueError("Provide 1 to 64 independently sampled motion poses")
    seen = set()
    measurements = []
    for sample in sampled_poses:
        if not isinstance(sample, dict):
            raise ValueError("Sampled pose must be a dictionary")
        name = sample.get("name")
        if not isinstance(name, str) or not name.strip() or name in seen:
            raise ValueError("Missing or duplicate sampled motion label")
        seen.add(name)
        head = _posed_vertices(head_cap, sample.get("head_matrices"))
        torso = _posed_vertices(torso_cap, sample.get("torso_matrices"))
        if set(head) != set(torso):
            raise ValueError("Animated cap source boundaries differ")
        separation = max(math.dist(head[key], torso[key]) for key in head)
        if not math.isfinite(separation) or separation > tolerance_m:
            raise ValueError("Animated head/torso seam diverged in pose " + name)
        measurements.append({"name": name,
                             "max_boundary_separation_m": separation})
    return {
        "sampled_pose_count": len(measurements),
        "boundary_vertex_count": len(head),
        "max_boundary_separation_m":
            max(sample["max_boundary_separation_m"] for sample in measurements),
        "poses": measurements,
        "status": "NUMERIC_POSE_SEAM_ONLY_ART_AND_NATIVE_HOLD",
    }

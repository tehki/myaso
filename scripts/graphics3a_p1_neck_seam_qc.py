"""Offline numeric neck-collar proximity diagnostics for Graphics 3A P1.

Measures nearest garment *vertices* to open cut-boundary vertices of an attached
head in the original rig's rest pose. This is diagnostic only: a nearby vertex
does not establish a watertight seam, clipping-free motion, or artistic quality.

Pure standard-library math; NO vendor assets, engine, GPU or runtime imports.
"""
import math


def _point(point):
    if len(point) < 3:
        raise ValueError("Expected 3D coordinates")
    xyz = tuple(float(v) for v in point[:3])
    if not all(math.isfinite(v) for v in xyz):
        raise ValueError("Non-finite source mesh vertex")
    return xyz


def open_edge_vertex_indices(faces, vertex_count: int) -> list[int]:
    """Open mesh boundary vertices, rejecting broken triangle topology."""
    if not isinstance(vertex_count, int) or vertex_count <= 0:
        raise ValueError("Vertex count must be positive")
    edges = {}
    count = 0
    for face in faces:
        if len(face) != 3:
            raise ValueError("Only triangular source mesh faces are supported")
        ids = [int(v) for v in face]
        if any(v != original for v, original in zip(ids, face)):
            raise ValueError("Noninteger face index")
        if len(set(ids)) != 3 or any(i < 0 or i >= vertex_count for i in ids):
            raise ValueError("Degenerate or out-of-bounds triangle")
        for a,b in ((ids[0],ids[1]),(ids[1],ids[2]),(ids[2],ids[0])):
            edge = (a,b) if a < b else (b,a)
            edges[edge] = edges.get(edge, 0) + 1
            if edges[edge] > 2:
                raise ValueError("Nonmanifold cut mesh (edge used by more than two triangles)")
        count += 1
    if count == 0:
        raise ValueError("No head body faces remain after geometric cut")
    return sorted({v for (a,b), n in edges.items() if n == 1 for v in (a,b)})


def neck_collar_proximity(
    head_vertices, head_faces, outfit_vertices, cut_y: float,
    cut_band_m: float = 0.10, outfit_band_below_m: float = 0.20,
) -> dict:
    """Nearest-vertex distance near the base head cut, not a seam acceptance.

    The head and outfit vertices must already be in the SAME world/rest
    coordinate system. A 3D Euclidean nearest-vertex distance ignores
    intervening garment face interiors and could overestimate the actual gap;
    near-zero distances can still conceal intersecting surfaces.
    """
    if not all(math.isfinite(v) for v in (cut_y, cut_band_m, outfit_band_below_m)):
        raise ValueError("Non-finite seam band/cut")
    if not (0.01 <= cut_band_m <= 0.5 and 0.01 <= outfit_band_below_m <= 0.75):
        raise ValueError("Invalid seam sample bands")
    head = [_point(vertex) for vertex in head_vertices]
    outfit = [_point(vertex) for vertex in outfit_vertices]
    boundary = open_edge_vertex_indices(head_faces, len(head))
    # Restrict seam measurement to open edges around the actual cut. Open
    # edges elsewhere (eyes, ears, etc.) are not collar seams.
    rim = [
        head[i] for i in boundary
        if (cut_y - cut_band_m) <= head[i][1] <= (cut_y + cut_band_m)
    ]
    candidates = [
        v for v in outfit if (cut_y - outfit_band_below_m) <= v[1] <= (cut_y + cut_band_m)
    ]
    if not boundary or not rim:
        raise ValueError("No open head cut boundary in requested collar band")
    if not candidates:
        raise ValueError("No outfit geometry near the collar band")
    nearest = []
    for v in rim:
        distance_sq = min(
            (v[0]-c[0])**2 + (v[1]-c[1])**2 + (v[2]-c[2])**2
            for c in candidates
        )
        nearest.append(math.sqrt(distance_sq))
    nearest.sort()
    def percentile(frac):
        rank = frac * (len(nearest) - 1)
        lo = int(math.floor(rank))
        hi = int(math.ceil(rank))
        return nearest[lo] + (nearest[hi]-nearest[lo])*(rank-lo)
    return {
        "verdict": "ART_DIRECTOR_SEAM_INSPECTION_REQUIRED",
        "measurement": "rest-pose nearest outfit vertex to open head-cut boundary vertex (meters)",
        "cut_height_m": float(cut_y),
        "total_head_open_boundary_vertices": len(boundary),
        "sampled_neck_boundary_vertices": len(rim),
        "outfit_neck_band_vertices": len(candidates),
        "nearest_garment_vertex_distance_min_m": nearest[0],
        "nearest_garment_vertex_distance_p50_m": percentile(.5),
        "nearest_garment_vertex_distance_p95_m": percentile(.95),
        "nearest_garment_vertex_distance_max_m": nearest[-1],
        "neck_boundary_over_2cm_fraction": sum(v > .02 for v in nearest) / len(nearest),
        "neck_boundary_over_5cm_fraction": sum(v > .05 for v in nearest) / len(nearest),
        "limitations": [
            "Nearest mesh vertices are not a surface-to-surface signed distance.",
            "This check cannot prove watertightness, absence of penetration, material continuity, or aesthetics.",
            "Rest pose only: animated seam quality requires independently sampled action phases.",
            "Source-only geometry diagnostic; does not authorize gameplay or release.",
        ],
    }

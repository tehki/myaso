"""Unsigned head-to-outfit TRIANGLE surface proximity, offline art HOLD.

Pure stdlib so protected CI uses synthetic geometry without vendor assets.
Quantifies distance from actual open cut vertices to nearby garment triangle
surfaces. Values are unsigned, and neither gap width nor penetration proof.
"""
import math
from graphics3a_p1_neck_seam_qc import open_edge_vertex_indices


def _point(value):
    if len(value) < 3:
        raise ValueError("Three-dimensional vertex is required")
    result = tuple(float(v) for v in value[:3])
    if not all(math.isfinite(v) for v in result):
        raise ValueError("Nonfinite triangle mesh coordinates")
    return result


def _subtract(a, b):
    return (a[0]-b[0], a[1]-b[1], a[2]-b[2])


def _dot(a, b):
    return a[0]*b[0] + a[1]*b[1] + a[2]*b[2]


def _d2(a, b):
    return _dot(_subtract(a, b), _subtract(a, b))


def _point_triangle_squared(point, a, b, c):
    """Squared Euclidean point-to-triangle distance (Ericson region tests).

    Degenerate triangles are rejected rather than silently presenting a
    fabricated nearest surface.
    """
    ab, ac, ap = _subtract(b, a), _subtract(c, a), _subtract(point, a)
    aa, bb, cc = _dot(ab, ab), _dot(ac, ac), _dot(ab, ac)
    if aa * bb - cc * cc <= 1e-18:
        raise ValueError("Degenerate target triangle")
    d1, d2 = _dot(ab, ap), _dot(ac, ap)
    if d1 <= 0.0 and d2 <= 0.0:
        return _d2(point, a)
    bp = _subtract(point, b)
    d3, d4 = _dot(ab, bp), _dot(ac, bp)
    if d3 >= 0.0 and d4 <= d3:
        return _d2(point, b)
    vc = d1*d4 - d3*d2
    if vc <= 0.0 and d1 >= 0.0 and d3 <= 0.0:
        v = d1/(d1-d3)
        closest = (a[0]+v*ab[0], a[1]+v*ab[1], a[2]+v*ab[2])
        return _d2(point, closest)
    cp = _subtract(point, c)
    d5, d6 = _dot(ab, cp), _dot(ac, cp)
    if d6 >= 0.0 and d5 <= d6:
        return _d2(point, c)
    vb = d5*d2 - d1*d6
    if vb <= 0.0 and d2 >= 0.0 and d6 <= 0.0:
        w = d2/(d2-d6)
        closest = (a[0]+w*ac[0], a[1]+w*ac[1], a[2]+w*ac[2])
        return _d2(point, closest)
    va = d3*d6 - d5*d4
    if va <= 0.0 and d4-d3 >= 0.0 and d5-d6 >= 0.0:
        bc = _subtract(c,b)
        w = (d4-d3)/((d4-d3)+(d5-d6))
        closest = (b[0]+w*bc[0], b[1]+w*bc[1], b[2]+w*bc[2])
        return _d2(point, closest)
    denom = 1.0/(va+vb+vc)
    v,w = vb*denom, vc*denom
    closest = (a[0]+ab[0]*v+ac[0]*w, a[1]+ab[1]*v+ac[1]*w, a[2]+ab[2]*v+ac[2]*w)
    return _d2(point, closest)


def _percentile(values, fraction):
    rank=fraction*(len(values)-1)
    lo,hi=int(math.floor(rank)),int(math.ceil(rank))
    return values[lo]+(values[hi]-values[lo])*(rank-lo)


def collar_surface_proximity(
    head_vertices, head_faces, outfit_vertices, outfit_faces, cut_y,
    cut_band_m=0.10, outfit_band_below_m=0.20,
):
    """Distance from each head cut-boundary sample to collar-band garment triangles.

    Coordinates are the SAME rest-world space, not posed-local mix.
    Evaluates all nondegenerate triangles intersecting [cut-.2,cut+.1] in Y,
    with axis-aligned box lower-bound pruning that cannot discard a nearer face.
    """
    if not all(math.isfinite(float(x)) for x in (cut_y,cut_band_m,outfit_band_below_m)):
        raise ValueError("Nonfinite collar measurement arguments")
    if not (0.01<=cut_band_m<=0.5 and 0.01<=outfit_band_below_m<=0.75):
        raise ValueError("Invalid collar sample window")
    head=[_point(v) for v in head_vertices]
    outfit=[_point(v) for v in outfit_vertices]
    boundary=open_edge_vertex_indices(head_faces,len(head))
    rim=[head[i] for i in boundary if cut_y-cut_band_m<=head[i][1]<=cut_y+cut_band_m]
    if not rim:
        raise ValueError("No open head-cut boundary near collar")
    triangles=[]
    degenerate=0
    lower,upper=cut_y-outfit_band_below_m,cut_y+cut_band_m
    for face in outfit_faces:
        if len(face)!=3:
            raise ValueError("Outfit must have triangle faces")
        idx=tuple(int(i) for i in face)
        if any(i<0 or i>=len(outfit) or i!=orig for i,orig in zip(idx,face)):
            raise ValueError("Invalid triangle face index")
        if len(set(idx))!=3:
            degenerate+=1
            continue
        a,b,c=(outfit[i] for i in idx)
        if max(a[1],b[1],c[1])<lower or min(a[1],b[1],c[1])>upper:
            continue
        ab,ac=_subtract(b,a),_subtract(c,a)
        if _dot(ab,ab)*_dot(ac,ac)-_dot(ab,ac)**2<=1e-18:
            degenerate+=1
            continue
        mins=tuple(min(a[k],b[k],c[k]) for k in range(3))
        maxs=tuple(max(a[k],b[k],c[k]) for k in range(3))
        triangles.append((a,b,c,mins,maxs))
    if not triangles:
        raise ValueError("No nondegenerate garment triangles near collar")
    values=[]
    for point in rim:
        best=float("inf")
        for a,b,c,mins,maxs in triangles:
            # Squared distance to triangle's AABB is a conservative lower
            # bound on squared distance to the actual triangle.
            bbox_d2=sum((mins[k]-point[k])**2 if point[k]<mins[k] else
                        (point[k]-maxs[k])**2 if point[k]>maxs[k] else 0.0
                        for k in range(3))
            if bbox_d2>=best:
                continue
            best=min(best,_point_triangle_squared(point,a,b,c))
        if not math.isfinite(best):
            raise ValueError("No valid collar-surface nearest point")
        values.append(math.sqrt(max(0.0,best)))
    values.sort()
    return {
        "verdict":"ART_DIRECTOR_SURFACE_SEAM_INSPECTION_REQUIRED",
        "method":"unsigned closest triangle-surface distance from head open-boundary vertices (rest-world) to garment triangles overlapping collar Y band",
        "head_neck_cut_boundary_sample_count":len(rim),
        "garment_candidate_triangle_count":len(triangles),
        "ignored_degenerate_triangle_count":degenerate,
        "cut_height_m":float(cut_y),
        "surface_distance_min_m":values[0],
        "surface_distance_p50_m":_percentile(values,.5),
        "surface_distance_p95_m":_percentile(values,.95),
        "surface_distance_max_m":values[-1],
        "samples_over_2cm_fraction":sum(v>.02 for v in values)/len(values),
        "samples_over_5cm_fraction":sum(v>.05 for v in values)/len(values),
        "limitations":[
            "Unsigned sample-to-triangle distance is not signed penetration, gap visibility or watertightness proof.",
            "Only garment triangles overlapping the chosen collar Y band were considered.",
            "A close head cut to garment surface can still intersect, z-fight, shade differently or detach during animation.",
            "Rest pose only; real UAL1 animation phase and direction-specific seam checks remain mandatory.",
            "Always ART HOLD until physical/visual Art Director and Main Orchestrator acceptance.",
        ],
    }

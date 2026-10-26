"""Build a TRUE geometric head-neck cut cap from original clipped skinned GLTF.

OFFLINE P1 ART PROTOTYPE ONLY. No source ZIP/glTF changes, runtime export,
blood, Combat events, physics, or production/owner GO.

Prerequisite: an already clipped upper head shell. This module fails closed
unless every geometric boundary is a validated simple non-overlapping planar loop.
The cap uses the clipped mesh's own boundary skin influences (not guessed
rig binding) and projects planar UVs. No sewn body collar or separated
torso geometry is generated here.
"""
from collections import Counter, defaultdict
import math


def _position_key(pos):
    if len(pos) != 3 or not all(math.isfinite(float(a)) for a in pos):
        raise ValueError("Invalid or nonfinite cap position")
    return tuple(round(float(a), 7) for a in pos)


def _signed_area(ring):
    return .5*sum(
        p[0]*ring[(i+1)%len(ring)][2] - ring[(i+1)%len(ring)][0]*p[2]
        for i,p in enumerate(ring)
    )


def _cross_2d(a,b,c):
    return ((b[0]-a[0])*(c[2]-a[2])
            - (b[2]-a[2])*(c[0]-a[0]))


def _inside_triangle(point,a,b,c,tol):
    # Inclusive: refuse an ear if another boundary vertex lies on its edge.
    return (_cross_2d(a,b,point)>=-tol and
            _cross_2d(b,c,point)>=-tol and
            _cross_2d(c,a,point)>=-tol)


def _segments_cross(a,b,c,d,epsilon=1e-10):
    # Open line-segment intersection in the x/z plane.
    ab_c=_cross_2d(a,b,c);ab_d=_cross_2d(a,b,d)
    cd_a=_cross_2d(c,d,a);cd_b=_cross_2d(c,d,b)
    return ((ab_c>epsilon and ab_d<-epsilon or
             ab_c<-epsilon and ab_d>epsilon) and
            (cd_a>epsilon and cd_b<-epsilon or
             cd_a<-epsilon and cd_b>epsilon))


def geometric_neck_cap(clipped, cut_y, tolerance=1e-5):
    """Return a separate original-boundary-skinned downward-facing cap.

    Validated geometric closure is topological/planar only. A skinned cap
    could still distort or intersect clothing in dynamic poses: ART HOLD.
    """
    if not math.isfinite(float(cut_y)) or not 0 < tolerance <= 1e-3:
        raise ValueError("Invalid collar-plane tolerance")
    names=("positions","normals","uv","joints","weights","faces")
    if not isinstance(clipped,dict) or any(k not in clipped for k in names):
        raise ValueError("Complete original skinned clipped mesh is required")
    pos=clipped["positions"];norm=clipped["normals"]
    uvs=clipped["uv"];joints=clipped["joints"];weights=clipped["weights"]
    faces=clipped["faces"]
    if not pos or not faces or not (len(pos)==len(norm)==len(uvs)==len(joints)==len(weights)):
        raise ValueError("Skinned source attribute arrays invalid")

    # Count edges by rounded position, not glTF UV/normal-split vertex index.
    # Attribute splits may create duplicate indices at the exact same surface.
    edges=Counter()
    sources=defaultdict(list)
    for i,p in enumerate(pos):
        sources[_position_key(p)].append(i)
    for face in faces:
        if len(face)!=3 or len(set(face))!=3 or any(
                not isinstance(i,int) or i<0 or i>=len(pos) for i in face):
            raise ValueError("Malformed original skinned source triangle")
        vertices=[_position_key(pos[i]) for i in face]
        if len(set(vertices))!=3:
            raise ValueError("Geometrically degenerate source triangle")
        for i in range(3):
            edge=tuple(sorted((vertices[i],vertices[(i+1)%3])))
            edges[edge]+=1
    if any(count not in (1,2) for count in edges.values()):
        raise ValueError("Nonmanifold original head mesh edges")
    boundary=[edge for edge,count in edges.items() if count==1]
    if not boundary:
        raise ValueError("Already closed or missing original neck boundary")
    if any(any(abs(vertex[1]-cut_y)>tolerance for vertex in edge) for edge in boundary):
        raise ValueError("Source mesh has non-neck open edges: cannot safely cap")

    neighbors=defaultdict(set)
    for a,b in boundary:
        neighbors[a].add(b)
        neighbors[b].add(a)
    if len(neighbors)<3 or any(len(v)!=2 for v in neighbors.values()):
        raise ValueError("Neck boundary is not one simple manifold loop")

    # The real approved Base Character actually has TWO disjoint cut loops
    # at this plane: a major neck ring and a tiny independent anterior ring.
    # Resolve all cycles, rather than silently ignore one and claim closure.
    loops=[]
    remaining_vertices=set(neighbors)
    while remaining_vertices:
        first=min(remaining_vertices)
        ring=[first]
        previous=None
        current=first
        while True:
            choices=sorted(v for v in neighbors[current] if v!=previous)
            if not choices:
                raise ValueError("Open or branching original collar ring")
            next_point=choices[0]
            if next_point==first:
                break
            if next_point not in remaining_vertices or next_point in ring:
                raise ValueError("Source collar loop repeats vertices or connects loops")
            ring.append(next_point)
            previous,current=current,next_point
        if len(ring)<3 or len(set(ring))!=len(ring):
            raise ValueError("Degenerate or malformed source cut loop")
        remaining_vertices.difference_update(ring)
        area=_signed_area(ring)
        if area<0:
            ring.reverse()
            area=-area
        if area<1e-8:
            raise ValueError("Source neck loop area too small to cap safely")
        n=len(ring)
        for i in range(n):
            a,b=ring[i],ring[(i+1)%n]
            for j in range(i+2,n):
                if i==0 and j==n-1:continue
                c,d=ring[j],ring[(j+1)%n]
                if _segments_cross(a,b,c,d):
                    raise ValueError("Self-intersecting original source neck ring")
        loops.append((ring,area))

    def contains(point,ring):
        # Standard even-odd projection test. Holes/nested boundaries require
        # separate art authoring, not blind caps over one another.
        x,z=point[0],point[2]
        inside=False
        for i,p in enumerate(ring):
            q=ring[(i+1)%len(ring)]
            if (p[2]>z)!=(q[2]>z) and x<(q[0]-p[0])*(z-p[2])/(q[2]-p[2])+p[0]:
                inside=not inside
        return inside
    for i,(left,_) in enumerate(loops):
        for right,_ in loops[i+1:]:
            if contains(left[0],right) or contains(right[0],left):
                raise ValueError("Nested source neck loops need artist-authored hole geometry")
            for aidx,a in enumerate(left):
                b=left[(aidx+1)%len(left)]
                for cidx,c in enumerate(right):
                    d=right[(cidx+1)%len(right)]
                    if _segments_cross(a,b,c,d):
                        raise ValueError("Overlapping source neck cap loops")

    ordered=[]
    triangles=[]
    areas=[]
    for ring,area in loops:
        # Ear-clip each disconnected opening independently. The source's
        # smaller anterior opening is not discarded or fused to the neck.
        offset=len(ordered)
        n=len(ring)
        remaining=list(range(n))
        while len(remaining)>3:
            found=False
            for idx in range(len(remaining)):
                a,b,c=(remaining[(idx-1)%len(remaining)],
                       remaining[idx],remaining[(idx+1)%len(remaining)])
                pa,pb,pc=ring[a],ring[b],ring[c]
                if _cross_2d(pa,pb,pc)<=1e-12:
                    continue
                if any(_inside_triangle(ring[k],pa,pb,pc,1e-12)
                       for k in remaining if k not in (a,b,c)):
                    continue
                triangles.append((offset+a,offset+b,offset+c))
                del remaining[idx]
                found=True
                break
            if not found:
                raise ValueError("Cannot triangulate source neck loop without overlaps")
        a,b,c=remaining
        if _cross_2d(ring[a],ring[b],ring[c])<=1e-12:
            raise ValueError("Degenerate final neck-cap triangle")
        triangles.append((offset+a,offset+b,offset+c))
        ordered.extend(ring)
        areas.append(area)

    # Cap duplicates positions for a planar material/normal interface. Check
    # every position-split source vertex uses the same skin weights/joints:
    # otherwise dynamic cap and shell edges could separate during animation.
    js=[];ws=[]
    for p in ordered:
        candidates=sources[p]
        first_index=candidates[0]
        joint=tuple(int(j) for j in joints[first_index])
        weight=tuple(float(w) for w in weights[first_index])
        if len(joint)!=4 or len(weight)!=4 or not all(math.isfinite(w) and w>=0 for w in weight):
            raise ValueError("Invalid source neck skin weights")
        if not .999 <= sum(weight) <= 1.001:
            raise ValueError("Unnormalized source skin influence")
        influences={int(j):float(w) for j,w in zip(joint,weight) if w>1e-9}
        for other in candidates[1:]:
            check=defaultdict(float)
            for j,w in zip(joints[other],weights[other]):
                check[int(j)]+=float(w)
            if any(abs(influences.get(j,0)-check.get(j,0))>1e-4 for j in set(influences)|set(check)):
                raise ValueError("Nonmatching neck seam joint weights; cannot promise skinned closure")
        js.append(joint)
        ws.append(weight)

    lo_x=min(p[0] for p in ordered);hi_x=max(p[0] for p in ordered)
    lo_z=min(p[2] for p in ordered);hi_z=max(p[2] for p in ordered)
    if hi_x-lo_x<1e-6 or hi_z-lo_z<1e-6:
        raise ValueError("Invalid cap UV projection area")
    cap={
        "positions":ordered,
        "normals":[(0.,-1.,0.) for _ in ordered],
        "uv":[((p[0]-lo_x)/(hi_x-lo_x),(p[2]-lo_z)/(hi_z-lo_z)) for p in ordered],
        "joints":js,
        "weights":ws,
        "faces":triangles,
        "boundary_vertices":n,
        "boundary_edges":len(boundary),
        "cap_triangles":len(triangles),
        "planar_area_m2":sum(areas),
        "planar_loop_count":len(loops),
        "planar_loop_vertex_counts":[len(ring) for ring,_ in loops],
        "planar_loop_areas_m2":areas,
        "method":"all_original_boundary_loops_independently_ear_clipped_skin_matched_head_caps",
        "status":"OFFLINE_ART_HOLD_NO_BODY_CAP_OR_GAME_EXPORT",
    }
    # Each original cut boundary edge must occur exactly once in cap and
    # the combined surface's position-edge usage must be a closed 2-manifold.
    added=Counter()
    for face in triangles:
        for k in range(3):
            edge=tuple(sorted((ordered[face[k]],ordered[face[(k+1)%3]])))
            added[edge]+=1
    total=edges+added
    if any(count!=2 for count in total.values()):
        raise ValueError("Head shell and cap are not geometrically closed")
    return cap

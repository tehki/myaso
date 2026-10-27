"""Clip skinned head triangles at a horizontal collar plane for P1 offline review.

No vendor input files modified; generates temporary review geometry only.
Preserves approximate normals/UVs and maps intersected skin influences to four
joint slots. Does not cap a neck ring, solve collision, or authorize gameplay.
"""
import math


def _finite(values):
    return all(math.isfinite(float(v)) for v in values)


def _vertex(pos, normal, uv, joints, weights):
    if len(pos)!=3 or len(normal)!=3 or len(uv)!=2 or len(joints)!=4 or len(weights)!=4:
        raise ValueError("Expected glTF POSITION/NORMAL/UV/JOINTS_0/WEIGHTS_0")
    if not _finite((*pos,*normal,*uv,*weights)):
        raise ValueError("Nonfinite skinned source attribute")
    if any(int(j)!=j or int(j)<0 for j in joints):
        raise ValueError("Invalid source joint indices")
    if min(weights)<0 or sum(weights)<=0:
        raise ValueError("No positive nonnegative skin weights")
    return (tuple(float(v) for v in pos),tuple(float(v) for v in normal),
            tuple(float(v) for v in uv),tuple(int(j) for j in joints),
            tuple(float(w) for w in weights))


def _intersect(a,b,plane):
    dy=b[0][1]-a[0][1]
    if abs(dy)<1e-12:
        raise ValueError("Cannot cut an edge parallel to collar plane")
    fraction=(plane-a[0][1])/dy
    if not 0<=fraction<=1:
        raise ValueError("Collar edge does not cross cut plane")
    pos=tuple(a[0][k]+fraction*(b[0][k]-a[0][k]) for k in range(3))
    normal=[a[1][k]+fraction*(b[1][k]-a[1][k]) for k in range(3)]
    length=math.sqrt(sum(v*v for v in normal))
    if length<1e-10:
        raise ValueError("Interpolated normal is degenerate")
    normal=tuple(v/length for v in normal)
    uv=tuple(a[2][k]+fraction*(b[2][k]-a[2][k]) for k in range(2))
    influences={}
    for old,part in ((a,1-fraction),(b,fraction)):
        for joint,weight in zip(old[3],old[4]):
            influences[joint]=influences.get(joint,0.0)+part*weight
    ranked=sorted(influences.items(),key=lambda item:(-item[1],item[0]))[:4]
    total=sum(w for _,w in ranked)
    if total<=1e-10:
        raise ValueError("Cannot interpolate empty skin influence")
    joints=tuple([j for j,_ in ranked]+[0]*(4-len(ranked)))
    weights=tuple([w/total for _,w in ranked]+[0.0]*(4-len(ranked)))
    return (pos,normal,uv,joints,weights)


def clip_skinned_mesh_y(positions,normals,uvs,joints,weights,faces,cut_y):
    """Return skinned triangle attributes clipped to y >= cut_y.

    Each output triangle has unique output vertices, preserving winding and
    *approximately* interpolating four strongest skin influences at new edges.
    This creates an OPEN planar boundary, not an airtight neck cap.
    """
    if not math.isfinite(cut_y):
        raise ValueError("Invalid collar cut height")
    if not (len(positions)==len(normals)==len(uvs)==len(joints)==len(weights)):
        raise ValueError("Skinned source attribute array lengths differ")
    vertices=[_vertex(*values) for values in zip(positions,normals,uvs,joints,weights)]
    out=[[],[],[],[],[],[]]
    for face in faces:
        if len(face)!=3:
            raise ValueError("Only triangular source geometry is supported")
        ids=[int(i) for i in face]
        if any(i!=original for i,original in zip(ids,face)) or len(set(ids))!=3 or any(i<0 or i>=len(vertices) for i in ids):
            raise ValueError("Invalid original mesh triangle")
        polygon=[vertices[i] for i in ids]
        clipped=[]
        for k,current in enumerate(polygon):
            following=polygon[(k+1)%len(polygon)]
            in_a=current[0][1]>=cut_y-1e-10
            in_b=following[0][1]>=cut_y-1e-10
            if in_a:
                clipped.append(current)
            if in_a!=in_b:
                clipped.append(_intersect(current,following,cut_y))
        if len(clipped)<3:
            continue
        if len(clipped)>4:
            raise ValueError("Unexpected clipped triangle topology")
        for k in range(1,len(clipped)-1):
            newface=[]
            for point in (clipped[0],clipped[k],clipped[k+1]):
                index=len(out[0])
                for attr,row in zip(out[:5],point):
                    attr.append(row)
                newface.append(index)
            # Drop zero-area triangles on exact-plane overlap.
            p,q,r=(out[0][i] for i in newface)
            ab=[q[i]-p[i] for i in range(3)]
            ac=[r[i]-p[i] for i in range(3)]
            cr=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]]
            if sum(v*v for v in cr)<=1e-18:
                for attr in out[:5]:
                    del attr[-3:]
                continue
            out[5].append(tuple(newface))
    if not out[5]:
        raise ValueError("No head surface remains after plane clipping")
    # Triangle clipping above uses expanded corner attributes. Merge only
    # exactly equivalent attributes for a topologically meaningful boundary
    # and accurate open-edge neck diagnosis. UV/normal seams are retained.
    welded=[[],[],[],[],[],[]]
    seen={}
    for face in out[5]:
        triangle=[]
        for old_index in face:
            key=tuple(
                tuple(round(float(component), 9) for component in out[k][old_index])
                for k in range(5)
            )
            if key not in seen:
                seen[key]=len(welded[0])
                for k in range(5):
                    welded[k].append(out[k][old_index])
            triangle.append(seen[key])
        if len(set(triangle))!=3:
            raise ValueError("Attribute welding produced degenerate triangle")
        welded[5].append(tuple(triangle))
    return {
        "positions":welded[0],"normals":welded[1],"uv":welded[2],
        "joints":welded[3],"weights":welded[4],"faces":welded[5],
        "method":"triangle_plane_clip_welded_attributes_no_cap",
        "status":"HOLD_OFFLINE_REVIEW_ONLY",
    }

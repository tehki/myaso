"""Create the complementary geometrically capped original-body portion offline.

This is the mirror of the head's cut plane. It keeps the original
publisher skin weights and validates an actual cap using the same
strict geometric checks as the detached head prototype. No Blender
authored/verified anatomical interface, gameplay export, Combat hooks
or art/release approval is provided.
"""
import math
from graphics3a_p1_head_plane_clip import clip_skinned_mesh_y
from graphics3a_p1_neck_cap_geometry import geometric_neck_cap


def _unmirror(source):
    result={
        "positions":[(float(p[0]),-float(p[1]),float(p[2])) for p in source["positions"]],
        "normals":[(float(n[0]),-float(n[1]),float(n[2])) for n in source["normals"]],
        "uv":list(source["uv"]),
        "joints":list(source["joints"]),
        "weights":list(source["weights"]),
        "faces":[(int(f[0]),int(f[2]),int(f[1])) for f in source["faces"]],
    }
    return result


def lower_body_with_complementary_cap(positions,normals,uv,joints,weights,faces,cut_y):
    """Return source body below collar plus an independent upwards-facing cap.

    Nothing is saved, no input is modified, and not a nude-body/gear-swap GO.
    """
    if not isinstance(cut_y,(int,float)) or not math.isfinite(cut_y):
        raise ValueError("Valid numeric collar cut plane required")
    if not all(len(item)==len(positions) for item in (normals,uv,joints,weights)):
        raise ValueError("Original source skinned attributes have different lengths")

    # Reflect Y to reuse the already qualified >=plane cutter. Reflection
    # changes handedness, so reverse face order before and after the cut.
    inverted_positions=[(float(p[0]),-float(p[1]),float(p[2])) for p in positions]
    inverted_normals=[(float(n[0]),-float(n[1]),float(n[2])) for n in normals]
    inverted_faces=[(int(a),int(c),int(b)) for a,b,c in faces]
    lower_mirror=clip_skinned_mesh_y(
        inverted_positions,inverted_normals,uv,joints,weights,inverted_faces,-cut_y
    )
    cap_mirror=geometric_neck_cap(lower_mirror,-cut_y)
    lower=_unmirror(lower_mirror)
    cap=_unmirror(cap_mirror)
    cap["method"]="original_lower_body_own_skinned_boundary_cap_offline"
    cap["status"]="OFFLINE_TORSO_CAP_GEOMETRIC_HOLD_NO_GAME_EXPORT"
    cap["planar_loop_count"]=cap_mirror["planar_loop_count"]
    cap["planar_loop_vertex_counts"]=cap_mirror["planar_loop_vertex_counts"]
    cap["cap_triangles"]=cap_mirror["cap_triangles"]
    cap["boundary_edges"]=cap_mirror["boundary_edges"]
    cap["planar_area_m2"]=cap_mirror["planar_area_m2"]
    cap["planar_loop_areas_m2"]=cap_mirror["planar_loop_areas_m2"]
    lower["status"]="OFFLINE_LOWER_BODY_SHELL_NOT_VERIFIED_UNEQUIPPED"
    return {"lower_body":lower,"torso_neck_cap":cap,
            "status":"GEOMETRIC_CLOSED_REST_POSE_ONLY_ART_HOLD"}

def verify_matching_head_torso_caps(head_cap, torso_cap, tolerance=1e-5):
    """Confirm BOTH original-source caps have matching rest geometry+skinning.

    Pure geometry evidence, not collision/mesh artistic quality nor game GO.
    """
    if not isinstance(tolerance,(int,float)) or not math.isfinite(tolerance) or not 0<tolerance<=1e-3:
        raise ValueError("Invalid paired neck tolerance")
    if not isinstance(head_cap,dict) or not isinstance(torso_cap,dict):
        raise ValueError("Two source cap meshes are required")
    for cap in (head_cap,torso_cap):
        for item in ("positions","normals","joints","weights","faces"):
            if item not in cap:
                raise ValueError("Source cap has missing vertex attributes")
    if len(head_cap["positions"])!=len(torso_cap["positions"]):
        raise ValueError("Head and body have different neck cut vertex counts")
    if not head_cap["positions"]:
        raise ValueError("Empty neck interface")
    if len(head_cap["faces"])!=len(torso_cap["faces"]):
        raise ValueError("Head and torso use different cap triangulation sizes")
    if head_cap.get("planar_loop_vertex_counts")!=torso_cap.get("planar_loop_vertex_counts"):
        raise ValueError("Head and torso boundary loops do not match")

    def key(pos):
        if len(pos)!=3 or not all(math.isfinite(float(v)) for v in pos):
            raise ValueError("Nonfinite original boundary position")
        return tuple(round(float(v),6) for v in pos)

    def map_cap(cap):
        n=len(cap["positions"])
        if any(len(cap[name])!=n for name in ("normals","joints","weights")):
            raise ValueError("Incomplete cap source attributes")
        mapping={}
        for i,pos in enumerate(cap["positions"]):
            k=key(pos)
            if k in mapping:
                raise ValueError("Ambiguous duplicate original neck position")
            mapping[k]=i
        return mapping

    a,b=map_cap(head_cap),map_cap(torso_cap)
    if set(a)!=set(b):
        raise ValueError("Head/torso border geometry is not coincident")
    max_pos=0.
    max_skin=0.
    for k in a:
        i,j=a[k],b[k]
        p=head_cap["positions"][i];q=torso_cap["positions"][j]
        diff=max(abs(float(p[n])-float(q[n])) for n in range(3))
        max_pos=max(max_pos,diff)
        if diff>tolerance:
            raise ValueError("Opposing neck caps diverge geometrically")

        infs=[]
        for cap,n in ((head_cap,i),(torso_cap,j)):
            inf={}
            for joint,weight in zip(cap["joints"][n],cap["weights"][n]):
                if not isinstance(joint,int) or not math.isfinite(float(weight)) or weight<0:
                    raise ValueError("Invalid neck interface skin influence")
                inf[joint]=inf.get(joint,0.)+float(weight)
            if not .999<=sum(inf.values())<=1.001:
                raise ValueError("Cap skin weights not normalized")
            infs.append(inf)
        if any(abs(infs[0].get(joint,0.)-infs[1].get(joint,0.))>tolerance
               for joint in set(infs[0])|set(infs[1])):
            raise ValueError("Head and torso cut edge skin weights differ")
        max_skin=max(max_skin,max(abs(infs[0].get(jt,0.)-infs[1].get(jt,0.))
                              for jt in set(infs[0])|set(infs[1])))

        na=head_cap["normals"][i];nb=torso_cap["normals"][j]
        if len(na)!=3 or len(nb)!=3:
            raise ValueError("Invalid neck cap normals")
        if abs(float(na[1])+1)>tolerance or abs(float(nb[1])-1)>tolerance:
            raise ValueError("Head and torso cut normals are not opposite")
    return {
        "matching_original_neck_vertices":len(a),
        "max_border_coordinate_delta_m":max_pos,
        "max_joint_weight_delta":max_skin,
        "opposing_cap_normals":True,
        "status":"SOURCE_REST_INTERFACE_MATCH_ONLY_ART_HOLD",
    }

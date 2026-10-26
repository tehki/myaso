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

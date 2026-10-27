"""Source-only numerical motion gates for a private Quaternius Ranger hood.

These are engineering invariants, NOT collision, fit, visual, floor-contact,
or 8-direction authored animation acceptance. No vendor files are included.
"""
import math


MOTION_PHASES = (0.0, 0.25, 0.5, 0.75, 1.0)
REQUIRED_CLIPS = (
    "Idle_Loop", "Walk_Loop", "Sprint_Loop",
    "Jump_Start", "Jump_Loop", "Jump_Land", "Roll",
)
MAX_SKIN_MATRIX_DIFFERENCE = 0.0005


def validated_motion_selection(clips, fractions=MOTION_PHASES):
    if not isinstance(clips, (tuple,list)) or not clips or len(clips)!=len(set(clips)):
        raise ValueError("Nonempty unique source animation names are required")
    if not set(clips).issubset(REQUIRED_CLIPS):
        raise ValueError("Only explicitly approved original motion clips may be probed")
    if not isinstance(fractions, (tuple,list)) or not fractions:
        raise ValueError("At least one pose phase is required")
    result=[]
    for f in fractions:
        if not isinstance(f, (int,float)) or not math.isfinite(float(f)) or not 0<=f<=1:
            raise ValueError("Animation fraction must be finite within 0..1")
        result.append(float(f))
    if len(set(result)) != len(result):
        raise ValueError("Duplicate animation fractions are not permitted")
    return tuple(clips), tuple(result)


def finite_skin_compatible(max_abs_matrix_diff, max_abs_bind_error, max_abs_joint_pos_diff,
                           max_abs_skinned_vertex_position, skin_weight_min_sum=0.999):
    """Fail closed on nonfinite/deformed hood or a mismatched animation rig."""
    vals=(max_abs_matrix_diff,max_abs_bind_error,max_abs_joint_pos_diff,
          max_abs_skinned_vertex_position,skin_weight_min_sum)
    if not all(isinstance(v,(float,int)) and math.isfinite(float(v)) for v in vals):
        raise ValueError("Nonfinite animated hood data")
    if any(v<0 for v in vals):
        raise ValueError("Negative motion diagnostic")
    if skin_weight_min_sum < 0.999 or skin_weight_min_sum>1.001:
        raise ValueError("Hood vertex skin weights are not normalized")
    if max_abs_matrix_diff>MAX_SKIN_MATRIX_DIFFERENCE:
        raise ValueError("Hood vs Peasant skin matrices diverged")
    if max_abs_bind_error>MAX_SKIN_MATRIX_DIFFERENCE:
        raise ValueError("Hood bind matrix invalid")
    if max_abs_joint_pos_diff>0.001:
        raise ValueError("Source hood and Peasant joints diverged")
    if max_abs_skinned_vertex_position>100:
        raise ValueError("Animated hood vertex escaped world sanity bounds")
    return True

def collar_follow_center(posed_neck_xyz, rest_neck_y, rest_head_cut_y, clearance=0.05):
    """Frame the existing collar review at the animated neck, not rest Y.

    The original rest cut anchor remains the same; only the offline camera
    tracks the actual posed neck. This never modifies game camera/control.
    """
    if len(posed_neck_xyz)!=3:
        raise ValueError("Three-dimensional animated neck joint required")
    values=tuple(float(x) for x in posed_neck_xyz)
    if not all(math.isfinite(v) for v in (*values,rest_neck_y,rest_head_cut_y,clearance)):
        raise ValueError("Nonfinite neck tracking input")
    if not 0<=clearance<=.5:
        raise ValueError("Collar lookdev clearance outside permitted bounds")
    return (values[0], values[1]+float(rest_head_cut_y)+clearance-float(rest_neck_y), values[2])

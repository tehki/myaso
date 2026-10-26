#!/usr/bin/env python3
"""Private original-source UAL1 7-motion × 5-phase Ranger-hood skinning sweep.

No textures rendered and no glTF/PNG source data exported. This checks finite
skin transforms and joint consistency ONLY, not clipping, eight-facing art,
correct action semantics, multiplayer quality, collision or release readiness.
"""
import argparse
import hashlib
import json
from pathlib import Path
from zipfile import ZipFile

from graphics3a_p1_cpu_skin_retarget import (
    accessor_values, joint_map, load_glb_from_zip, load_gltf,
    retarget_pose, sample_clip, skin_matrices,
    validate_skeleton_pair, world_matrices,
)
from graphics3a_p1_head_attach_rules import archive_uri
from graphics3a_p1_hood_review_rules import approved_hood_member
from graphics3a_p1_hood_motion_rules import (
    REQUIRED_CLIPS, MOTION_PHASES, finite_skin_compatible,
    validated_motion_selection,
)


def source_sha(path):
    h=hashlib.sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda:file.read(1024*1024),b""):
            h.update(chunk)
    return h.hexdigest()


def run(target_path, hood_archive, animation_archive, output):
    import numpy as np

    if not all(p.is_file() for p in (target_path,hood_archive,animation_archive)):
        raise FileNotFoundError("Original private Standard sources are required")
    repo=Path(__file__).resolve().parents[1]
    if output.resolve().is_relative_to(repo.resolve()):
        raise ValueError("Private original-source motion metrics must remain outside GitHub repo")
    clips,phases=validated_motion_selection(REQUIRED_CLIPS,MOTION_PHASES)
    target,tbuf=load_gltf(target_path)
    source,sbuf,src_member=load_glb_from_zip(
        animation_archive,"Unreal-Godot/UAL1_Standard.glb")
    with ZipFile(hood_archive) as zip:
        hood_member=approved_hood_member(target_path.name,zip.namelist())
        hood=json.loads(zip.read(hood_member))
        prefix=hood_member.rsplit("/",1)[0]+"/"
        hbuf=[zip.read(archive_uri(prefix,desc["uri"])) for desc in hood["buffers"]]

    validate_skeleton_pair(source,target)
    validate_skeleton_pair(hood,target)
    target_nodes=[i for i,n in enumerate(target["nodes"]) if "mesh" in n and "skin" in n]
    hood_nodes=[i for i,n in enumerate(hood["nodes"]) if "mesh" in n and "skin" in n]
    if not target_nodes or len(hood_nodes)!=1:
        raise ValueError("Private test needs Peasant skinned meshes and one Ranger Hood skinned node")
    tn,hn=target_nodes[0],hood_nodes[0]
    sm,tm,hm=joint_map(source),joint_map(target),joint_map(hood)
    src_rest=world_matrices(source,{},np)
    tgt_rest=world_matrices(target,{},np)
    hood_rest=world_matrices(hood,{},np)
    size=lambda world,joints: max(float(world[i][1,3]) for i in joints.values())-min(float(world[i][1,3]) for i in joints.values())
    scale=size(tgt_rest,tm)/size(src_rest,sm)
    if not np.isfinite(scale) or not .1<=scale<=10:
        raise ValueError("Source/target body height scale invalid")
    bind_error=max(
        float(np.max(np.abs(skin_matrices(hood,hbuf,hood_rest,hn,np)-np.eye(4)))),
        float(np.max(np.abs(skin_matrices(target,tbuf,tgt_rest,tn,np)-np.eye(4)))),
    )
    if bind_error>5e-4:raise ValueError("Rest pose skin matrices are not identity")
    if any(np.max(np.abs(hood_rest[hn]-tgt_rest[node]))>1e-5 for node in target_nodes):
        raise ValueError("Hood and one or more Peasant mesh node rest spaces differ")

    hnames=[hood["nodes"][i]["name"] for i in hood["skins"][hood["nodes"][hn]["skin"]]["joints"]]
    tnames=[target["nodes"][i]["name"] for i in target["skins"][target["nodes"][tn]["skin"]]["joints"]]
    t_idx={name:i for i,name in enumerate(tnames)}
    aligned=np.asarray([t_idx[name] for name in hnames],dtype=int)

    primitive=hood["meshes"][hood["nodes"][hn]["mesh"]]["primitives"]
    pos_parts,js_parts,wt_parts=[],[],[]
    for part in primitive:
        if part.get("mode",4)!=4:
            raise ValueError("Only triangle hood source primitives are supported")
        attributes=part["attributes"]
        if not all(k in attributes for k in ("POSITION","JOINTS_0","WEIGHTS_0")):
            raise ValueError("Source Ranger Hood lacks skinned vertex attributes")
        pos=np.asarray(accessor_values(hood,hbuf,attributes["POSITION"]),float)
        joints=np.asarray(accessor_values(hood,hbuf,attributes["JOINTS_0"]),int)
        weights=np.asarray(accessor_values(hood,hbuf,attributes["WEIGHTS_0"]),float)
        if not np.all(np.isfinite(pos)) or not np.all(np.isfinite(weights)):
            raise ValueError("Nonfinite source hood vertices or weights")
        if joints.min()<0 or joints.max()>=len(hnames) or np.any(weights<0):
            raise ValueError("Invalid Ranger Hood skin influences")
        sums=weights.sum(axis=1)
        if np.min(sums)<.999 or np.max(sums)>1.001:
            raise ValueError("Ranger Hood original vertex weights not normalized")
        pos_parts.append(pos);js_parts.append(joints);wt_parts.append(weights)
    positions=np.concatenate(pos_parts)
    indices=np.concatenate(js_parts)
    weights=np.concatenate(wt_parts)
    positions4=np.c_[positions,np.ones(len(positions))]
    count=len(positions)
    if count<1:raise ValueError("No hood vertices to sample")

    frames=[]
    anchor_names=("Head","neck_01","spine_03","clavicle_l","clavicle_r")
    for clip in clips:
        for fraction in phases:
            sampled,time_s,duration_s=sample_clip(source,sbuf,clip,fraction)
            target_pose=retarget_pose(source,target,sampled,scale)
            hood_pose=retarget_pose(source,hood,sampled,scale)
            tw=world_matrices(target,target_pose,np)
            hw=world_matrices(hood,hood_pose,np)
            target_skin=skin_matrices(target,tbuf,tw,tn,np)
            hood_skin=skin_matrices(hood,hbuf,hw,hn,np)
            matrix_error=float(np.max(np.abs(hood_skin-target_skin[aligned])))
            joint_error=max(float(np.linalg.norm(
                hw[hm[name]][:3,3]-tw[tm[name]][:3,3]
            )) for name in anchor_names)
            posed=np.einsum("vjik,vk->vji",hood_skin[indices],positions4)[:,:,:3]
            skinned=np.einsum("vj,vjc->vc",weights,posed)
            global_skinned=(hw[hn]@np.c_[skinned,np.ones(count)].T).T[:,:3]
            maxabs=float(np.max(np.abs(global_skinned)))
            finite_skin_compatible(matrix_error,bind_error,joint_error,maxabs,
                                  float(np.min(weights.sum(axis=1))))
            frame={
                "clip":clip,"fraction":fraction,
                "sample_time_seconds":time_s,"clip_duration_seconds":duration_s,
                "max_skin_matrix_delta":matrix_error,
                "max_joint_position_delta_m":joint_error,
                "max_abs_hood_world_coordinate_m":maxabs,
                "hood_world_aabb_min_m":np.min(global_skinned,axis=0).tolist(),
                "hood_world_aabb_max_m":np.max(global_skinned,axis=0).tolist(),
                "status":"PASS_NUMERICAL_ONLY",
            }
            frames.append(frame)
            print("POSE",target_path.name,clip,fraction,
                  "matrix_error",round(matrix_error,9),
                  "joint_error",round(joint_error,9),
                  "world_max",round(maxabs,3),flush=True)

    report={
        "status":"HOLD_OFFLINE_HOOD_MOTION_NUMERICAL_VERIFIED",
        "not_a_release_or_visual_approval":True,
        "target_model":target_path.name,
        "target_model_sha256":source_sha(target_path),
        "hood_archive_sha256":source_sha(hood_archive),
        "hood_model_member":hood_member,
        "animation_archive_sha256":source_sha(animation_archive),
        "animation_model_member":src_member,
        "source_clip_count":len(clips),
        "fractions_per_clip":len(phases),
        "real_source_pose_count":len(frames),
        "hood_vertex_count":count,
        "source_to_target_height_ratio":scale,
        "max_rest_bind_error":bind_error,
        "max_pose_skin_matrix_delta":max(f["max_skin_matrix_delta"] for f in frames),
        "max_pose_joint_position_delta_m":max(f["max_joint_position_delta_m"] for f in frames),
        "max_abs_hood_world_coordinate_m":max(f["max_abs_hood_world_coordinate_m"] for f in frames),
        "limitations":[
            "Bone/skin matrix matching and finite vertex positions are NOT mesh fit or lack of clipping.",
            "No facial, collar, material, cloth, root-motion or ground-contact acceptance.",
            "No eight-direction appearance acceptance or 960x540 Chrome/Firefox multiplayer evidence.",
            "Do not replace Silver Knight or merge/deploy; Main0 and Art Director GO needed.",
        ],
        "frames":frames,
    }
    output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps(report,indent=2)+"\n",encoding="utf-8")
    print("PRIVATE_HOOD_PHASE_REPORT",output,
          "real_source_poses",len(frames),
          "MAX_MATRIX_DELTA",report["max_pose_skin_matrix_delta"],flush=True)


def main():
    p=argparse.ArgumentParser(description="Original UAL1 source hood-motion numerical sweep: HOLD")
    p.add_argument("--target-model",type=Path,required=True)
    p.add_argument("--approved-hood-archive",type=Path,required=True)
    p.add_argument("--animation-archive",type=Path,required=True)
    p.add_argument("--output",type=Path,required=True)
    a=p.parse_args()
    run(a.target_model,a.approved_hood_archive,a.animation_archive,a.output)


if __name__=="__main__":
    main()

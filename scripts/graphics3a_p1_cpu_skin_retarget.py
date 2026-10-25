#!/usr/bin/env python3
"""Offline, source-data-only UAL1 -> Quaternius outfit animation retarget proof.

Reads real glTF/GLB clips and target inverse-bind matrices, retargets local
TRS deltas relative to each rig's rest pose, CPU-skins the target outfit, and
renders actual source-clip poses at eight rotations. It never imports vendor
code or exports a playable asset. Output is lookdev evidence, not release art.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import math
import os
import struct
from pathlib import Path, PurePosixPath
from zipfile import ZipFile


COMPONENTS = {
    "SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT2": 4,
    "MAT3": 9, "MAT4": 16,
}
COMPONENT_FORMATS = {
    5120: ("b", 1), 5121: ("B", 1), 5122: ("h", 2),
    5123: ("H", 2), 5125: ("I", 4), 5126: ("f", 4),
}
DEFAULT_T = [0.0, 0.0, 0.0]
DEFAULT_R = [0.0, 0.0, 0.0, 1.0]
DEFAULT_S = [1.0, 1.0, 1.0]
APPROVED_CLIPS = {
    "Idle_Loop": (0.10, 0.50, 0.90),
    "Walk_Loop": (0.10, 0.50, 0.90),
    "Sprint_Loop": (0.10, 0.50, 0.90),
    "Jump_Start": (0.50,),
    "Jump_Loop": (0.50,),
    "Jump_Land": (0.50,),
    "Roll": (0.10, 0.50, 0.90),
}


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def safe_local_path(base: Path, uri: str) -> Path:
    if (not isinstance(uri, str) or not uri or ":" in uri or "\\" in uri
            or uri.startswith("/") or uri.lower().startswith(("data:", "http:", "https:"))):
        raise ValueError("Only local relative glTF dependencies are permitted")
    rel = PurePosixPath(uri)
    if any(part in ("", ".", "..") for part in rel.parts):
        raise ValueError("Ambiguous or traversing glTF dependency URI")
    root = base.resolve()
    path = base.joinpath(*rel.parts)
    if path.is_symlink():
        raise ValueError("Symlinked glTF dependency is not permitted")
    try:
        path.resolve().relative_to(root)
    except ValueError as exc:
        raise ValueError("glTF dependency escapes its private source directory") from exc
    if not path.is_file():
        raise FileNotFoundError(path)
    return path


def parse_glb_bytes(data: bytes) -> tuple[dict, list[bytes]]:
    if len(data) < 20 or data[:4] != b"glTF":
        raise ValueError("Expected binary glTF")
    version, declared = struct.unpack_from("<II", data, 4)
    if version != 2 or declared != len(data):
        raise ValueError("Invalid glTF v2 header or declared length")
    cursor, doc, binary = 12, None, None
    while cursor < len(data):
        if cursor + 8 > len(data):
            raise ValueError("Truncated GLB chunk header")
        size, kind = struct.unpack_from("<II", data, cursor)
        cursor += 8
        end = cursor + size
        if end > len(data):
            raise ValueError("Truncated GLB chunk")
        chunk = data[cursor:end]
        cursor = end
        if kind == 0x4E4F534A:
            if doc is not None:
                raise ValueError("Duplicate GLB JSON chunk")
            doc = json.loads(chunk.decode("utf-8").rstrip("\x00 \t\r\n"))
        elif kind == 0x004E4942:
            binary = chunk
    if not isinstance(doc, dict):
        raise ValueError("GLB JSON chunk missing")
    buffers = []
    for i, spec in enumerate(doc.get("buffers", [])):
        if "uri" in spec:
            raise ValueError("GLB source uses an external buffer; refuse implicit network/source resolution")
        if i != 0 or binary is None:
            raise ValueError("Unsupported GLB buffer layout")
        if len(binary) < spec.get("byteLength", 0):
            raise ValueError("GLB BIN chunk shorter than declared buffer")
        buffers.append(binary)
    return doc, buffers


def load_gltf(path: Path) -> tuple[dict, list[bytes]]:
    if path.suffix.lower() == ".glb":
        return parse_glb_bytes(path.read_bytes())
    if path.suffix.lower() != ".gltf":
        raise ValueError("Only glTF or GLB inputs are permitted")
    doc = json.loads(path.read_text(encoding="utf-8"))
    buffers = []
    for spec in doc.get("buffers", []):
        uri = spec.get("uri")
        if uri is None:
            raise ValueError("External .gltf must name every local buffer")
        data = safe_local_path(path.parent, uri).read_bytes()
        if len(data) < spec.get("byteLength", 0):
            raise ValueError("glTF buffer shorter than declared length")
        buffers.append(data)
    return doc, buffers


def load_glb_from_zip(archive: Path, suffix: str) -> tuple[dict, list[bytes], str]:
    with ZipFile(archive) as zf:
        matches = [name for name in zf.namelist()
                   if name.endswith(suffix) and not name.endswith("/")]
        if len(matches) != 1:
            raise ValueError(f"Source clip GLB suffix is not unique: {suffix!r}")
        member = matches[0]
        doc, buffers = parse_glb_bytes(zf.read(member))
    return doc, buffers, member


def accessor_values(doc: dict, buffers: list[bytes], index: int) -> list[list[float]]:
    accessors = doc.get("accessors", [])
    if not isinstance(index, int) or not 0 <= index < len(accessors):
        raise ValueError("Invalid glTF accessor index")
    acc = accessors[index]
    if "sparse" in acc:
        raise ValueError("Sparse accessors are not supported in this qualification path")
    if "bufferView" not in acc:
        raise ValueError("Accessor has no backing bufferView")
    component = acc.get("componentType")
    if component not in COMPONENT_FORMATS or acc.get("type") not in COMPONENTS:
        raise ValueError("Unsupported accessor component/type")
    fmt, unit = COMPONENT_FORMATS[component]
    width = COMPONENTS[acc["type"]]
    view = doc["bufferViews"][acc["bufferView"]]
    bidx = view.get("buffer", 0)
    if not 0 <= bidx < len(buffers):
        raise ValueError("Accessor buffer index is out of range")
    data = buffers[bidx]
    stride = view.get("byteStride", width * unit)
    offset = view.get("byteOffset", 0) + acc.get("byteOffset", 0)
    count = acc.get("count")
    if not isinstance(count, int) or count < 0 or stride < width * unit:
        raise ValueError("Invalid accessor count or stride")
    end = offset if count == 0 else offset + (count - 1) * stride + width * unit
    if offset < 0 or end > len(data):
        raise ValueError("Accessor exceeds its declared backing buffer")
    unpack = struct.Struct("<" + fmt * width).unpack_from
    result = []
    for row in range(count):
        values = list(unpack(data, offset + row * stride))
        if acc.get("normalized") and component != 5126:
            if component in (5120, 5122):
                maximum = float((1 << (unit * 8 - 1)) - 1)
                values = [max(v / maximum, -1.0) for v in values]
            else:
                maximum = float((1 << (unit * 8)) - 1)
                values = [v / maximum for v in values]
        result.append(values)
    return result


def parent_map(doc: dict) -> dict[int, int]:
    parents: dict[int, int] = {}
    for parent, node in enumerate(doc.get("nodes", [])):
        for child in node.get("children", []):
            if child in parents:
                raise ValueError("Node has multiple parents")
            if not isinstance(child, int) or not 0 <= child < len(doc["nodes"]):
                raise ValueError("Node child index is invalid")
            parents[child] = parent
    return parents


def joint_map(doc: dict) -> dict[str, int]:
    if len(doc.get("skins", [])) != 1:
        raise ValueError("Exactly one humanoid skin is required")
    nodes = doc["nodes"]
    joints = doc["skins"][0].get("joints", [])
    if not joints or len(joints) != len(set(joints)):
        raise ValueError("Skin has no joints or repeats a joint index")
    result = {}
    for index in joints:
        if not isinstance(index, int) or not 0 <= index < len(nodes):
            raise ValueError("Skin joint index is invalid")
        name = nodes[index].get("name")
        if not isinstance(name, str) or not name or name in result:
            raise ValueError("Joint names must be present and unique")
        if "matrix" in nodes[index]:
            raise ValueError("Matrix-authored joint needs a separately qualified conversion")
        result[name] = index
    return result


def validate_skeleton_pair(source: dict, target: dict) -> dict:
    sm, tm = joint_map(source), joint_map(target)
    if set(sm) != set(tm):
        raise ValueError("Source and target joint names differ; explicit remapping required")
    sp, tp = parent_map(source), parent_map(target)
    sn, tn = source["nodes"], target["nodes"]
    mismatches = []
    for name in sorted(sm):
        si, ti = sm[name], tm[name]
        s_parent = sn[sp[si]].get("name") if si in sp else None
        t_parent = tn[tp[ti]].get("name") if ti in tp else None
        if s_parent != t_parent:
            mismatches.append({"joint": name, "source_parent": s_parent,
                               "target_parent": t_parent})
    if mismatches:
        raise ValueError(f"Source/target joint hierarchy differs: {mismatches[:5]}")
    return {"joint_count": len(sm), "same_joint_names": True,
            "same_named_parent_topology": True,
            "source_joint_order_equals_target": (
                [source["nodes"][i]["name"] for i in source["skins"][0]["joints"]]
                == [target["nodes"][i]["name"] for i in target["skins"][0]["joints"]]
            )}


def quat_normalize(q: list[float]) -> list[float]:
    length = math.sqrt(sum(float(v) * float(v) for v in q))
    if length < 1e-12:
        raise ValueError("Zero-length quaternion")
    return [float(v) / length for v in q]


def quat_conjugate(q: list[float]) -> list[float]:
    return [-q[0], -q[1], -q[2], q[3]]


def quat_multiply(a: list[float], b: list[float]) -> list[float]:
    ax, ay, az, aw = a
    bx, by, bz, bw = b
    return [
        aw * bx + ax * bw + ay * bz - az * by,
        aw * by - ax * bz + ay * bw + az * bx,
        aw * bz + ax * by - ay * bx + az * bw,
        aw * bw - ax * bx - ay * by - az * bz,
    ]


def quat_slerp(a: list[float], b: list[float], t: float) -> list[float]:
    qa, qb = quat_normalize(a), quat_normalize(b)
    dot = sum(x * y for x, y in zip(qa, qb))
    if dot < 0.0:
        qb = [-v for v in qb]
        dot = -dot
    dot = min(1.0, max(-1.0, dot))
    if dot > 0.9995:
        return quat_normalize([x + t * (y - x) for x, y in zip(qa, qb)])
    angle = math.acos(dot)
    sine = math.sin(angle)
    a_weight = math.sin((1.0 - t) * angle) / sine
    b_weight = math.sin(t * angle) / sine
    return quat_normalize([a_weight * x + b_weight * y for x, y in zip(qa, qb)])


def sample_track(times: list[float], values: list[list[float]], at: float,
                 path: str, interpolation: str = "LINEAR") -> list[float]:
    if not times or any(times[i] > times[i + 1] for i in range(len(times) - 1)):
        raise ValueError("Animation input times must be nonempty and ordered")
    if interpolation not in ("LINEAR", "STEP", "CUBICSPLINE"):
        raise ValueError(f"Unsupported glTF interpolation {interpolation!r}")
    cubic = interpolation == "CUBICSPLINE"
    if len(values) != len(times) * (3 if cubic else 1):
        raise ValueError("Animation sampler input/output key counts disagree")
    if at <= times[0]:
        return list(values[1] if cubic else values[0])
    if at >= times[-1]:
        return list(values[3 * (len(times) - 1) + 1] if cubic else values[-1])
    hi = next(i for i, time in enumerate(times) if time >= at)
    lo = hi - 1
    if interpolation == "STEP":
        return list(values[lo])
    dt = times[hi] - times[lo]
    if dt <= 0:
        raise ValueError("Animation input times must be strictly increasing")
    t = (at - times[lo]) / dt
    if cubic:
        p0, m0 = values[3 * lo + 1], values[3 * lo + 2]
        p1, m1 = values[3 * hi + 1], values[3 * hi]
        h00, h10 = 2*t**3 - 3*t**2 + 1, t**3 - 2*t**2 + t
        h01, h11 = -2*t**3 + 3*t**2, t**3 - t**2
        out = [h00*a + h10*dt*b + h01*c + h11*dt*d
               for a, b, c, d in zip(p0, m0, p1, m1)]
        return quat_normalize(out) if path == "rotation" else out
    if path == "rotation":
        return quat_slerp(values[lo], values[hi], t)
    return [a + t * (b - a) for a, b in zip(values[lo], values[hi])]


def rest_trs(node: dict) -> dict:
    if "matrix" in node:
        raise ValueError("Matrix-authored joint needs a separately qualified conversion")
    return {
        "translation": list(node.get("translation", DEFAULT_T)),
        "rotation": quat_normalize(list(node.get("rotation", DEFAULT_R))),
        "scale": list(node.get("scale", DEFAULT_S)),
    }


def sample_clip(doc: dict, buffers: list[bytes], clip_name: str, fraction: float) -> tuple[dict, float, float]:
    matches = [clip for clip in doc.get("animations", []) if clip.get("name") == clip_name]
    if len(matches) != 1:
        raise ValueError(f"Expected one source animation named {clip_name!r}")
    clip = matches[0]
    node_names = doc["nodes"]
    tracks = []
    starts, ends = [], []
    for channel in clip.get("channels", []):
        sampler = clip["samplers"][channel["sampler"]]
        path = channel["target"].get("path")
        node_index = channel["target"].get("node")
        if path not in ("translation", "rotation", "scale"):
            raise ValueError(f"Unsupported source animation path {path!r}")
        if not isinstance(node_index, int) or not 0 <= node_index < len(node_names):
            raise ValueError("Animation target node index invalid")
        times = [row[0] for row in accessor_values(doc, buffers, sampler["input"])]
        values = accessor_values(doc, buffers, sampler["output"])
        interpolation = sampler.get("interpolation", "LINEAR")
        starts.append(times[0])
        ends.append(times[-1])
        tracks.append((node_names[node_index]["name"], path, times, values, interpolation))
    if not tracks or min(ends) <= min(starts):
        raise ValueError(f"Animation {clip_name!r} has no positive duration")
    start, end = min(starts), max(ends)
    at = start + (end - start) * min(1.0, max(0.0, fraction))
    sampled: dict[str, dict[str, list[float]]] = {}
    for name, path, times, values, interpolation in tracks:
        sampled.setdefault(name, {})[path] = sample_track(times, values, at, path, interpolation)
    return sampled, at, end - start


def retarget_trs(source_rest: dict, source_pose: dict, target_rest: dict,
                 height_ratio: float) -> dict:
    """Map each source local transform delta onto the target's own rest pose."""
    st = source_pose.get("translation", source_rest["translation"])
    sr = source_pose.get("rotation", source_rest["rotation"])
    ss = source_pose.get("scale", source_rest["scale"])
    target_t = [base + height_ratio * (value - source)
                for base, value, source in zip(
                    target_rest["translation"], st, source_rest["translation"])]
    delta_rotation = quat_multiply(quat_conjugate(source_rest["rotation"]), sr)
    target_q = quat_normalize(quat_multiply(target_rest["rotation"], delta_rotation))
    target_s = []
    for base, value, source in zip(target_rest["scale"], ss, source_rest["scale"]):
        if abs(source) < 1e-8:
            raise ValueError("Cannot retarget from zero source scale")
        target_s.append(base * value / source)
    return {"translation": target_t, "rotation": target_q, "scale": target_s}


def retarget_pose(source: dict, target: dict, sampled: dict, height_ratio: float) -> dict[int, dict]:
    sm, tm = joint_map(source), joint_map(target)
    source_rest = {name: rest_trs(source["nodes"][index]) for name, index in sm.items()}
    pose = {}
    for name, target_index in tm.items():
        source_pose = sampled.get(name, {})
        pose[target_index] = retarget_trs(
            source_rest[name], source_pose, rest_trs(target["nodes"][target_index]), height_ratio
        )
    return pose


def node_trs_matrix(node: dict, override: dict | None, np):
    if "matrix" in node:
        if override is not None:
            raise ValueError("Cannot override a matrix-authored node")
        return np.asarray(node["matrix"], dtype=float).reshape((4, 4), order="F")
    values = override or rest_trs(node)
    x, y, z, w = quat_normalize(values["rotation"])
    rotation = np.array([
        [1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w)],
        [2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w)],
        [2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y)],
    ], dtype=float)
    result = np.eye(4, dtype=float)
    result[:3, :3] = rotation @ np.diag(np.asarray(values["scale"], dtype=float))
    result[:3, 3] = np.asarray(values["translation"], dtype=float)
    return result


def world_matrices(doc: dict, pose: dict[int, dict], np) -> dict[int, object]:
    nodes = doc["nodes"]
    parents = parent_map(doc)
    result = {}
    active = set()

    def calc(index):
        if index in result:
            return result[index]
        if index in active:
            raise ValueError("Cycle in glTF node hierarchy")
        active.add(index)
        local = node_trs_matrix(nodes[index], pose.get(index), np)
        result[index] = calc(parents[index]) @ local if index in parents else local
        active.remove(index)
        return result[index]

    for index in range(len(nodes)):
        calc(index)
    return result


def skin_matrices(doc: dict, buffers: list[bytes], worlds: dict[int, object], mesh_node: int, np):
    skin = doc["skins"][doc["nodes"][mesh_node]["skin"]]
    values = accessor_values(doc, buffers, skin["inverseBindMatrices"])
    inverse_bind = [np.asarray(row, dtype=float).reshape((4, 4), order="F") for row in values]
    inverse_mesh = np.linalg.inv(worlds[mesh_node])
    matrices = np.stack([
        inverse_mesh @ worlds[joint] @ inverse_bind[i]
        for i, joint in enumerate(skin["joints"])
    ])
    return matrices


def normalized_base_color_factor(pbr: dict) -> tuple[float, float, float, float]:
    values = pbr.get("baseColorFactor", [1.0, 1.0, 1.0, 1.0])
    if not isinstance(values, list) or len(values) != 4:
        raise ValueError("glTF baseColorFactor must contain four values")
    # pyrender treats integer numpy color vectors as 0..255, so normalize
    # glTF's already-normalized 0..1 factors explicitly to float.
    result = tuple(float(value) for value in values)
    if not all(math.isfinite(value) and 0.0 <= value <= 1.0 for value in result):
        raise ValueError("glTF baseColorFactor is outside normalized 0..1 range")
    return result


def validate_asset_image(doc: dict, buffers: list[bytes], model_path: Path,
                          image_index: int, Image):
    image = doc["images"][image_index]
    if "uri" in image:
        return Image.open(safe_local_path(model_path.parent, image["uri"])).convert("RGBA").copy()
    if "bufferView" in image:
        view = doc["bufferViews"][image["bufferView"]]
        buffer = buffers[view.get("buffer", 0)]
        start, end = view.get("byteOffset", 0), view.get("byteOffset", 0) + view["byteLength"]
        if end > len(buffer):
            raise ValueError("Embedded image exceeds its glTF buffer")
        return Image.open(io.BytesIO(buffer[start:end])).convert("RGBA").copy()
    raise ValueError("Image has no local URI or embedded bufferView")


def run_render(target_path: Path, source_archive: Path, source_suffix: str, output: Path):
    # Select headless EGL before pyrender/PyOpenGL imports (X230i has no X display).
    os.environ.setdefault("PYOPENGL_PLATFORM", "egl")
    os.environ.setdefault("LIBGL_ALWAYS_SOFTWARE", "1")
    import numpy as np
    import trimesh
    import pyrender
    from PIL import Image

    target, target_buffers = load_gltf(target_path)
    source, source_buffers, source_member = load_glb_from_zip(source_archive, source_suffix)
    topology = validate_skeleton_pair(source, target)
    source_sha = sha256(source_archive.read_bytes())
    target_sha = sha256(target_path.read_bytes())

    source_world = world_matrices(source, {}, np)
    source_mesh_nodes = [i for i, n in enumerate(source["nodes"])
                         if "mesh" in n and "skin" in n]
    if not source_mesh_nodes:
        raise ValueError("Source animation library has no skinned mesh node")
    source_skin_error = max(
        float(np.max(np.abs(skin_matrices(source, source_buffers, source_world, i, np)
                            - np.eye(4))))
        for i in source_mesh_nodes
    )
    target_rest_world = world_matrices(target, {}, np)
    target_mesh_nodes = [i for i, n in enumerate(target["nodes"])
                         if "mesh" in n and "skin" in n]
    if not target_mesh_nodes:
        raise ValueError("Target outfit has no skinned mesh nodes")
    target_skin_error = max(
        float(np.max(np.abs(skin_matrices(target, target_buffers, target_rest_world, i, np)
                            - np.eye(4))))
        for i in target_mesh_nodes
    )
    if source_skin_error > 5e-4 or target_skin_error > 5e-4:
        raise ValueError(f"Bind skin matrices not identity (source={source_skin_error}, target={target_skin_error})")

    def world_bounds(doc, buffers, worlds, mesh_nodes):
        vertices = []
        for node_index in mesh_nodes:
            mesh = doc["meshes"][doc["nodes"][node_index]["mesh"]]
            for primitive in mesh.get("primitives", []):
                rows = accessor_values(doc, buffers, primitive["attributes"]["POSITION"])
                local = np.asarray(rows, dtype=float)
                h = np.concatenate((local, np.ones((len(local), 1))), axis=1)
                vertices.append((worlds[node_index] @ h.T).T[:, :3])
        joined = np.concatenate(vertices, axis=0)
        return joined.min(axis=0), joined.max(axis=0), joined

    s_min, s_max, _ = world_bounds(source, source_buffers, source_world, source_mesh_nodes)
    t_min, t_max, target_bind_world_vertices = world_bounds(target, target_buffers, target_rest_world, target_mesh_nodes)
    source_height, target_height = float(s_max[1]-s_min[1]), float(t_max[1]-t_min[1])
    if not (0.5 < source_height < 5.0 and 0.5 < target_height < 5.0):
        raise ValueError(f"Unexpected humanoid source/target scale: {source_height}, {target_height}")
    height_ratio = target_height / source_height
    center = (t_min + t_max) / 2.0
    span = max(target_height * 1.2, 1.8)

    # Decode target mesh attributes once; all vendor bytes remain local/private.
    image_cache = {}
    material_cache = {}

    def material_for(index):
        if index in material_cache:
            return material_cache[index]
        material_doc = target.get("materials", [])[index] if index is not None else {}
        pbr = material_doc.get("pbrMetallicRoughness", {})
        texture = None
        tex_info = pbr.get("baseColorTexture")
        if tex_info is not None:
            texture_index = tex_info["index"]
            image_index = target["textures"][texture_index]["source"]
            if image_index not in image_cache:
                image_cache[image_index] = validate_asset_image(
                    target, target_buffers, target_path, image_index, Image
                )
            texture = image_cache[image_index]
        mat = pyrender.MetallicRoughnessMaterial(
            baseColorTexture=texture,
            baseColorFactor=normalized_base_color_factor(pbr),
            metallicFactor=float(pbr.get("metallicFactor", 1.0)),
            roughnessFactor=float(pbr.get("roughnessFactor", 1.0)),
            alphaMode=material_doc.get("alphaMode", "OPAQUE"),
            alphaCutoff=float(material_doc.get("alphaCutoff", 0.5)),
            doubleSided=bool(material_doc.get("doubleSided", False)),
        )
        material_cache[index] = mat
        return mat

    parts = []
    for node_index in target_mesh_nodes:
        node = target["nodes"][node_index]
        for prim_index, primitive in enumerate(target["meshes"][node["mesh"]].get("primitives", [])):
            if primitive.get("mode", 4) != 4:
                raise ValueError("Only triangle primitives are supported for character preview")
            attrs = primitive["attributes"]
            required = ("POSITION", "JOINTS_0", "WEIGHTS_0", "NORMAL", "TEXCOORD_0")
            if any(name not in attrs for name in required):
                raise ValueError(f"Skinned primitive lacks required attributes: {node.get('name')}")
            positions = np.asarray(accessor_values(target, target_buffers, attrs["POSITION"]), dtype=float)
            normals = np.asarray(accessor_values(target, target_buffers, attrs["NORMAL"]), dtype=float)
            joints = np.asarray(accessor_values(target, target_buffers, attrs["JOINTS_0"]), dtype=int)
            weights = np.asarray(accessor_values(target, target_buffers, attrs["WEIGHTS_0"]), dtype=float)
            uv = np.asarray(accessor_values(target, target_buffers, attrs["TEXCOORD_0"]), dtype=float)
            faces = (np.asarray(accessor_values(target, target_buffers, primitive["indices"]), dtype=int).reshape(-1)
                     if "indices" in primitive else np.arange(len(positions), dtype=int))
            if len(faces) % 3 or len(joints) != len(positions) or len(weights) != len(positions):
                raise ValueError("Malformed skinned primitive vertex/index counts")
            if np.any(joints < 0) or np.any(joints >= len(target["skins"][node["skin"]]["joints"])):
                raise ValueError("Vertex joint index outside target skin")
            sums = weights.sum(axis=1)
            if np.any(sums <= 1e-8):
                raise ValueError("Vertex has no positive skin weights")
            weights = weights / sums[:, None]
            parts.append({
                "node": node_index, "name": node.get("name", str(node_index)),
                "positions": positions, "normals": normals, "joints": joints,
                "weights": weights, "uv": uv, "faces": faces.reshape(-1, 3),
                "material": material_for(primitive.get("material")),
            })
    if not parts:
        raise ValueError("No target mesh primitives decoded")

    def skin_parts(pose):
        worlds = world_matrices(target, pose, np)
        outputs, vertex_deltas, angular_deltas = [], [], []
        for part in parts:
            palette = skin_matrices(target, target_buffers, worlds, part["node"], np)
            pos_h = np.concatenate((part["positions"], np.ones((len(part["positions"]), 1))), axis=1)
            selected = palette[part["joints"]]
            transformed = np.einsum("nkij,nj->nki", selected, pos_h)[:, :, :3]
            skinned = np.sum(transformed * part["weights"][:, :, None], axis=1)
            normal_palette = np.transpose(np.linalg.inv(palette[:, :3, :3]), (0, 2, 1))
            selected_normals = normal_palette[part["joints"]]
            normals = np.einsum("nkij,nj->nki", selected_normals, part["normals"])
            normals = np.sum(normals * part["weights"][:, :, None], axis=1)
            lengths = np.linalg.norm(normals, axis=1)
            normals = normals / np.maximum(lengths[:, None], 1e-12)
            vertex_deltas.extend(np.linalg.norm(skinned - part["positions"], axis=1).tolist())
            visual = trimesh.visual.texture.TextureVisuals(uv=part["uv"])
            tm = trimesh.Trimesh(vertices=skinned, faces=part["faces"],
                                 vertex_normals=normals, visual=visual, process=False)
            outputs.append((pyrender.Mesh.from_trimesh(tm, material=part["material"], smooth=True),
                            worlds[part["node"]]))
        for name, index in joint_map(target).items():
            base = rest_trs(target["nodes"][index])["rotation"]
            current = pose.get(index, rest_trs(target["nodes"][index]))["rotation"]
            dot = abs(sum(a*b for a, b in zip(quat_normalize(base), quat_normalize(current))))
            angle = 2.0 * math.acos(min(1.0, max(-1.0, dot)))
            if angle > 1e-3:
                angular_deltas.append(angle)
        return outputs, vertex_deltas, angular_deltas

    def look_at(eye, aim):
        up = np.asarray([0., 1., 0.])
        z = eye - aim
        z = z / np.linalg.norm(z)
        x = np.cross(up, z)
        x = x / np.linalg.norm(x)
        y = np.cross(z, x)
        matrix = np.eye(4)
        matrix[:3, :3] = np.stack((x, y, z), axis=1)
        matrix[:3, 3] = eye
        return matrix

    camera = pyrender.OrthographicCamera(xmag=span * .61, ymag=span * .61,
                                         znear=.02, zfar=50)
    camera_pose = look_at(center + np.asarray([0., target_height*.13, max(target_height*2.8, 3.5)], dtype=float), center)
    light_a = pyrender.DirectionalLight(color=np.ones(3), intensity=2.5)
    light_b = pyrender.DirectionalLight(color=np.asarray([.65, .75, 1.]), intensity=1.0)
    output.mkdir(parents=True, exist_ok=True)
    renderer = pyrender.OffscreenRenderer(viewport_width=160, viewport_height=160, point_size=1)
    clip_reports = []
    try:
        for clip_name, phases in APPROVED_CLIPS.items():
            sheet = Image.new("RGBA", (8*160, len(phases)*160), (35, 38, 49, 255))
            phase_reports = []
            for phase_index, fraction in enumerate(phases):
                sampled, sample_time, duration = sample_clip(
                    source, source_buffers, clip_name, fraction
                )
                pose = retarget_pose(source, target, sampled, height_ratio)
                rendered_parts, vertex_deltas, angular_deltas = skin_parts(pose)
                max_delta = max(vertex_deltas, default=0.0)
                rms_delta = math.sqrt(sum(v*v for v in vertex_deltas) / max(1, len(vertex_deltas)))
                row_dir = output / clip_name / f"phase_{phase_index:02d}"
                row_dir.mkdir(parents=True, exist_ok=True)
                coverage = []
                for direction in range(8):
                    angle = direction * math.pi / 4
                    c, s = math.cos(angle), math.sin(angle)
                    yaw = np.eye(4)
                    yaw[:3, :3] = [[c, 0, s], [0, 1, 0], [-s, 0, c]]
                    to_center = np.eye(4)
                    to_center[:3, 3] = center
                    from_center = np.eye(4)
                    from_center[:3, 3] = -center
                    turn = to_center @ yaw @ from_center
                    scene = pyrender.Scene(bg_color=[.11, .13, .16, 0.],
                                           ambient_light=[.38, .38, .40])
                    for mesh, mesh_world in rendered_parts:
                        scene.add(mesh, pose=turn @ mesh_world)
                    scene.add(camera, pose=camera_pose)
                    scene.add(light_a, pose=look_at(center + np.asarray([3., 5., 4.]), center))
                    scene.add(light_b, pose=look_at(center + np.asarray([-3., 2., -2.]), center))
                    rgba, _ = renderer.render(scene, flags=pyrender.RenderFlags.RGBA)
                    alpha_pixels = int((rgba[:, :, 3] > 127).sum())
                    if not 250 <= alpha_pixels <= 20_000:
                        raise ValueError(f"{clip_name} phase {fraction} direction {direction}: blank/clipped frame ({alpha_pixels})")
                    frame = Image.fromarray(rgba, mode="RGBA")
                    frame_path = row_dir / f"facing_{direction*45:03d}.png"
                    frame.save(frame_path)
                    sheet.paste(frame, (direction*160, phase_index*160), frame)
                    coverage.append(alpha_pixels)
                phase_reports.append({
                    "fraction": fraction, "sample_time_seconds": sample_time,
                    "clip_duration_seconds": duration,
                    "animated_joints_over_0_001_rad": len(angular_deltas),
                    "max_vertex_displacement_m": max_delta,
                    "rms_vertex_displacement_m": rms_delta,
                    "alpha_coverage_min": min(coverage), "alpha_coverage_max": max(coverage),
                    "eight_facing_frames": 8,
                })
                print("RENDERED", clip_name, fraction, "eight views",
                      "animated joints", len(angular_deltas),
                      "max displacement", round(max_delta, 4), flush=True)
            sheet_path = output / clip_name / "eight_facing_phase_contact_sheet.png"
            sheet.save(sheet_path)
            clip_reports.append({
                "clip": clip_name, "phase_count": len(phases), "view_count": 8*len(phases),
                "contact_sheet": str(sheet_path),
                "contact_sheet_sha256": sha256(sheet_path.read_bytes()),
                "phases": phase_reports,
            })
    finally:
        renderer.delete()

    report = {
        "status": "HOLD_OFFLINE_SOURCE_CLIP_RETARGET_VISUAL_REVIEW",
        "method": "local TRS delta retarget relative to source and target rest pose; CPU glTF linear blend skinning; real UAL1 source clips; eight actual mesh rotations",
        "source_archive": source_archive.name,
        "source_archive_sha256": source_sha,
        "source_model_member": source_member,
        "target_model": target_path.name,
        "target_model_sha256": target_sha,
        "source_skin_bind_matrix_max_error": source_skin_error,
        "target_skin_bind_matrix_max_error": target_skin_error,
        "source_character_height_m": source_height,
        "target_character_height_m": target_height,
        "translation_delta_scale_ratio": height_ratio,
        "topology": topology,
        "render_resolution": [160, 160],
        "direction_yaw_degrees": [0,45,90,135,180,225,270,315],
        "clip_reports": clip_reports,
        "limitations": [
            "No inverse-bind or target geometry is committed; all vendor data remains private.",
            "This is a real source-clip CPU skinning prototype, not an exported playable animation asset.",
            "Camera yaw rows are rotations, not yet mapped to Rust World cardinal/East-West semantics.",
            "No physical ground/shadow, foot-contact solver, root-motion policy acceptance or Art Director approval.",
            "No Chrome/Firefox 2/4-player Rust World performance/visual acceptance; P0 Silver Knight unchanged.",
        ],
    }
    report_path = output / "retarget-review.json"
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print("REPORT", report_path, "clips", len(clip_reports),
          "views", sum(c["view_count"] for c in clip_reports),
          "status", report["status"], flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--target-model", type=Path, required=True,
                        help="Private staged outfit glTF; preview textures may be reduced, geometry must remain original")
    parser.add_argument("--source-archive", type=Path, required=True,
                        help="Official free Standard UAL1 ZIP stored privately")
    parser.add_argument("--source-model", default="UAL1_Standard.glb",
                        help="Unique suffix of the source animation GLB inside that ZIP")
    parser.add_argument("--output", type=Path, required=True,
                        help="Private output folder; never point this at a tracked repository path")
    args = parser.parse_args()
    if not args.target_model.is_file() or not args.source_archive.is_file():
        raise FileNotFoundError("Private staged target/source file missing")
    run_render(args.target_model, args.source_archive, args.source_model, args.output)


if __name__ == "__main__":
    main()

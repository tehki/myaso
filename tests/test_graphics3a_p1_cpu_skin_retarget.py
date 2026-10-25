"""Synthetic safety/math tests for the offline UAL1 -> outfit retarget prototype."""
import json
import math
import struct
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from graphics3a_p1_cpu_skin_retarget import (
    accessor_values, parse_glb_bytes, quat_multiply, quat_normalize, quat_slerp,
    retarget_trs, safe_local_path, sample_track, validate_skeleton_pair,
)

IDENTITY = [0.0, 0.0, 0.0, 1.0]


class CpuSkinRetargetTests(unittest.TestCase):
    def test_quaternion_identity_multiply(self):
        q = quat_normalize([0.1, -0.2, 0.3, 0.9])
        self.assertAlmostEqual(quat_multiply(IDENTITY, q)[3], q[3], places=7)
        self.assertAlmostEqual(quat_multiply(q, IDENTITY)[2], q[2], places=7)

    def test_slerp_midpoint_uses_shortest_quaternion_path(self):
        end = [0.0, 0.0, 1.0, 0.0]
        middle = quat_slerp(IDENTITY, end, 0.5)
        self.assertAlmostEqual(middle[2], math.sqrt(0.5), places=6)
        self.assertAlmostEqual(middle[3], math.sqrt(0.5), places=6)
        self.assertAlmostEqual(sum(v*v for v in middle), 1.0, places=6)

    def test_source_rest_pose_maps_exactly_to_target_rest(self):
        source = {"translation": [1, 2, 3], "rotation": IDENTITY, "scale": [1, 1, 1]}
        target = {"translation": [-2, 4, 8], "rotation": quat_normalize([.5, 0, 0, .5]), "scale": [2, 3, 4]}
        result = retarget_trs(source, source, target, 1.7)
        for key in ("translation", "rotation", "scale"):
            for actual, expected in zip(result[key], target[key]):
                self.assertAlmostEqual(actual, expected, places=6)

    def test_translation_delta_scales_from_source_rest(self):
        source_rest = {"translation": [1, 2, 3], "rotation": IDENTITY, "scale": [1, 1, 1]}
        source_pose = {"translation": [2, 2, 1], "rotation": IDENTITY, "scale": [1, 1, 1]}
        target_rest = {"translation": [4, 5, 6], "rotation": IDENTITY, "scale": [1, 1, 1]}
        result = retarget_trs(source_rest, source_pose, target_rest, 2)
        self.assertEqual(result["translation"], [6, 5, 2])

    def test_rotation_delta_is_applied_on_target_rest_orientation(self):
        source_rest = {"translation": [0, 0, 0], "rotation": IDENTITY, "scale": [1, 1, 1]}
        delta = quat_normalize([0, 0, math.sin(math.pi/4), math.cos(math.pi/4)])
        source_pose = {"translation": [0, 0, 0], "rotation": delta, "scale": [1, 1, 1]}
        target_q = quat_normalize([math.sin(math.pi/4), 0, 0, math.cos(math.pi/4)])
        target_rest = {"translation": [0, 0, 0], "rotation": target_q, "scale": [1, 1, 1]}
        result = retarget_trs(source_rest, source_pose, target_rest, 1)
        expected = quat_normalize(quat_multiply(target_q, delta))
        for actual, want in zip(result["rotation"], expected):
            self.assertAlmostEqual(actual, want, places=6)

    def test_scale_ratio_is_relative_to_each_rest_pose(self):
        source_rest = {"translation": [0, 0, 0], "rotation": IDENTITY, "scale": [2, 4, 8]}
        source_pose = {"translation": [0, 0, 0], "rotation": IDENTITY, "scale": [1, 8, 4]}
        target_rest = {"translation": [0, 0, 0], "rotation": IDENTITY, "scale": [3, 2, 1]}
        self.assertEqual(retarget_trs(source_rest, source_pose, target_rest, 1)["scale"], [1.5, 4.0, 0.5])

    def test_linear_vector_sampling(self):
        result = sample_track([0, 2], [[0, 2, 4], [2, 4, 6]], 0.5, "translation")
        self.assertEqual(result, [0.5, 2.5, 4.5])

    def test_rotation_track_sampling_uses_slerp(self):
        end = [0, 0, 1, 0]
        result = sample_track([0, 1], [IDENTITY, end], 0.5, "rotation")
        self.assertAlmostEqual(result[2], math.sqrt(.5), places=6)
        self.assertAlmostEqual(result[3], math.sqrt(.5), places=6)

    def test_step_track_holds_previous_key(self):
        result = sample_track([0, 1, 2], [[1], [4], [9]], 1.9, "translation", "STEP")
        self.assertEqual(result, [4])

    def test_cubic_spline_sampling_uses_tangents(self):
        # One scalar component with zero tangents interpolates from 0 to 1.
        keys = [[0], [0], [1], [1], [0], [0]]
        result = sample_track([0, 1], keys, 0.5, "translation", "CUBICSPLINE")
        self.assertAlmostEqual(result[0], 0.5, places=6)

    def test_accessor_decoder_respects_interleaved_stride(self):
        payload = struct.pack("<6f", 1, 2, 99, 3, 4, 88)
        doc = {
            "bufferViews": [{"buffer": 0, "byteOffset": 0, "byteLength": len(payload), "byteStride": 12}],
            "accessors": [{"bufferView": 0, "byteOffset": 0, "componentType": 5126, "count": 2, "type": "VEC2"}],
        }
        self.assertEqual(accessor_values(doc, [payload], 0), [[1.0, 2.0], [3.0, 4.0]])

    def test_glb_parser_reads_json_and_bin_chunks(self):
        json_chunk = json.dumps({"asset": {"version": "2.0"}, "buffers": [{"byteLength": 4}]}).encode()
        json_chunk += b" " * ((-len(json_chunk)) % 4)
        binary = b"ABCD"
        chunks = struct.pack("<II", len(json_chunk), 0x4E4F534A) + json_chunk
        chunks += struct.pack("<II", len(binary), 0x004E4942) + binary
        payload = struct.pack("<4sII", b"glTF", 2, 12 + len(chunks)) + chunks
        doc, buffers = parse_glb_bytes(payload)
        self.assertEqual(doc["asset"]["version"], "2.0")
        self.assertEqual(buffers, [binary])

    def test_glb_parser_rejects_bad_declared_length(self):
        with self.assertRaisesRegex(ValueError, "header"):
            parse_glb_bytes(struct.pack("<4sII", b"glTF", 2, 999) + b"12345678")

    def test_safe_local_path_rejects_traversal_and_remote_uris(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / "asset.bin").write_bytes(b"ok")
            self.assertEqual(safe_local_path(root, "asset.bin"), root / "asset.bin")
            for bad in ("../secret.bin", "https://example.invalid/a.bin", "/etc/passwd", "C:\\\\secret.bin"):
                with self.subTest(uri=bad), self.assertRaises(ValueError):
                    safe_local_path(root, bad)

    def test_source_target_joint_names_and_parent_topology_must_match(self):
        source = {"nodes": [
            {"name": "Armature", "children": [1]},
            {"name": "root", "children": [2]},
            {"name": "pelvis"},
        ], "skins": [{"joints": [1, 2]}]}
        target = json.loads(json.dumps(source))
        report = validate_skeleton_pair(source, target)
        self.assertEqual(report["joint_count"], 2)
        target["nodes"][2]["name"] = "hip"
        with self.assertRaisesRegex(ValueError, "joint names differ"):
            validate_skeleton_pair(source, target)

    def test_parent_topology_mismatch_is_not_silently_accepted(self):
        source = {"nodes": [
            {"name": "Armature", "children": [1, 2]},
            {"name": "root"},
            {"name": "pelvis"},
        ], "skins": [{"joints": [1, 2]}]}
        target = {"nodes": [
            {"name": "Armature", "children": [1]},
            {"name": "root", "children": [2]},
            {"name": "pelvis"},
        ], "skins": [{"joints": [1, 2]}]}
        with self.assertRaisesRegex(ValueError, "hierarchy differs"):
            validate_skeleton_pair(source, target)


if __name__ == "__main__":
    unittest.main()

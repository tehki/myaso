"""No-vendor-file safety and bone/pose regression tests for Graphics 3A P1."""
import json
import sys
import tempfile
import unittest
from pathlib import Path
from zipfile import ZipFile

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from graphics3a_p1_rig_probe import compare, read_model


def rig(nodes=None):
    skeleton = nodes if nodes is not None else [
        {"name": "root"},
        {"name": "pelvis", "translation": [0, 0, 1]},
        {"name": "head", "translation": [0, 0, 0.5]},
    ]
    return {"skins": [{"joints": list(range(len(skeleton)))}], "nodes": skeleton}


class RigProbeTest(unittest.TestCase):
    def test_identical_rig_is_comparable_but_not_release_approved(self):
        result = compare(rig(), rig())
        self.assertTrue(result["same_joint_names_and_order"])
        self.assertEqual(result["different_rest_transform_count"], 0)
        self.assertFalse(result["needs_pose_aware_retarget_review"])
        self.assertEqual(result["release_status"], "HOLD_OFFLINE_METADATA_ONLY")

    def test_same_names_different_rest_pose_requires_retarget(self):
        changed = rig([{"name": "root"}, {"name": "pelvis", "translation": [0, 0, .9]},
                       {"name": "head", "translation": [0, 0, .5]}])
        result = compare(rig(), changed)
        self.assertTrue(result["same_joint_names_and_order"])
        self.assertEqual(result["different_rest_transform_count"], 1)
        self.assertTrue(result["needs_pose_aware_retarget_review"])
        self.assertEqual(result["different_rest_transform_examples"][0]["joint"], "pelvis")

    def test_quaternion_double_cover_sign_not_false_difference(self):
        before = rig([{"name": "root", "rotation": [0, 0, 0, 1]}])
        after = rig([{"name": "root", "rotation": [0, 0, 0, -1]}])
        self.assertEqual(compare(before, after)["different_rest_transform_count"], 0)

    def test_reordered_joints_not_valid_direct_mapping(self):
        before = rig()
        after = rig([{"name": "pelvis", "translation": [0, 0, 1]},
                     {"name": "root"}, {"name": "head", "translation": [0, 0, .5]}])
        result = compare(before, after)
        self.assertFalse(result["same_joint_names_and_order"])
        self.assertTrue(result["needs_pose_aware_retarget_review"])

    def test_additional_and_missing_bones_are_reported(self):
        before = rig([{"name": "root"}, {"name": "pelvis"}])
        after = rig([{"name": "root"}, {"name": "hand"}])
        result = compare(before, after)
        self.assertEqual(result["missing_source_joints"], ["pelvis"])
        self.assertEqual(result["candidate_extra_joints"], ["hand"])

    def test_matrix_nodes_are_not_declared_compatible(self):
        before = rig([{"name": "root", "matrix": [1] * 16}])
        result = compare(before, rig([{"name": "root"}]))
        self.assertTrue(result["needs_pose_aware_retarget_review"])
        self.assertEqual(result["non_trs_matrix_joint_names"], ["root"])

    def test_archive_metadata_read_only_gltf(self):
        with tempfile.TemporaryDirectory() as tmp:
            archive = Path(tmp) / "synthetic.zip"
            with ZipFile(archive, "w") as z:
                z.writestr("Vendor/Example.gltf", json.dumps(rig()))
            self.assertEqual(len(read_model(archive, "Example.gltf")["nodes"]), 3)
            with self.assertRaisesRegex(ValueError, "not unique"):
                read_model(archive, "not-existing.gltf")

    def test_duplicate_names_fail_closed(self):
        with self.assertRaisesRegex(ValueError, "duplicate bone"):
            compare(rig([{"name": "root"}, {"name": "root"}]), rig())

    def test_invalid_tolerance_rejected(self):
        with self.assertRaisesRegex(ValueError, "Tolerance"):
            compare(rig(), rig(), tolerance=0.2)


if __name__ == "__main__":
    unittest.main()

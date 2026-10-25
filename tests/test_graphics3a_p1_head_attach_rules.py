"""Source-only, no-vendor regressions for private P1 Peasant head lookdev."""
import math
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from graphics3a_p1_head_attach_rules import (
    archive_uri, choose_head_faces, head_cut_from_mesh_top,
    remap_joint_indices, validate_upper_anchors,
)


class HeadAttachmentRulesTests(unittest.TestCase):
    def test_zip_dependency_stays_local(self):
        self.assertEqual(
            archive_uri("Base Characters/Godot - UE/", "T_Eye_Brown.png"),
            "Base Characters/Godot - UE/T_Eye_Brown.png",
        )

    def test_archive_uri_rejects_traversal_absolute_urls(self):
        for uri in ("../secret.bin", "/etc/passwd", "https://example.invalid/a.png",
                    "C:\\secret.bin"):
            with self.subTest(uri=uri), self.assertRaises(ValueError):
                archive_uri("Base/", uri)

    def test_archive_prefix_cannot_escape(self):
        with self.assertRaises(ValueError):
            archive_uri("../bad/", "texture.png")

    def test_head_cut_is_above_outfit_mesh_top(self):
        self.assertAlmostEqual(head_cut_from_mesh_top(1.55865478), 1.57865478)
        self.assertAlmostEqual(head_cut_from_mesh_top(1.51843297), 1.53843297)

    def test_head_cut_rejects_nonfinite_height_and_negative_clearance(self):
        for top, clearance in ((math.nan, .02), (1.5, math.inf), (1.5, -.01)):
            with self.subTest(top=top, clearance=clearance), self.assertRaises(ValueError):
                head_cut_from_mesh_top(top, clearance)

    def test_joint_map_is_by_name_not_order(self):
        self.assertEqual(
            remap_joint_indices(["Head", "root", "neck_01"],
                                ["root", "neck_01", "Head"]),
            [2, 0, 1],
        )

    def test_joint_map_rejects_mismatched_or_duplicate(self):
        for source, target in (
            (["Head", "root"], ["Head", "neck_01"]),
            (["Head", "Head"], ["Head", "neck_01"]),
            ([], []),
        ):
            with self.subTest(source=source, target=target), self.assertRaises(ValueError):
                remap_joint_indices(source, target)

    def test_head_mesh_face_selection_uses_real_threshold(self):
        self.assertEqual(choose_head_faces([1.2, 1.56, 1.60, 1.75], 1.58), [2, 3])

    def test_head_mesh_face_selection_rejects_nonfinite(self):
        with self.assertRaises(ValueError):
            choose_head_faces([1.5, math.nan], 1.58)
        with self.assertRaises(ValueError):
            choose_head_faces([1.6], math.inf)

    def test_upper_joint_anchor_matches(self):
        anchors = {"Head": [0, 1.6, 0], "neck_01": [0, 1.52, 0]}
        self.assertEqual(
            validate_upper_anchors(anchors, anchors, ("Head", "neck_01")),
            {"Head": 0.0, "neck_01": 0.0},
        )

    def test_upper_joint_anchor_rejects_mismatch(self):
        with self.assertRaisesRegex(ValueError, "differs"):
            validate_upper_anchors({"Head": [0, 1.6, 0]},
                                   {"Head": [0, 1.63, 0]}, ("Head",))

    def test_upper_joint_anchor_requires_finite_positions(self):
        with self.assertRaises(ValueError):
            validate_upper_anchors({"Head": [math.nan, 1.6, 0]},
                                   {"Head": [0, 1.6, 0]}, ("Head",))


if __name__ == "__main__":
    unittest.main()

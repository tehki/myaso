"""Synthetic seam checker tests: NOT original-source animation proof."""
import copy
import math
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from graphics3a_p1_animated_neck_interface import verify_animated_head_torso_seam


def caps():
    pos = [(0., 0., 0.), (1., 0., 0.), (1., 0., 1.), (0., 0., 1.)]
    head = {
        "positions": pos,
        "normals": [(0., -1., 0.)] * 4,
        "joints": [(0, 1, 2, 3)] * 4,
        "weights": [(.75, .25, 0., 0.)] * 4,
        "faces": [(0, 1, 2), (0, 2, 3)],
        "planar_loop_vertex_counts": [4],
    }
    torso = copy.deepcopy(head)
    torso["normals"] = [(0., 1., 0.)] * 4
    return head, torso


def matrix(dx=0., angle=0.):
    c, s = math.cos(angle), math.sin(angle)
    return [[c, 0., -s, dx], [0., 1., 0., 0.], [s, 0., c, 0.]]


def pose(name="Idle", dx=0., angle=0.):
    palette = {0: matrix(dx, angle), 1: matrix(-dx, -angle)}
    return {"name": name, "head_matrices": palette,
            "torso_matrices": copy.deepcopy(palette)}


class AnimatedNeckSeamTests(unittest.TestCase):
    def test_synthetic_idle_walk_sprint_jump_roll_agree(self):
        head, torso = caps()
        phases = [pose("Idle"), pose("Walk", .04, .1),
                  pose("Sprint", .08, -.2), pose("Jump", 0., .4),
                  pose("Roll", -.1, .7)]
        result = verify_animated_head_torso_seam(head, torso, phases)
        self.assertEqual(result["sampled_pose_count"], 5)
        self.assertEqual(result["boundary_vertex_count"], 4)
        self.assertEqual(result["max_boundary_separation_m"], 0.)
        self.assertIn("ART_AND_NATIVE_HOLD", result["status"])

    def test_independent_palette_drift_fails_closed(self):
        head, torso = caps()
        moved = pose("Walk")
        moved["torso_matrices"][0] = matrix(.05)
        with self.assertRaisesRegex(ValueError, "seam diverged"):
            verify_animated_head_torso_seam(head, torso, [moved])

    def test_small_drift_respects_meters_tolerance(self):
        head, torso = caps()
        moved = pose("Walk")
        moved["torso_matrices"][0] = matrix(.00002)
        result = verify_animated_head_torso_seam(head, torso, [moved])
        self.assertGreater(result["max_boundary_separation_m"], 0.)
        with self.assertRaisesRegex(ValueError, "seam diverged"):
            verify_animated_head_torso_seam(head, torso, [moved], .00001)

    def test_missing_original_weighted_joint_is_rejected(self):
        head, torso = caps()
        moved = pose()
        del moved["head_matrices"][1]
        with self.assertRaisesRegex(ValueError, "missing a weighted joint"):
            verify_animated_head_torso_seam(head, torso, [moved])

    def test_bad_joint_matrices_are_rejected(self):
        head, torso = caps()
        for bad in (matrix(float("nan")), [[1., 2.]], "invalid"):
            moved = pose()
            moved["torso_matrices"][0] = bad
            with self.subTest(matrix=bad), self.assertRaises(ValueError):
                verify_animated_head_torso_seam(head, torso, [moved])

    def test_no_missing_or_duplicate_pose_evidence(self):
        head, torso = caps()
        for samples in ([], [pose("Idle"), pose("Idle")], [pose("")]):
            with self.subTest(samples=samples), self.assertRaises(ValueError):
                verify_animated_head_torso_seam(head, torso, samples)

    def test_rest_mismatch_still_blocks_animated_claim(self):
        head, torso = caps()
        torso["positions"][0] = (3., 0., 0.)
        with self.assertRaises(ValueError):
            verify_animated_head_torso_seam(head, torso, [pose()])

    def test_invalid_tolerance_is_rejected(self):
        head, torso = caps()
        for tolerance in (0., -1., float("nan"), .2, True):
            with self.subTest(tolerance=tolerance), self.assertRaises(ValueError):
                verify_animated_head_torso_seam(head, torso, [pose()], tolerance)


if __name__ == "__main__":
    unittest.main()

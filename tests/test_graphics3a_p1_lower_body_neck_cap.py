"""Synthetic fail-closed tests for complementary original torso cap.

Structural art research only: these tests do not verify a bare source
body or game integration.
"""
import sys
import unittest
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"scripts"))
from graphics3a_p1_lower_body_neck_cap import lower_body_with_complementary_cap


def lower_pyramid(shift=0.):
    pos=[(shift+0.,0.,0.),(shift+1.,0.,0.),
         (shift+1.,0.,1.),(shift+0.,0.,1.),
         (shift+.5,-1.,.5)]
    return {
        "positions":pos,
        "normals":[(0.,-1.,0.) for _ in pos],
        "uv":[(0.,0.) for _ in pos],
        "joints":[(0,1,2,3) for _ in pos],
        "weights":[(1.,0.,0.,0.) for _ in pos],
        "faces":[(0,4,1),(1,4,2),(2,4,3),(3,4,0)],
    }


def apply(source, y=0.):
    return lower_body_with_complementary_cap(
        source["positions"],source["normals"],source["uv"],
        source["joints"],source["weights"],source["faces"],y)


class LowerBodyNeckCapTests(unittest.TestCase):
    def test_four_edge_lower_body_opening_capped(self):
        c=apply(lower_pyramid())
        self.assertEqual(c["torso_neck_cap"]["boundary_edges"],4)
        self.assertEqual(c["torso_neck_cap"]["cap_triangles"],2)
        self.assertEqual(c["torso_neck_cap"]["planar_loop_count"],1)

    def test_lower_torso_cap_outward_normals_point_up(self):
        c=apply(lower_pyramid())
        self.assertTrue(all(n==(0.,1.,0.) for n in c["torso_neck_cap"]["normals"]))

    def test_skin_weights_remain_in_original_source_joint_order(self):
        c=apply(lower_pyramid())
        self.assertEqual(c["torso_neck_cap"]["weights"],[(1.,0.,0.,0.)]*4)
        self.assertEqual(c["torso_neck_cap"]["joints"],[(0,1,2,3)]*4)

    def test_original_source_body_depth_is_unmirrored(self):
        c=apply(lower_pyramid())
        self.assertEqual(min(p[1] for p in c["lower_body"]["positions"]),-1.)
        self.assertEqual(max(p[1] for p in c["lower_body"]["positions"]),0.)

    def test_inputs_remain_unchanged(self):
        source=lower_pyramid()
        original=[p for p in source["positions"]]
        apply(source)
        self.assertEqual(source["positions"],original)

    def test_non_numeric_plane_fails_closed(self):
        for plane in (float("nan"),"0",None):
            with self.subTest(plane=plane),self.assertRaises(ValueError):
                apply(lower_pyramid(),plane)

    def test_no_gameplay_or_body_art_approval_claim(self):
        c=apply(lower_pyramid())
        self.assertIn("HOLD",c["status"])
        self.assertIn("NOT_VERIFIED_UNEQUIPPED",c["lower_body"]["status"])
        self.assertIn("NO_GAME_EXPORT",c["torso_neck_cap"]["status"])

    def test_original_bad_indices_not_silently_repaired(self):
        source=lower_pyramid()
        source["faces"].append((0,2,99))
        with self.assertRaises(ValueError):
            apply(source)


if __name__=="__main__":
    unittest.main()

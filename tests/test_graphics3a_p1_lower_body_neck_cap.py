"""Synthetic fail-closed tests for complementary original torso cap.

Structural art research only: these tests do not verify a bare source
body or game integration.
"""
import copy
import sys
import unittest
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"scripts"))
from graphics3a_p1_lower_body_neck_cap import lower_body_with_complementary_cap,verify_matching_head_torso_caps
from graphics3a_p1_head_plane_clip import clip_skinned_mesh_y
from graphics3a_p1_neck_cap_geometry import geometric_neck_cap


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


def complementary_caps():
    low=lower_pyramid()
    top=copy.deepcopy(low)
    top["positions"][4]=(0.5,1.,0.5)
    top["faces"]=[(0,1,4),(1,2,4),(2,3,4),(3,0,4)]
    upper_shell=clip_skinned_mesh_y(
        top["positions"],top["normals"],top["uv"],top["joints"],
        top["weights"],top["faces"],0.)
    head=geometric_neck_cap(upper_shell,0.)
    torso=apply(low)["torso_neck_cap"]
    return head,torso


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

    def test_independently_capped_head_and_torso_match_exactly(self):
        head,torso=complementary_caps()
        result=verify_matching_head_torso_caps(head,torso)
        self.assertEqual(result["matching_original_neck_vertices"],4)
        self.assertEqual(result["max_border_coordinate_delta_m"],0.)
        self.assertTrue(result["opposing_cap_normals"])

    def test_noncoincident_pair_of_cap_boundaries_is_rejected(self):
        head,torso=complementary_caps()
        torso["positions"][0]=(7.,0.,0.)
        with self.assertRaisesRegex(ValueError,"border geometry"):
            verify_matching_head_torso_caps(head,torso)

    def test_nonmatching_joint_influence_is_rejected(self):
        head,torso=complementary_caps()
        torso["weights"][0]=(0.,1.,0.,0.)
        with self.assertRaisesRegex(ValueError,"skin weights differ"):
            verify_matching_head_torso_caps(head,torso)

    def test_wrong_torso_cap_normal_is_rejected(self):
        head,torso=complementary_caps()
        torso["normals"][0]=(0.,-1.,0.)
        with self.assertRaisesRegex(ValueError,"normals are not opposite"):
            verify_matching_head_torso_caps(head,torso)

    def test_original_bad_indices_not_silently_repaired(self):
        source=lower_pyramid()
        source["faces"].append((0,2,99))
        with self.assertRaises(ValueError):
            apply(source)


if __name__=="__main__":
    unittest.main()

"""Synthetic P1 original-geometry plane clipping tests; vendor files not required."""
import math
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from graphics3a_p1_head_plane_clip import clip_skinned_mesh_y


class ClipHeadTests(unittest.TestCase):
    def setUp(self):
        self.pos=[(0,1.5,0),(1,1.7,0),(0,1.7,1)]
        self.norm=[(0,1,0)]*3
        self.uv=[(0,0),(1,0),(0,1)]
        self.joints=[(0,1,0,0)]*3
        self.weights=[(1,0,0,0)]*3
        self.faces=[(0,1,2)]

    def clip(self,height=1.6):
        return clip_skinned_mesh_y(self.pos,self.norm,self.uv,self.joints,self.weights,self.faces,height)

    def test_crossing_triangle_gets_two_faces(self):
        result=self.clip()
        self.assertEqual(len(result["faces"]),2)
        self.assertEqual(len(result["positions"]),6)

    def test_new_vertices_lie_exactly_on_cut_plane(self):
        r=self.clip()
        ys=[p[1] for p in r["positions"]]
        self.assertTrue(all(v>=1.6-1e-9 for v in ys))
        self.assertGreaterEqual(sum(abs(y-1.6)<1e-9 for y in ys),3)

    def test_uv_skin_weights_normal_are_valid(self):
        r=self.clip()
        for pos,normal,uv,indices,weights in zip(r["positions"],r["normals"],r["uv"],r["joints"],r["weights"]):
            self.assertEqual(len(pos),3)
            self.assertEqual(len(uv),2)
            self.assertEqual(len(indices),4)
            self.assertAlmostEqual(sum(weights),1)
            self.assertAlmostEqual(sum(v*v for v in normal),1)

    def test_clipping_all_above_preserves_one_triangle(self):
        r=self.clip(1.4)
        self.assertEqual(len(r["faces"]),1)

    def test_clipping_all_below_rejects_empty_head(self):
        with self.assertRaisesRegex(ValueError,"No head surface"):
            self.clip(1.8)

    def test_handles_interpolated_skinning_different_bones(self):
        self.joints=[(0,1,0,0),(1,0,0,0),(2,0,0,0)]
        self.weights=[(1,0,0,0)]*3
        r=self.clip()
        self.assertTrue(any(len([w for w in row if w>0])>=2 for row in r["weights"]))
        self.assertTrue(all(sum(row)>0.999 for row in r["weights"]))

    def test_wrong_attribute_count_rejected(self):
        with self.assertRaisesRegex(ValueError,"lengths differ"):
            clip_skinned_mesh_y(self.pos,self.norm[:2],self.uv,self.joints,self.weights,self.faces,1.6)

    def test_invalid_triangle_indices_rejected(self):
        with self.assertRaises(ValueError):
            clip_skinned_mesh_y(self.pos,self.norm,self.uv,self.joints,self.weights,[(0,1,55)],1.6)

    def test_nonfinite_source_geometry_rejected(self):
        self.pos[0]=(math.nan,1.5,0)
        with self.assertRaisesRegex(ValueError,"Nonfinite"):
            self.clip()

    def test_zero_weight_influence_rejected(self):
        self.weights[0]=(0,0,0,0)
        with self.assertRaisesRegex(ValueError,"No positive"):
            self.clip()

    def test_cut_height_nonfinite_rejected(self):
        with self.assertRaisesRegex(ValueError,"Invalid"):
            self.clip(math.inf)

    def test_result_can_never_claim_release_go(self):
        r=self.clip()
        self.assertIn("HOLD",r["status"])
        self.assertIn("no_cap",r["method"])


if __name__=="__main__":
    unittest.main()

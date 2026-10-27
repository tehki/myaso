"""Synthetic source-free checks of actual triangle (not vertex) collar distances."""
import math
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from graphics3a_p1_neck_surface_qc import (
    _point_triangle_squared, collar_surface_proximity,
)


class CollarSurfaceTests(unittest.TestCase):
    def setUp(self):
        # The cut-edge samples are 0.01m over a garment plane whose nearest
        # vertices are much farther away: vertex-only checks overestimate gap.
        self.head=[
            (-.10, 1.58, .01),
            (.10, 1.58, .01),
            (.10, 1.60, .01),
            (-.10, 1.60, .01),
        ]
        self.head_faces=[[0,1,2],[0,2,3]]
        self.outfit=[(-1,1.58,0),(1,1.58,0),(1,1.6,0),(-1,1.6,0)]
        self.outfit_faces=[[0,1,2],[0,2,3]]

    def test_point_inside_triangle_projects_to_plane(self):
        d2=_point_triangle_squared((.25,.25,.1),(0,0,0),(1,0,0),(0,1,0))
        self.assertAlmostEqual(d2,.01)

    def test_point_outside_triangle_projects_to_vertex(self):
        d2=_point_triangle_squared((-1,0,0),(0,0,0),(1,0,0),(0,1,0))
        self.assertAlmostEqual(d2,1)

    def test_point_outside_triangle_projects_to_edge(self):
        d2=_point_triangle_squared((.5,-.3,0),(0,0,0),(1,0,0),(0,1,0))
        self.assertAlmostEqual(d2,.09)

    def test_degenerate_triangle_rejected(self):
        with self.assertRaisesRegex(ValueError,"Degenerate"):
            _point_triangle_squared((0,0,0),(0,0,0),(0,0,0),(1,0,0))

    def test_nearest_surface_differs_from_sparse_vertex_distance(self):
        r=collar_surface_proximity(self.head,self.head_faces,self.outfit,self.outfit_faces,1.59)
        self.assertEqual(r["head_neck_cut_boundary_sample_count"],4)
        self.assertEqual(r["garment_candidate_triangle_count"],2)
        self.assertAlmostEqual(r["surface_distance_p50_m"],.01,places=6)
        self.assertAlmostEqual(r["surface_distance_p95_m"],.01,places=6)
        self.assertEqual(r["samples_over_2cm_fraction"],0)
        self.assertEqual(r["verdict"],"ART_DIRECTOR_SURFACE_SEAM_INSPECTION_REQUIRED")

    def test_outfit_surface_offset(self):
        new=[(x,y,.05) for x,y,z in self.outfit]
        r=collar_surface_proximity(self.head,self.head_faces,new,self.outfit_faces,1.59)
        self.assertAlmostEqual(r["surface_distance_p95_m"],.04,places=6)
        self.assertEqual(r["samples_over_2cm_fraction"],1)

    def test_outfit_missing_band_fails_closed(self):
        shifted=[(x,y-3,z) for x,y,z in self.outfit]
        with self.assertRaisesRegex(ValueError,"No nondegenerate"):
            collar_surface_proximity(self.head,self.head_faces,shifted,self.outfit_faces,1.59)

    def test_missing_head_boundary_fails_closed(self):
        with self.assertRaisesRegex(ValueError,"No open"):
            collar_surface_proximity(self.head,self.head_faces,self.outfit,self.outfit_faces,0.2)

    def test_invalid_face_indices_fail_closed(self):
        with self.assertRaisesRegex(ValueError,"Invalid triangle"):
            collar_surface_proximity(self.head,self.head_faces,self.outfit,[[0,1,90]],1.59)

    def test_nonfinite_vertex_or_cut_rejected(self):
        with self.assertRaises(ValueError):
            collar_surface_proximity(self.head,self.head_faces,[(0,math.inf,0),*self.outfit],self.outfit_faces,1.59)
        with self.assertRaises(ValueError):
            collar_surface_proximity(self.head,self.head_faces,self.outfit,self.outfit_faces,math.nan)

    def test_degenerate_outfit_faces_cannot_be_accepted(self):
        with self.assertRaisesRegex(ValueError,"No nondegenerate"):
            collar_surface_proximity(self.head,self.head_faces,self.outfit,[[0,0,1]],1.59)

    def test_diagnostic_cannot_claim_art_acceptance(self):
        r=collar_surface_proximity(self.head,self.head_faces,self.outfit,self.outfit_faces,1.59)
        self.assertNotIn("PASS",r["verdict"])
        self.assertIn("not signed",r["limitations"][0])


if __name__=="__main__":
    unittest.main()

"""Pure synthetic Graphics 3A neck/collar diagnostics; no vendor meshes used."""
import math
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from graphics3a_p1_neck_seam_qc import (
    neck_collar_proximity, open_edge_vertex_indices,
)


class NeckSeamQATests(unittest.TestCase):
    def setUp(self):
        # Two triangles share one interior edge; the other four edges are open.
        self.faces = [(0, 1, 2), (0, 2, 3)]
        self.head = [
            (0.0, 1.58, 0.0),
            (0.1, 1.58, 0.0),
            (0.1, 1.60, 0.0),
            (0.0, 1.60, 0.0),
        ]

    def test_open_boundary_not_shared_interior_diagonal(self):
        self.assertEqual(open_edge_vertex_indices(self.faces, 4), [0, 1, 2, 3])

    def test_closed_tetrahedron_has_no_open_boundary(self):
        faces = [(0, 1, 2), (0, 3, 1), (1, 3, 2), (0, 2, 3)]
        self.assertEqual(open_edge_vertex_indices(faces, 4), [])

    def test_invalid_or_empty_faces_fail_closed(self):
        for faces in (
            [], [(0, 0, 1)], [(0, 1, 99)], [(0, 1)],
            [(0, 1, 2), (0, 2, 1), (0, 1, 2)],
        ):
            with self.subTest(faces=faces), self.assertRaises(ValueError):
                open_edge_vertex_indices(faces, 4)

    def test_nearby_collar_vertices_report_zero_distance(self):
        report = neck_collar_proximity(self.head, self.faces, self.head, 1.59)
        self.assertEqual(report["sampled_neck_boundary_vertices"], 4)
        self.assertEqual(report["outfit_neck_band_vertices"], 4)
        self.assertEqual(report["nearest_garment_vertex_distance_p95_m"], 0.0)
        self.assertEqual(report["verdict"], "ART_DIRECTOR_SEAM_INSPECTION_REQUIRED")

    def test_offset_collar_returns_symmetric_distances(self):
        garment = [(x+0.04, y, z) for x, y, z in self.head]
        report = neck_collar_proximity(self.head, self.faces, garment, 1.59)
        self.assertTrue(report["nearest_garment_vertex_distance_max_m"] >= 0.04)
        self.assertEqual(report["neck_boundary_over_2cm_fraction"], 0.5)
        self.assertIn("not a surface-to-surface", report["limitations"][0])

    def test_neck_band_ignores_distant_body_mesh(self):
        garment = [(0, .3, 0), (.1, .7, 0)]
        with self.assertRaisesRegex(ValueError, "No outfit geometry"):
            neck_collar_proximity(self.head, self.faces, garment, 1.59)

    def test_missing_cut_boundary_never_passes(self):
        with self.assertRaisesRegex(ValueError, "No open head cut boundary"):
            neck_collar_proximity(self.head, self.faces, self.head, 0.1)

    def test_nonfinite_geometry_never_passes(self):
        for bad in (
            [(math.nan, 1.58, 0.0), *self.head[1:]],
            [(math.inf, 1.58, 0.0), *self.head[1:]],
        ):
            with self.subTest(bad=bad[0]), self.assertRaises(ValueError):
                neck_collar_proximity(bad, self.faces, self.head, 1.59)

    def test_nonfinite_cut_or_invalid_sampling_bands_fail(self):
        with self.assertRaises(ValueError):
            neck_collar_proximity(self.head, self.faces, self.head, math.nan)
        with self.assertRaises(ValueError):
            neck_collar_proximity(self.head, self.faces, self.head, 1.59, cut_band_m=-0.1)

    def test_seam_metric_must_not_be_interpreted_as_acceptance(self):
        report = neck_collar_proximity(self.head, self.faces, self.head, 1.59)
        self.assertNotIn("PASS", report["verdict"])
        self.assertTrue(any("Rest pose" in message for message in report["limitations"]))


if __name__ == "__main__":
    unittest.main()

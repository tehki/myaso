"""Vendor-free topology tests for private skinned Quaternius neck cut capping.

The closed geometry is a HEAD diagnostic, not approved decapitation art:
no torso-side cap, physics, skin/cloth fit proof, Combat or runtime.
"""
import copy
import sys
import unittest
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"scripts"))
from graphics3a_p1_neck_cap_geometry import geometric_neck_cap


def pyramid(xoffset=0.):
    """Open-topology skinned upper shell; four coplanar open lower edges."""
    pos=[
        (xoffset+0.,0.,0.),(xoffset+1.,0.,0.),
        (xoffset+1.,0.,1.),(xoffset+0.,0.,1.),
        (xoffset+.5,1.,.5),
    ]
    n=len(pos)
    return {
        "positions":pos,
        "normals":[(0.,1.,0.)]*n,
        "uv":[(0.,0.)]*n,
        "joints":[(0,1,2,3)]*n,
        "weights":[(1.,0.,0.,0.)]*n,
        "faces":[(0,1,4),(1,2,4),(2,3,4),(3,0,4)],
    }


def disjoint_meshes(first,second):
    merged={k:list(first[k]) for k in ("positions","normals","uv","joints","weights","faces")}
    offset=len(merged["positions"])
    for attr in ("positions","normals","uv","joints","weights"):
        merged[attr].extend(second[attr])
    merged["faces"].extend(tuple(i+offset for i in face) for face in second["faces"])
    return merged


class OriginalHeadCapGeometryTests(unittest.TestCase):
    def test_closes_simple_four_edge_neck_boundary(self):
        result=geometric_neck_cap(pyramid(),0.)
        self.assertEqual(result["boundary_edges"],4)
        self.assertEqual(result["cap_triangles"],2)
        self.assertEqual(result["planar_loop_count"],1)
        self.assertEqual(result["planar_loop_vertex_counts"],[4])

    def test_two_disconnected_neck_shells_cap_independently(self):
        joined=disjoint_meshes(pyramid(),pyramid(3.))
        result=geometric_neck_cap(joined,0.)
        self.assertEqual(result["planar_loop_count"],2)
        self.assertEqual(result["planar_loop_vertex_counts"],[4,4])
        self.assertEqual(result["cap_triangles"],4)

    def test_cap_normals_point_down_and_planar_uvs_are_finite(self):
        result=geometric_neck_cap(pyramid(),0.)
        self.assertTrue(all(v==(0.,-1.,0.) for v in result["normals"]))
        self.assertTrue(all(0<=u<=1 and 0<=v<=1 for u,v in result["uv"]))

    def test_cap_skin_weights_reuse_actual_shell_boundary(self):
        result=geometric_neck_cap(pyramid(),0.)
        self.assertEqual(result["joints"],[(0,1,2,3)]*4)
        self.assertEqual(result["weights"],[(1.,0.,0.,0.)]*4)

    def test_cap_preserves_art_and_release_hold(self):
        result=geometric_neck_cap(pyramid(),0.)
        self.assertIn("HOLD",result["status"])
        self.assertNotIn("torso",result["method"].lower())
        self.assertNotIn("production",result["status"].lower())

    def test_offplane_boundary_rejected(self):
        with self.assertRaisesRegex(ValueError,"non-neck open edges"):
            geometric_neck_cap(pyramid(),.05)

    def test_duplicate_source_triangle_cannot_be_capped(self):
        m=pyramid()
        m["faces"].append(m["faces"][0])
        with self.assertRaisesRegex(ValueError,"Nonmanifold"):
            geometric_neck_cap(m,0.)

    def test_bad_source_indices_rejected(self):
        m=pyramid()
        m["faces"].append((0,1,999))
        with self.assertRaisesRegex(ValueError,"Malformed"):
            geometric_neck_cap(m,0.)

    def test_bad_or_nonnormalized_joint_weights_rejected(self):
        m=pyramid()
        m["weights"][0]=(.3,.3,0.,0.)
        with self.assertRaisesRegex(ValueError,"Unnormalized"):
            geometric_neck_cap(m,0.)

    def test_nested_open_cut_loops_rejected(self):
        outer=pyramid()
        inner=pyramid(.1)
        # Shift and scale inner pyramid to be wholly inside the first.
        inner["positions"]=[(.15+(.20 if i==1 or i==2 else 0),
                             v[1],.15+(.20 if i==2 or i==3 else 0))
                            for i,v in enumerate(inner["positions"])]
        nested=disjoint_meshes(outer,inner)
        with self.assertRaisesRegex(ValueError,"Nested"):
            geometric_neck_cap(nested,0.)

    def test_duplicate_boundary_position_with_different_skin_weights_rejected(self):
        m=pyramid()
        m["positions"].append(m["positions"][0])
        m["normals"].append((0.,1.,0.))
        m["uv"].append((0.,0.))
        m["joints"].append((0,1,2,3))
        m["weights"].append((0.,1.,0.,0.))
        with self.assertRaisesRegex(ValueError,"Nonmatching neck seam"):
            geometric_neck_cap(m,0.)

    def test_invalid_cut_height_or_tolerance_rejected(self):
        for height,tol in ((float("nan"),1e-5),(0.,-1e-5),(0.,.1)):
            with self.subTest(height=height,tolerance=tol),self.assertRaises(ValueError):
                geometric_neck_cap(pyramid(),height,tol)


if __name__=="__main__":
    unittest.main()

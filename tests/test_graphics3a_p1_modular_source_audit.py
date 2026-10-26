"""No-vendor-file structural audit tests for owner-approved modularization."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"scripts"))
from graphics3a_p1_modular_source_audit import audit_source_geometry


def source_docs():
    base={"nodes":[
        {"name":"Eyebrows","mesh":0},
        {"name":"Eyes","mesh":1},
        {"name":"SuperHero_Male","mesh":2},
        {"name":"Head"},  # Bone is not a standalone geometry mesh.
    ]}
    outfit={"nodes":[
        {"name":"Male_Peasant_Arms","mesh":0},
        {"name":"Male_Peasant_Body","mesh":1},
        {"name":"Male_Peasant_Feet","mesh":2},
        {"name":"Male_Peasant_Legs","mesh":3},
    ]}
    return base,outfit


class ModularSourceAuditTests(unittest.TestCase):
    def test_original_style_combined_head_body_not_detachable(self):
        base,outfit=source_docs()
        r=audit_source_geometry(base,outfit)
        self.assertTrue(r["combined_full_body_mesh"])
        self.assertFalse(r["separate_head_source_mesh"])
        self.assertFalse(r["verified_head_detachment"])

    def test_outfit_modular_mesh_names_are_only_structural_cues(self):
        base,outfit=source_docs()
        r=audit_source_geometry(base,outfit)
        self.assertEqual(r["outfit_segment_roles_found"],("arms","body","legs","feet"))
        self.assertFalse(r["verified_gear_swap"])

    def test_bone_named_head_is_not_a_separate_head_mesh(self):
        base,outfit=source_docs()
        base["nodes"].append({"name":"Head","skin":0})
        self.assertFalse(audit_source_geometry(base,outfit)["separate_head_source_mesh"])

    def test_even_fake_standalone_mesh_does_not_count_as_verified_decapitation(self):
        base,outfit=source_docs()
        base["nodes"].append({"name":"head_mesh","mesh":5})
        r=audit_source_geometry(base,outfit)
        self.assertTrue(r["separate_head_source_mesh"])
        self.assertFalse(r["verified_head_detachment"])
        self.assertEqual(r["status"],"ART_HOLD_NO_PRODUCTION_ASSERTION")

    def test_source_names_cannot_prove_bare_anatomy(self):
        base,outfit=source_docs()
        r=audit_source_geometry(base,outfit)
        self.assertFalse(r["verified_unequipped_body"])
        self.assertTrue(r["needs_independent_mesh_visual_art_review"])

    def test_invalid_or_empty_source_geometry_fails_closed(self):
        cases=[({},{}),({"nodes":[]},{"nodes":[]}),
               ({"nodes":[{"name":"Head","mesh":0}]},{"nodes":[]})]
        for b,o in cases:
            with self.subTest(b=b,o=o),self.assertRaises(ValueError):
                audit_source_geometry(b,o)

    def test_head_cap_name_is_not_watertightness_or_release_proof(self):
        base,outfit=source_docs()
        base["nodes"].append({"name":"neck_cut_cap","mesh":4})
        r=audit_source_geometry(base,outfit)
        self.assertTrue(r["detached_neck_cap_source_mesh_found"])
        self.assertFalse(r["verified_head_detachment"])

    def test_female_source_combined_mesh_is_also_flagged(self):
        base,outfit=source_docs()
        base["nodes"][2]["name"]="Superhero_Female"
        outfit["nodes"][0]["name"]="Female_Peasant_Arms"
        r=audit_source_geometry(base,outfit)
        self.assertTrue(r["combined_full_body_mesh"])
        self.assertFalse(r["verified_unequipped_body"])


if __name__=="__main__":
    unittest.main()

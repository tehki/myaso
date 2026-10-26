"""No-vendor-source regressions for optional Quaternius Ranger hood review."""
import math
import sys
import unittest
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"scripts"))
from graphics3a_p1_hood_review_rules import (
    ROOT, HOOD_FILES, approved_hood_member, verified_hood_bind_anchors,
)


class HoodSourceRulesTests(unittest.TestCase):
    def test_male_hood_is_exact_publisher_modular_part(self):
        names=[HOOD_FILES["Male_Peasant.gltf"],"unrelated/file.gltf"]
        self.assertEqual(approved_hood_member("Male_Peasant.gltf",names),
                         ROOT+"Male_Ranger_Head_Hood.gltf")

    def test_female_hood_is_exact_publisher_modular_part(self):
        self.assertEqual(approved_hood_member(
            "Female_Peasant.gltf",[HOOD_FILES["Female_Peasant.gltf"]]),
            ROOT+"Female_Ranger_Head_Hood.gltf")

    def test_duplicate_or_absent_source_member_is_rejected(self):
        path=HOOD_FILES["Male_Peasant.gltf"]
        for names in ([],[path,path],["wrong/zip/"+path]):
            with self.subTest(names=names), self.assertRaisesRegex(ValueError,"exactly one"):
                approved_hood_member("Male_Peasant.gltf",names)

    def test_disallowed_character_cannot_consume_hood(self):
        for target in ("Male_Ranger.gltf","Female_Peasant.fbx","../Male_Peasant.gltf","Silver_Knight.gltf"):
            with self.subTest(target=target), self.assertRaises(ValueError):
                approved_hood_member(target,[HOOD_FILES["Male_Peasant.gltf"]])

    def test_non_list_inventory_is_rejected(self):
        with self.assertRaisesRegex(ValueError,"inventory"):
            approved_hood_member("Male_Peasant.gltf",None)

    def test_identical_head_neck_and_shoulder_anchors_pass(self):
        pts={"Head":[0,1.6,0],"neck_01":[0,1.52,0],"clavicle_l":[.13,1.48,0]}
        d=verified_hood_bind_anchors(pts,pts,("Head","neck_01","clavicle_l"))
        self.assertEqual(d,{"Head":0,"neck_01":0,"clavicle_l":0})

    def test_displaced_head_anchors_fail_closed(self):
        left={"Head":[0,1.6,0]}
        right={"Head":[0,1.605,0]}
        with self.assertRaisesRegex(ValueError,"Head differs"):
            verified_hood_bind_anchors(left,right,("Head",))

    def test_missing_or_nan_hood_anchors_fail_closed(self):
        with self.assertRaises(ValueError):
            verified_hood_bind_anchors({},{"Head":[0,0,0]},("Head",))
        with self.assertRaises(ValueError):
            verified_hood_bind_anchors({"Head":[0,math.nan,0]},
                                       {"Head":[0,0,0]},("Head",))

    def test_empty_anchor_inventory_fails(self):
        with self.assertRaises(ValueError):
            verified_hood_bind_anchors({}, {}, ())


if __name__=="__main__":
    unittest.main()

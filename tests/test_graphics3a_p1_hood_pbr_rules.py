"""Vendor-free guards for opt-in publisher ORM material fidelity."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"scripts"))
from graphics3a_p1_hood_pbr_rules import ranger_orm_image_uri


def author_doc():
    return {
        "materials":[{"name":"MI_Ranger","pbrMetallicRoughness":{
            "baseColorTexture":{"index":1},
            "metallicRoughnessTexture":{"index":2}}}],
        "textures":[{"source":0},{"source":1},{"source":2}],
        "images":[{"uri":"T_Ranger_Normal.png"},
                  {"uri":"T_Ranger_BaseColor.png"},
                  {"uri":"T_Ranger_ORM.png"}],
    }


class RangerORMRulesTests(unittest.TestCase):
    def test_original_official_orm_file_is_required(self):
        self.assertEqual(ranger_orm_image_uri(author_doc(),0),"T_Ranger_ORM.png")

    def test_wrong_source_material_fails(self):
        d=author_doc();d["materials"][0]["name"]="MI_Superhero_Male"
        with self.assertRaisesRegex(ValueError,"MI_Ranger"):
            ranger_orm_image_uri(d,0)

    def test_missing_original_pbr_ref_fails(self):
        d=author_doc();del d["materials"][0]["pbrMetallicRoughness"]["metallicRoughnessTexture"]
        with self.assertRaisesRegex(ValueError,"lacks"):
            ranger_orm_image_uri(d,0)

    def test_wrong_image_uri_fails_closed(self):
        for value in ("../T_Ranger_ORM.png","https://invalid.example/ORM.png","T_Ranger_BaseColor.png"):
            with self.subTest(uri=value):
                d=author_doc();d["images"][2]["uri"]=value
                with self.assertRaisesRegex(ValueError,"Unexpected"):
                    ranger_orm_image_uri(d,0)

    def test_source_image_pointer_invalid_fails(self):
        for source in (None,99,-1):
            with self.subTest(source=source):
                d=author_doc();d["textures"][2]["source"]=source
                with self.assertRaises(ValueError):
                    ranger_orm_image_uri(d,0)

    def test_source_texture_pointer_invalid_fails(self):
        d=author_doc();d["materials"][0]["pbrMetallicRoughness"]["metallicRoughnessTexture"]["index"]=99
        with self.assertRaisesRegex(ValueError,"texture index"):
            ranger_orm_image_uri(d,0)

    def test_material_index_type_and_range_fail(self):
        for i in (-1,2,True,"0"):
            with self.subTest(i=i),self.assertRaises(ValueError):
                ranger_orm_image_uri(author_doc(),i)


if __name__=="__main__":
    unittest.main()

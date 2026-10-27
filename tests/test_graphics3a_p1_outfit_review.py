"""Synthetic-only offline visual-source extraction tests (zero vendor data)."""
import json
import sys
import tempfile
import unittest
from pathlib import Path
from zipfile import ZipFile

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from graphics3a_p1_outfit_blender_review import prepare_source


class OfflineRangerReviewTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name)
        self.archive = self.root / "mock.zip"
        self.gltf = {"skins": [{"joints": [0]}],
                     "nodes": [{"name": "root"}],
                     "meshes": [{"name": "valid-body"}],
                     "buffers": [{"uri": "Male_Ranger.bin", "byteLength": 4}],
                     "images": [{"uri": "BaseColor.png"}]}

    def build(self, extra=None):
        with ZipFile(self.archive, "w") as z:
            z.writestr("vendor/Outfits/Male_Ranger.gltf", json.dumps(self.gltf))
            z.writestr("vendor/Outfits/Male_Ranger.bin", b"DATA")
            if extra is None:
                z.writestr("vendor/Outfits/BaseColor.png", b"synthetic-png")
            else:
                for name, data in extra.items():
                    z.writestr("vendor/Outfits/" + name, data)

    def test_prepare_only_stages_exact_dependency_files_and_holds(self):
        self.build()
        result = prepare_source(self.archive, "Male_Ranger", self.root / "staging")
        self.assertEqual(result["release_status"], "HOLD_OFFLINE_VISUAL_REVIEW_ONLY")
        self.assertEqual(len(result["staged_local_source_files"]), 3)
        self.assertEqual(Path(result["model_path"]).name, "Male_Ranger.gltf")
        self.assertEqual((self.root / "staging/BaseColor.png").read_bytes(), b"synthetic-png")
        self.assertNotIn("render_evidence", result)

    def test_no_paid_or_unapproved_characters(self):
        self.build()
        with self.assertRaisesRegex(ValueError, "four actually downloaded"):
            prepare_source(self.archive, "Noble_Knight", self.root / "staging")

    def test_missing_linked_textures_do_not_get_hidden(self):
        self.build(extra={})
        with self.assertRaisesRegex(ValueError, "Missing relative"):
            prepare_source(self.archive, "Male_Ranger", self.root / "staging")

    def test_nonlocal_vendor_references_rejected(self):
        self.gltf["images"][0]["uri"] = "../outside.png"
        self.build()
        with self.assertRaisesRegex(ValueError, "Nonlocal"):
            prepare_source(self.archive, "Male_Ranger", self.root / "staging")

    def test_invalid_non_skinned_character_rejected(self):
        self.gltf["skins"] = []
        self.build()
        with self.assertRaisesRegex(ValueError, "skinned"):
            prepare_source(self.archive, "Male_Ranger", self.root / "staging")


if __name__ == "__main__":
    unittest.main()

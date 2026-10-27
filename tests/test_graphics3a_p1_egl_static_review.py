"""Source-only P1 EGL review safety tests; no vendor archive or graphics context."""
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from graphics3a_p1_egl_static_review import CELL, DIRECTIONS, validate_source


class StaticEGLReviewTests(unittest.TestCase):
    def setUp(self):
        t = tempfile.TemporaryDirectory()
        self.addCleanup(t.cleanup)
        self.base = Path(t.name)
        self.model = self.base / "Male_Ranger.gltf"
        self.data = {
            "skins": [{"joints": [0]}],
            "meshes": [{"name": "actual-skin-shape-mock"}],
            "buffers": [{"uri": "Male_Ranger.bin"}],
            "images": [{"uri": "BaseColor.png"}],
        }
        (self.base / "Male_Ranger.bin").write_bytes(b"synthetic mesh")
        (self.base / "BaseColor.png").write_bytes(b"synthetic image")

    def write(self):
        self.model.write_text(json.dumps(self.data), encoding="utf8")

    def test_static_review_requires_eight_160px_cells(self):
        self.assertEqual(DIRECTIONS, 8)
        self.assertEqual(CELL, 160)

    def test_only_named_genuine_free_characters(self):
        self.write()
        report = validate_source(self.model)
        self.assertEqual(len(report["dependency_hashes"]), 2)
        self.assertEqual(len(report["model_sha256"]), 64)
        self.model.rename(self.base / "Noble_Ranger.gltf")
        with self.assertRaisesRegex(ValueError, "owner-approved"):
            validate_source(self.base / "Noble_Ranger.gltf")

    def test_missing_original_texture_is_error(self):
        self.write()
        (self.base / "BaseColor.png").unlink()
        with self.assertRaisesRegex(ValueError, "Missing"):
            validate_source(self.model)

    def test_reject_remote_texture_uri(self):
        self.data["images"] = [{"uri": "https://vendor.example/img.png"}]
        self.write()
        with self.assertRaisesRegex(ValueError, "Nonlocal"):
            validate_source(self.model)

    def test_reject_parent_path(self):
        self.data["images"] = [{"uri": "../wrong.png"}]
        self.write()
        with self.assertRaisesRegex(ValueError, "Nonlocal"):
            validate_source(self.model)

    def test_reject_unskinned_fake_model(self):
        self.data["skins"] = []
        self.write()
        with self.assertRaisesRegex(ValueError, "skinned"):
            validate_source(self.model)


if __name__ == "__main__":
    unittest.main()

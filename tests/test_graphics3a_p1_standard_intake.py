"""Synthetic-only tests for the Graphics 3A P1 Standard source ZIP audit.

These fixtures are not third-party Quaternius or KayKit asset content.
"""
import sys
import tempfile
import unittest
from pathlib import Path
from zipfile import ZipFile

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from graphics3a_p1_standard_intake import audit


class SourceIntakeTests(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.zip = Path(tmp.name) / "Modular Character Outfits - Fantasy[Standard].zip"

    def put(self, members):
        with ZipFile(self.zip, "w") as target:
            for path, contents in members.items():
                target.writestr(path, contents)

    def test_valid_synthetic_metadata_is_never_release_approved(self):
        self.put({"Standard/Peasant.gltf": "{}", "Standard/LICENSE.txt": "CC0 example",
                  "Standard/tex.png": "dummy"})
        report = audit("quaternius-outfits", self.zip)
        self.assertEqual(report["release_status"], "HOLD_NOT_IMPORTED")
        self.assertEqual(report["model_candidate_count"], 1)
        self.assertEqual(report["file_count"], 3)
        self.assertEqual(len(report["archive_sha256"]), 64)
        self.assertFalse(report["warnings"])
        self.assertIn("metadata only", report["limitations"].lower())

    def test_archive_path_traversal_is_rejected(self):
        self.put({"../../escape.gltf": "{}"})
        with self.assertRaisesRegex(ValueError, "Unsafe archive path"):
            audit("quaternius-outfits", self.zip)

    def test_windows_drive_path_is_rejected(self):
        self.put({"C:/escape.gltf": "{}"})
        with self.assertRaisesRegex(ValueError, "Unsafe archive path"):
            audit("quaternius-outfits", self.zip)

    def test_case_insensitive_filename_conflicts_are_rejected(self):
        self.put({"Mesh.gltf": "a", "mesh.gltf": "b"})
        with self.assertRaisesRegex(ValueError, "Conflicting archive path"):
            audit("quaternius-outfits", self.zip)

    def test_absent_embedded_license_stays_unqualified(self):
        self.put({"Standard/Peasant.fbx": "fake"})
        report = audit("quaternius-outfits", self.zip)
        self.assertEqual(report["possible_license_paths"], [])
        self.assertTrue(any("license" in warning for warning in report["warnings"]))

    def test_archive_without_models_stays_unqualified(self):
        self.put({"Standard/LICENSE.txt": "placeholder"})
        report = audit("quaternius-outfits", self.zip)
        self.assertEqual(report["model_candidate_count"], 0)
        self.assertTrue(report["warnings"])

    def test_unknown_pack_cannot_be_claimed_as_approved(self):
        self.put({"Model.gltf": "{}"})
        with self.assertRaisesRegex(ValueError, "Unapproved pack"):
            audit("other-unreviewed-kit", self.zip)


if __name__ == "__main__":
    unittest.main()

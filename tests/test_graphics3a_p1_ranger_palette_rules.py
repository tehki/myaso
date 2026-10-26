"""Vendor-free tests for reversible Ranger hood fabric palette experimentation."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"scripts"))
from graphics3a_p1_ranger_palette_rules import is_ranger_green,earth_brown_color


class RangerPaletteTests(unittest.TestCase):
    def test_strong_original_green_is_recognized(self):
        self.assertTrue(is_ranger_green((40,91,21)))

    def test_original_brown_stays_unchanged(self):
        self.assertEqual(earth_brown_color((115,77,42)),(115,77,42))

    def test_original_gray_or_silver_stays_unchanged(self):
        self.assertEqual(earth_brown_color((164,164,164)),(164,164,164))

    def test_original_skin_or_rust_stays_unchanged(self):
        self.assertEqual(earth_brown_color((171,121,83)),(171,121,83))

    def test_green_changes_to_earth_brown_deterministically(self):
        self.assertEqual(earth_brown_color((40,91,21)),(84,58,28))

    def test_dark_neutral_fabric_stays_unchanged(self):
        self.assertEqual(earth_brown_color((15,15,13)),(15,15,13))

    def test_source_validation_rejects_negative_and_overflow_channels(self):
        for rgb in ((-1,50,20),(1,256,0),(20,-1,0)):
            with self.subTest(rgb=rgb),self.assertRaises(ValueError):
                earth_brown_color(rgb)

    def test_invalid_bool_float_or_missing_channels_fail_closed(self):
        for rgb in ((False,50,30),(30.5,50,10),(1,2),None):
            with self.subTest(rgb=rgb),self.assertRaises(ValueError):
                earth_brown_color(rgb)

    def test_selected_green_outputs_are_non_green_umber(self):
        for rgb in ((40,91,21),(15,50,15),(51,105,45)):
            with self.subTest(rgb=rgb):
                out=earth_brown_color(rgb)
                self.assertGreater(out[0],out[1])
                self.assertGreater(out[1],out[2])

    def test_original_unchanged_is_a_supported_path(self):
        rgb=(67,42,24)
        self.assertEqual(earth_brown_color(rgb),rgb)


if __name__=="__main__":
    unittest.main()

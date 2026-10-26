"""Source-only tests for opt-in private head paint A/B; no vendor assets."""
import math
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from graphics3a_p1_skin_paint_ab import (
    NEUTRAL_MAX_CHANNEL_SPAN, is_neutral_source_paint,
    skin_reference_uv, skin_sample_is_valid,
)


class SourceNeutralPaintTests(unittest.TestCase):
    def test_original_publisher_dark_paint_is_neutral(self):
        self.assertTrue(is_neutral_source_paint((45,45,45)))
        self.assertTrue(is_neutral_source_paint((54,54,54)))

    def test_original_publisher_skin_samples_are_not_neutral(self):
        self.assertFalse(is_neutral_source_paint((171,121,83)))
        self.assertFalse(is_neutral_source_paint((171,116,81)))

    def test_neutral_rule_does_not_select_white_or_black(self):
        self.assertFalse(is_neutral_source_paint((0,0,0)))
        self.assertFalse(is_neutral_source_paint((255,255,255)))

    def test_publisher_skin_sample_is_valid(self):
        self.assertTrue(skin_sample_is_valid((171,121,83)))
        self.assertTrue(skin_sample_is_valid((171,116,81)))
        self.assertFalse(skin_sample_is_valid((45,45,45)))

    def test_rgb_invalid_pixel_rejected(self):
        for value in ((1,2),(1,2,256),(-1,2,3),(math.nan,1,2)):
            with self.subTest(value=value),self.assertRaises((ValueError,OverflowError)):
                is_neutral_source_paint(value)

    def test_uv_reference_fixed_inside_atlas(self):
        self.assertEqual(skin_reference_uv(),(0.5,0.5))

    def test_max_color_span_is_conservative(self):
        self.assertEqual(NEUTRAL_MAX_CHANNEL_SPAN,10)
        self.assertFalse(is_neutral_source_paint((45,60,45)))

    def test_invalid_skin_reference_fails(self):
        for value in ((1,2),(-2,3,4),(256,3,4),(math.nan,20,30)):
            with self.subTest(value=value),self.assertRaises((ValueError,OverflowError)):
                skin_sample_is_valid(value)


if __name__=="__main__":
    unittest.main()

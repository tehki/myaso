"""Synthetic, no-vendor tests of the multi-phase original Ranger hood motion gates."""
import math
import sys
import unittest
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"scripts"))
from graphics3a_p1_hood_motion_rules import (
    MOTION_PHASES, REQUIRED_CLIPS, MAX_SKIN_MATRIX_DIFFERENCE,
    finite_skin_compatible, validated_motion_selection,
)


class HoodMotionGateTests(unittest.TestCase):
    def test_seven_authentic_motions_and_five_phases(self):
        clips,phases=validated_motion_selection(REQUIRED_CLIPS)
        self.assertEqual(len(clips),7)
        self.assertEqual(phases,(0.,.25,.5,.75,1.))

    def test_source_clip_names_cannot_be_invented(self):
        for selection in (("FlyingDragon",),("Walk_Loop","Walk_Loop"),tuple()):
            with self.subTest(selection=selection),self.assertRaises(ValueError):
                validated_motion_selection(selection)

    def test_valid_target_phases_are_bounded(self):
        self.assertEqual(validated_motion_selection(("Roll",),(0,.33,1))[1],(0,.33,1.))

    def test_invalid_pose_phase_must_fail_closed(self):
        for f in (-.01,1.01,math.inf,math.nan,"0.5"):
            with self.subTest(f=f),self.assertRaises(ValueError):
                validated_motion_selection(("Idle_Loop",),(f,))

    def test_duplicate_phases_rejected(self):
        with self.assertRaises(ValueError):
            validated_motion_selection(("Walk_Loop",),(.5,.5))

    def test_compatible_true_poses_are_numerically_valid(self):
        self.assertTrue(finite_skin_compatible(0.,.000001,0.,1.865,1.))

    def test_mismatched_rig_or_invalid_bind_is_rejected(self):
        with self.assertRaises(ValueError):
            finite_skin_compatible(MAX_SKIN_MATRIX_DIFFERENCE+.01,0.,0.,2.)
        with self.assertRaises(ValueError):
            finite_skin_compatible(0.,.001,0.,2.)
        with self.assertRaises(ValueError):
            finite_skin_compatible(0.,0.,.005,2.)

    def test_nonfinite_or_exploding_skinned_vertices_rejected(self):
        for x in (math.inf,math.nan,101.):
            with self.subTest(x=x),self.assertRaises(ValueError):
                finite_skin_compatible(0.,0.,0.,x)

    def test_invalid_source_weight_normalization_rejected(self):
        for w in (0.,.3,1.25):
            with self.subTest(weight=w),self.assertRaises(ValueError):
                finite_skin_compatible(0.,0.,0.,2.,w)


if __name__=="__main__":
    unittest.main()

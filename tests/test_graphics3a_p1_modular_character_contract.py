"""No-vendor-source modular character presentation contract tests.

These validate a synthetic future-capable manifest only; they do not establish
that today's Peasant + SuperHero assets are naked/decapitation-ready.
"""
import copy
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from graphics3a_p1_modular_character_contract import (
    ARMOR_SLOTS, BODY_REGIONS, compose_modular_appearance, validate_modular_manifest,
)


def example_manifest():
    base = {name: "body_" + name for name in BODY_REGIONS}
    return {
        "rig_id": "quaternius_humanoid_65",
        "base_body": {
            "surface_class": "unequipped_body",
            "baked_equipment": False,
            "regions": base,
        },
        "neck_interface": {
            "head_joint": "Head",
            "neck_joint": "neck_01",
            "attached_join": "neck_intact_join",
            "torso_cut_cap": "neck_torso_cap",
            "head_cut_cap": "head_cut_cap",
        },
        "head_accessories": {
            "eyes": "mesh_eyes",
            "eyebrows": "mesh_eyebrows",
            "hair": "mesh_hair",
        },
        "equipment_catalog": {
            "hood": {
                "mesh": "hood_mesh", "slot": "head",
                "rig_id": "quaternius_humanoid_65",
                "hide_body_regions": ["head"],
            },
            "tunic": {
                "mesh": "tunic_mesh", "slot": "torso",
                "rig_id": "quaternius_humanoid_65",
                "hide_body_regions": ["torso"],
            },
            "iron_cuirass": {
                "mesh": "iron_mesh", "slot": "torso",
                "rig_id": "quaternius_humanoid_65",
                "hide_body_regions": ["torso", "pelvis"],
            },
            "gauntlets": {
                "mesh": "glove_mesh", "slot": "hands",
                "rig_id": "quaternius_humanoid_65",
                "hide_body_regions": ["left_hand", "right_hand"],
            },
            "boots": {
                "mesh": "boot_mesh", "slot": "feet",
                "rig_id": "quaternius_humanoid_65",
                "hide_body_regions": ["left_foot", "right_foot"],
            },
        },
    }


class ModularCharacterContractTests(unittest.TestCase):
    def test_synthetic_complete_manifest_passes_structural_validation(self):
        validate_modular_manifest(example_manifest())

    def test_completely_unequipped_body_has_all_declared_regions(self):
        view = compose_modular_appearance(example_manifest(), {})
        self.assertEqual(view.visible_base_regions, BODY_REGIONS)
        self.assertEqual(view.rendered_equipment, ())
        self.assertEqual(view.torso_neck_geometry, "neck_intact_join")
        self.assertFalse(view.production_approved)

    def test_clothing_can_be_put_on_and_removed_without_replacing_body(self):
        m = example_manifest()
        clothed = compose_modular_appearance(m, {"torso": "tunic", "feet": "boots"})
        unclothed = compose_modular_appearance(m, {})
        self.assertNotIn("torso", clothed.visible_base_regions)
        self.assertNotIn("left_foot", clothed.visible_base_regions)
        self.assertEqual(unclothed.visible_base_regions, BODY_REGIONS)
        self.assertEqual(clothed.rendered_equipment, ("tunic", "boots"))

    def test_multiple_armor_types_replace_same_slot_deterministically(self):
        m = example_manifest()
        cloth = compose_modular_appearance(m, {"torso": "tunic"})
        iron = compose_modular_appearance(m, {"torso": "iron_cuirass"})
        self.assertEqual(cloth.rendered_equipment, ("tunic",))
        self.assertEqual(iron.rendered_equipment, ("iron_cuirass",))
        self.assertIn("pelvis", cloth.visible_base_regions)
        self.assertNotIn("pelvis", iron.visible_base_regions)

    def test_head_detaches_with_distinct_cap_assets_and_no_orphans(self):
        m = example_manifest()
        view = compose_modular_appearance(m, {}, "detached")
        self.assertNotIn("head", view.visible_base_regions)
        self.assertNotIn("neck", view.visible_base_regions)
        self.assertEqual(view.torso_neck_geometry, "neck_torso_cap")
        self.assertEqual(view.detached_head_geometry[0:2],
                         ("body_head", "head_cut_cap"))
        self.assertIn("mesh_eyes", view.detached_head_geometry)
        self.assertIn("mesh_hair", view.detached_head_geometry)
        self.assertFalse(view.production_approved)

    def test_detached_headgear_is_suppressed_without_inventory_mutation(self):
        equipped = {"head": "hood", "torso": "tunic"}
        before = copy.deepcopy(equipped)
        view = compose_modular_appearance(example_manifest(), equipped, "detached")
        self.assertEqual(equipped, before)
        self.assertEqual(view.temporarily_suppressed_equipment, ("hood",))
        self.assertEqual(view.rendered_equipment, ("tunic",))

    def test_reattach_restores_headgear_without_item_loss(self):
        equipped = {"head": "hood"}
        before = compose_modular_appearance(example_manifest(), equipped, "detached")
        after = compose_modular_appearance(example_manifest(), equipped, "attached")
        self.assertEqual(before.rendered_equipment, ())
        self.assertEqual(after.rendered_equipment, ("hood",))
        self.assertEqual(after.detached_head_geometry, ())

    def test_absent_anatomical_region_is_rejected(self):
        m = example_manifest()
        del m["base_body"]["regions"]["pelvis"]
        with self.assertRaisesRegex(ValueError, "every required anatomical region"):
            validate_modular_manifest(m)

    def test_baked_in_clothes_are_not_a_complete_unequipped_body(self):
        for value in (True, None, "false"):
            m = example_manifest()
            m["base_body"]["baked_equipment"] = value
            with self.subTest(value=value), self.assertRaisesRegex(ValueError, "baked-in"):
                validate_modular_manifest(m)

    def test_one_combined_head_and_torso_is_not_a_detachable_head_contract(self):
        m = example_manifest()
        m["base_body"]["regions"]["head"] = m["base_body"]["regions"]["torso"]
        with self.assertRaisesRegex(ValueError, "distinct removable"):
            validate_modular_manifest(m)

    def test_missing_or_reused_severed_neck_caps_are_rejected(self):
        m = example_manifest()
        del m["neck_interface"]["torso_cut_cap"]
        with self.assertRaises(ValueError):
            validate_modular_manifest(m)
        m = example_manifest()
        m["neck_interface"]["head_cut_cap"] = m["neck_interface"]["torso_cut_cap"]
        with self.assertRaises(ValueError):
            validate_modular_manifest(m)

    def test_wrong_or_unknown_equipment_slot_or_asset_is_rejected(self):
        for equips in ({"neck": "hood"}, {"torso": "hood"},
                       {"torso": "unknown"}, {"head": "iron_cuirass"}):
            with self.subTest(equips=equips), self.assertRaises(ValueError):
                compose_modular_appearance(example_manifest(), equips)

    def test_mismatched_skinning_rig_is_rejected(self):
        m = example_manifest()
        m["equipment_catalog"]["hood"]["rig_id"] = "different_rig"
        with self.assertRaisesRegex(ValueError, "rig mismatch"):
            validate_modular_manifest(m)

    def test_incorrect_body_masking_fails_closed(self):
        m = example_manifest()
        m["equipment_catalog"]["hood"]["hide_body_regions"] = ["left_leg"]
        with self.assertRaisesRegex(ValueError, "Headgear"):
            validate_modular_manifest(m)
        m = example_manifest()
        m["equipment_catalog"]["tunic"]["hide_body_regions"] = ["torso", "torso"]
        with self.assertRaisesRegex(ValueError, "unique"):
            validate_modular_manifest(m)

    def test_source_ids_are_identifiers_not_paths_or_download_urls(self):
        for bad in ("../head.gltf", "https://example.com/asset", "", ".hidden"):
            m = example_manifest()
            m["base_body"]["regions"]["head"] = bad
            with self.subTest(bad=bad), self.assertRaises(ValueError):
                validate_modular_manifest(m)

    def test_bad_head_state_is_not_accepted(self):
        with self.assertRaisesRegex(ValueError, "Unknown"):
            compose_modular_appearance(example_manifest(), {}, "headless_zombie")

    def test_no_pure_contract_state_may_claim_production_acceptance(self):
        m = example_manifest()
        for head in ("attached", "detached"):
            for equips in ({}, {"torso": "iron_cuirass", "head": "hood"}):
                with self.subTest(head=head, equips=equips):
                    self.assertFalse(
                        compose_modular_appearance(m, equips, head).production_approved
                    )


if __name__ == "__main__":
    unittest.main()

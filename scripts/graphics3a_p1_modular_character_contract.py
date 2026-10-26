"""Graphics 3A P1: forward-looking modular humanoid presentation contract.

NOT a gameplay, inventory, Combat, network, or dismemberment implementation.
Real Quaternius source art has NOT yet qualified: combined Base head/body meshes
and unverified fully-unequipped body. All examples/tests are synthetic.
"""
from dataclasses import dataclass
from typing import Mapping

ARMOR_SLOTS = ("head", "torso", "arms", "hands", "legs", "feet", "back")
BODY_REGIONS = (
    "head", "neck", "torso", "pelvis", "left_arm", "right_arm",
    "left_hand", "right_hand", "left_leg", "right_leg",
    "left_foot", "right_foot",
)
HEAD_STATES = ("attached", "detached")
HEAD_ACCESSORIES = ("eyes", "eyebrows", "hair")


def _asset_id(value):
    """Logical manifest identifiers only; never paths/URLs/vendor content."""
    if (not isinstance(value, str) or not value or len(value) > 120
            or not all(c.isascii() and (c.isalnum() or c in "._-") for c in value)
            or value.startswith(".")):
        raise ValueError("Invalid logical graphics asset identifier")
    return value


def validate_modular_manifest(manifest: Mapping) -> None:
    """Validate declared capabilities, NOT actual mesh/UV/license adequacy."""
    if not isinstance(manifest, dict):
        raise ValueError("Modular character manifest must be a mapping")
    rig = _asset_id(manifest.get("rig_id"))
    base = manifest.get("base_body")
    if not isinstance(base, dict):
        raise ValueError("Complete bare base body specification is required")
    if base.get("surface_class") != "unequipped_body" or base.get("baked_equipment") is not False:
        raise ValueError("Bare body may not rely on baked-in clothing or armor")
    regions = base.get("regions")
    if not isinstance(regions, dict) or set(regions) != set(BODY_REGIONS):
        raise ValueError("Unequipped body must declare every required anatomical region")
    for asset_id in regions.values():
        _asset_id(asset_id)
    if regions["head"] in {regions["torso"], regions["pelvis"]}:
        raise ValueError("Head must be a distinct removable geometry asset")

    neck = manifest.get("neck_interface")
    required = ("head_joint", "neck_joint", "attached_join", "torso_cut_cap", "head_cut_cap")
    if not isinstance(neck, dict) or set(neck) != set(required):
        raise ValueError("Head/neck interface lacks both intact and detached geometries")
    if neck["head_joint"] != "Head" or neck["neck_joint"] != "neck_01":
        raise ValueError("Approved humanoid Head/neck_01 joint anchors required")
    ids = [_asset_id(neck[key]) for key in required[2:]]
    if len(set(ids)) != len(ids):
        raise ValueError("Attached and detached neck geometry assets must be distinct")

    accessories = manifest.get("head_accessories")
    if not isinstance(accessories, dict) or set(accessories) != set(HEAD_ACCESSORIES):
        raise ValueError("Head accessories need explicit eye/eyebrow/hair attachment references")
    for asset_id in accessories.values():
        _asset_id(asset_id)

    catalog = manifest.get("equipment_catalog")
    if not isinstance(catalog, dict) or not catalog:
        raise ValueError("Modular clothing and armor catalog is required")
    for item_id, item in catalog.items():
        _asset_id(item_id)
        if not isinstance(item, dict):
            raise ValueError("Every equipment item needs a contract")
        if set(item) != {"mesh", "slot", "rig_id", "hide_body_regions"}:
            raise ValueError("Equipment item must have mesh, slot, rig and hide rules")
        _asset_id(item["mesh"])
        if item["slot"] not in ARMOR_SLOTS or item["rig_id"] != rig:
            raise ValueError("Equipment slot or character rig mismatch")
        hides = item["hide_body_regions"]
        if not isinstance(hides, (tuple, list)) or not hides or len(hides) != len(set(hides)):
            raise ValueError("Every equipment item must have unique explicit body masking")
        if any(region not in BODY_REGIONS for region in hides):
            raise ValueError("Equipment attempts to hide an unknown body region")
        if item["slot"] == "head" and any(x not in ("head","neck") for x in hides):
            raise ValueError("Headgear must not hide unrelated body regions")


@dataclass(frozen=True)
class Appearance:
    """Pure graphics request. Does not change gameplay item ownership."""
    head_state: str
    visible_base_regions: tuple[str, ...]
    rendered_equipment: tuple[str, ...]
    temporarily_suppressed_equipment: tuple[str, ...]
    torso_neck_geometry: str
    detached_head_geometry: tuple[str, ...]
    production_approved: bool = False


def compose_modular_appearance(manifest, equipped: Mapping, head_state="attached") -> Appearance:
    """Deterministic visual-only state for gear swapping and detached heads.

    Owner wants decapitation compatibility; mechanics and authoritative
    events remain entirely out of scope while Combat finishes Pre-Alpha.
    """
    validate_modular_manifest(manifest)
    if head_state not in HEAD_STATES:
        raise ValueError("Unknown graphics head attachment state")
    if not isinstance(equipped, dict):
        raise ValueError("Equipped state must be a slot -> item mapping")
    if any(slot not in ARMOR_SLOTS for slot in equipped):
        raise ValueError("Unsupported armor slot")
    catalog = manifest["equipment_catalog"]
    for slot, item_id in equipped.items():
        if item_id not in catalog or catalog[item_id]["slot"] != slot:
            raise ValueError("Armor item not available in the specified slot")

    visible = set(BODY_REGIONS)
    drawn, suppressed = [], []
    for slot in ARMOR_SLOTS:
        item_id = equipped.get(slot)
        if item_id is None:
            continue
        if head_state == "detached" and slot == "head":
            # Presentation suppressed, but inventory state remains untouched.
            suppressed.append(item_id)
            continue
        drawn.append(item_id)
        visible.difference_update(catalog[item_id]["hide_body_regions"])

    neck = manifest["neck_interface"]
    detached = ()
    if head_state == "detached":
        visible.difference_update(("head", "neck"))
        # Graphics-only detached-head bundle; ownership/location left to
        # a future, separately scheduled authoritative integration.
        detached = (
            manifest["base_body"]["regions"]["head"],
            neck["head_cut_cap"],
            *tuple(manifest["head_accessories"][part] for part in HEAD_ACCESSORIES),
        )
        torso_neck = neck["torso_cut_cap"]
    else:
        torso_neck = neck["attached_join"]

    return Appearance(
        head_state=head_state,
        visible_base_regions=tuple(region for region in BODY_REGIONS if region in visible),
        rendered_equipment=tuple(drawn),
        temporarily_suppressed_equipment=tuple(suppressed),
        torso_neck_geometry=torso_neck,
        detached_head_geometry=detached,
        production_approved=False,  # Pure manifest checks are never an art GO.
    )

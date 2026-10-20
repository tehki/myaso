// Graphics-only adult base-body and visible-equipment contract, v1.
// Not connected to authentication, live game rendering, item transfers, or networking.
// Inputs to presentation must ultimately come from trusted character/loot snapshots.
// Never use this module to grant or validate gameplay equipment.
export const CHARACTER_APPEARANCE_SCHEMA_VERSION = 1;
export const ADULT_BODY_PRESENTATIONS = Object.freeze([
  "adult-masculine",
  "adult-feminine",
]);
export const VISIBLE_EQUIPMENT_SLOTS = Object.freeze(["body", "offHand", "mainHand"]);

// Matches the three equippable kinds in Magic & Items' *isolated* loot domain.
// Any new garment/armor slot or kind must be agreed with the authoritative owner
// before it can be included here, rather than silently inventing equipment.
export const VISUAL_EQUIPMENT = Object.freeze({
  LeatherArmor: Object.freeze({ slot: "body", assetKey: "equipment/leather-armor" }),
  Spellbook: Object.freeze({ slot: "offHand", assetKey: "equipment/spellbook" }),
  RustySword: Object.freeze({ slot: "mainHand", assetKey: "equipment/rusty-sword" }),
});

const EMPTY_EQUIPMENT = Object.freeze({
  body: null,
  offHand: null,
  mainHand: null,
});

function acceptedBody(bodyPresentation) {
  return ADULT_BODY_PRESENTATIONS.includes(bodyPresentation);
}

// Appearance is not a character identity or a server equipment record.
// A new character has a visible body and *no equipped clothing or weapons*.
export function createUnequippedAdultAppearance(bodyPresentation) {
  if (!acceptedBody(bodyPresentation)) {
    throw new RangeError("an approved adult body presentation is required");
  }
  return Object.freeze({
    schemaVersion: CHARACTER_APPEARANCE_SCHEMA_VERSION,
    bodyPresentation,
    equipment: EMPTY_EQUIPMENT,
  });
}

function invalid(reason) {
  return Object.freeze({
    supported: false,
    reason,
    layers: Object.freeze([]),
  });
}

// Produces symbolic, deterministic draw layers, NOT URLs or loaded textures.
// 3A must provide real adult base-body atlases before this can render anything.
// Unknown / ill-fitting equipped items force legacy fallback: never present a
// character as unclothed while known to have unsupported physical equipment.
export function planAdultCharacterLayers(appearance, { concealUnclothedBody = false } = {}) {
  if (typeof concealUnclothedBody !== "boolean") {
    return invalid("invalid-privacy-setting");
  }
  if (!appearance || typeof appearance !== "object"
    || appearance.schemaVersion !== CHARACTER_APPEARANCE_SCHEMA_VERSION
    || !acceptedBody(appearance.bodyPresentation)) {
    return invalid("unsupported-body");
  }
  const equipment = appearance.equipment;
  if (!equipment || typeof equipment !== "object" || Array.isArray(equipment)) {
    return invalid("invalid-equipment");
  }
  if (Object.keys(equipment).some(slot => !VISIBLE_EQUIPMENT_SLOTS.includes(slot))) {
    return invalid("unsupported-equipment-slot");
  }
  for (const slot of VISIBLE_EQUIPMENT_SLOTS) {
    if (!Object.hasOwn(equipment, slot)) return invalid("missing-equipment-slot");
    const kind = equipment[slot];
    if (kind === null) continue;
    if (typeof kind !== "string" || VISUAL_EQUIPMENT[kind]?.slot !== slot) {
      return invalid("unsupported-equipment");
    }
  }

  const layers = [
    Object.freeze({ kind: "base-body", assetKey: `body/${appearance.bodyPresentation}` }),
  ];
  // Purely local accessibility/privacy overlay, never an equipped loot object.
  // It must not alter the authoritative body, inventory, armor or ownership.
  if (concealUnclothedBody && equipment.body === null) {
    layers.push(Object.freeze({
      kind: "privacy-cover", assetKey: `privacy/${appearance.bodyPresentation}`,
    }));
  }
  for (const slot of VISIBLE_EQUIPMENT_SLOTS) {
    const item = equipment[slot];
    if (item !== null) {
      layers.push(Object.freeze({
        kind: "equipment", slot, assetKey: VISUAL_EQUIPMENT[item].assetKey,
      }));
    }
  }
  return Object.freeze({
    supported: true,
    reason: null,
    layers: Object.freeze(layers),
  });
}

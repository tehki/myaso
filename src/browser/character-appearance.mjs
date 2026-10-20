// Graphics-only adult base-body and visible-equipment contract, v1.
// Not connected to authentication, live game rendering, item transfers, or networking.
// Inputs to presentation must ultimately come from trusted character/loot snapshots.
// Never use this module to grant or validate gameplay equipment.
export const CHARACTER_APPEARANCE_SCHEMA_VERSION = 1;
export const ADULT_BODY_PRESENTATIONS = Object.freeze([
  "adult-masculine",
  "adult-feminine",
]);

// Staged Magic & Items #424 authoritative EquipmentSlot names.
// Ordered for symbolic asset composition only; 3A owns direction-dependent
// actual image overlap and art pivots (e.g., a shield behind a facing torso).
export const VISIBLE_EQUIPMENT_SLOTS = Object.freeze([
  "body", "feet", "head", "offHand", "mainHand",
]);

// Matches ItemKind::fits in Magic & Items draft PR #424 (not on live main).
// Unsupported new physical items must be added here explicitly: never make a
// player appear unclothed by ignoring equipment the server says is equipped.
export const VISUAL_EQUIPMENT = Object.freeze({
  LeatherArmor: Object.freeze({ slot: "body", assetKey: "equipment/leather-armor" }),
  ChainmailArmor: Object.freeze({ slot: "body", assetKey: "equipment/chainmail-armor" }),
  LeatherBoots: Object.freeze({ slot: "feet", assetKey: "equipment/leather-boots" }),
  IronHelmet: Object.freeze({ slot: "head", assetKey: "equipment/iron-helmet" }),
  Spellbook: Object.freeze({ slot: "offHand", assetKey: "equipment/spellbook" }),
  WoodenShield: Object.freeze({ slot: "offHand", assetKey: "equipment/wooden-shield" }),
  RustySword: Object.freeze({ slot: "mainHand", assetKey: "equipment/rusty-sword" }),
  IronSword: Object.freeze({ slot: "mainHand", assetKey: "equipment/iron-sword" }),
  WoodenClub: Object.freeze({ slot: "mainHand", assetKey: "equipment/wooden-club" }),
});

const EMPTY_EQUIPMENT = Object.freeze({
  body: null,
  feet: null,
  head: null,
  offHand: null,
  mainHand: null,
});

function acceptedBody(bodyPresentation) {
  return ADULT_BODY_PRESENTATIONS.includes(bodyPresentation);
}

// Appearance is not a character identity or a server equipment record.
// A new character has a visible adult body and *no equipped clothing or weapons*.
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
// 3A must provide real adult base-body/gear atlases before this can render.
// Unknown/ill-fitting equipped items force legacy fallback, rather than
// depicting an armored character as naked through partial atlas coverage.
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

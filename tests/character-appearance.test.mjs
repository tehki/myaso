import test from "node:test";
import assert from "node:assert/strict";
import {
  ADULT_BODY_PRESENTATIONS,
  CHARACTER_APPEARANCE_SCHEMA_VERSION,
  VISIBLE_EQUIPMENT_SLOTS,
  createUnequippedAdultAppearance,
  planAdultCharacterLayers,
} from "../src/browser/character-appearance.mjs";

test("new adult masculine and feminine bodies are unclothed and unarmed", () => {
  assert.deepEqual(ADULT_BODY_PRESENTATIONS, ["adult-masculine", "adult-feminine"]);
  assert.equal(CHARACTER_APPEARANCE_SCHEMA_VERSION, 1);
  for (const bodyPresentation of ADULT_BODY_PRESENTATIONS) {
    const appearance = createUnequippedAdultAppearance(bodyPresentation);
    assert.deepEqual(appearance.equipment, { body: null, offHand: null, mainHand: null });
    assert.equal(Object.isFrozen(appearance), true);
    const plan = planAdultCharacterLayers(appearance);
    assert.equal(plan.supported, true);
    assert.equal(plan.reason, null);
    assert.deepEqual(plan.layers, [
      { kind: "base-body", assetKey: `body/${bodyPresentation}` },
    ]);
  }
  for (const invalid of ["child", "teen", "knight", "", null, undefined]) {
    assert.throws(() => createUnequippedAdultAppearance(invalid), RangeError);
  }
});

test("loot equipment visual layers follow server domain slots without replacing the base body", () => {
  assert.deepEqual(VISIBLE_EQUIPMENT_SLOTS, ["body", "offHand", "mainHand"]);
  const original = createUnequippedAdultAppearance("adult-feminine");
  const equipped = {
    ...original,
    equipment: {
      body: "LeatherArmor",
      offHand: "Spellbook",
      mainHand: "RustySword",
    },
  };
  const plan = planAdultCharacterLayers(equipped);
  assert.equal(plan.supported, true);
  assert.deepEqual(plan.layers, [
    { kind: "base-body", assetKey: "body/adult-feminine" },
    { kind: "equipment", slot: "body", assetKey: "equipment/leather-armor" },
    { kind: "equipment", slot: "offHand", assetKey: "equipment/spellbook" },
    { kind: "equipment", slot: "mainHand", assetKey: "equipment/rusty-sword" },
  ]);
  assert.deepEqual(original.equipment, { body: null, offHand: null, mainHand: null });
  assert.equal(Object.isFrozen(plan.layers), true);
});

test("privacy cover only alters local presentation of otherwise unclothed body", () => {
  const nude = createUnequippedAdultAppearance("adult-masculine");
  const privatePlan = planAdultCharacterLayers(nude, { concealUnclothedBody: true });
  assert.deepEqual(privatePlan.layers, [
    { kind: "base-body", assetKey: "body/adult-masculine" },
    { kind: "privacy-cover", assetKey: "privacy/adult-masculine" },
  ]);
  assert.deepEqual(nude.equipment, { body: null, offHand: null, mainHand: null });
  const armored = {
    ...nude,
    equipment: { ...nude.equipment, body: "LeatherArmor" },
  };
  const armoredPlan = planAdultCharacterLayers(armored, { concealUnclothedBody: true });
  assert.equal(armoredPlan.layers.some(layer => layer.kind === "privacy-cover"), false);
  assert.equal(armoredPlan.layers.some(layer => layer.assetKey === "equipment/leather-armor"), true);
});

test("unsupported gear or body cannot silently render as naked instead of equipped", () => {
  const base = createUnequippedAdultAppearance("adult-masculine");
  const cases = [
    [{ ...base, equipment: { ...base.equipment, body: "UnknownArmor" } }, "unsupported-equipment"],
    [{ ...base, equipment: { ...base.equipment, mainHand: "LeatherArmor" } }, "unsupported-equipment"],
    [{ ...base, equipment: { ...base.equipment, hat: "WoolHat" } }, "unsupported-equipment-slot"],
    [{ ...base, equipment: { body: null } }, "missing-equipment-slot"],
    [{ ...base, equipment: null }, "invalid-equipment"],
    [{ ...base, schemaVersion: 2 }, "unsupported-body"],
    [{ ...base, bodyPresentation: "child" }, "unsupported-body"],
  ];
  for (const [appearance, reason] of cases) {
    const plan = planAdultCharacterLayers(appearance);
    assert.equal(plan.supported, false);
    assert.equal(plan.reason, reason);
    assert.deepEqual(plan.layers, []);
  }
  assert.equal(planAdultCharacterLayers(base, {
    concealUnclothedBody: "yes",
  }).supported, false);
});

test("no gameplay authority or canvas side effects are required for drawing plans", () => {
  const body = createUnequippedAdultAppearance("adult-feminine");
  const before = JSON.stringify(body);
  const plan = planAdultCharacterLayers(body);
  assert.equal(JSON.stringify(body), before);
  assert.equal(Object.isFrozen(plan), true);
  assert.equal(Object.isFrozen(plan.layers[0]), true);
  assert.equal(plan.layers.every(layer => !("itemId" in layer) && !("url" in layer)), true);
});

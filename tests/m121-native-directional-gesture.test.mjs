import assert from "node:assert/strict";
import test from "node:test";
import { planM121DirectionalW3cActions } from "../scripts/m121-native-directional-gesture.mjs";

const plan = (strafeKey = "s", xOffset = -200) =>
  planM121DirectionalW3cActions({ elementId: "arena-id", keyboardId: "keyboard-chrome", pointerId: "mouse-chrome", strafeKey, xOffset });

test("M121 trusted directional gesture starts strafe with LMB, not two native ticks before it", () => {
  const { actions } = plan();
  assert.equal(actions.length, 2);
  const keys = actions.find((source) => source.type === "key");
  const pointer = actions.find((source) => source.type === "pointer");
  const keyDownAt = keys.actions.findIndex((event) => event.type === "keyDown");
  const keyUpAt = keys.actions.findIndex((event) => event.type === "keyUp");
  const downAt = pointer.actions.findIndex((event) => event.type === "pointerDown");
  const upAt = pointer.actions.findIndex((event) => event.type === "pointerUp");
  assert.equal(keyDownAt, downAt, "genuine strafe and LMB down must start together");
  assert.ok(keyUpAt > upAt, "genuine lateral input must remain held through release sampling");
  assert.equal(pointer.actions.filter((event) => event.type === "pointerDown").length, 1);
  assert.equal(pointer.actions.filter((event) => event.type === "pointerUp").length, 1);
  assert.equal(keys.actions.filter((event) => event.type === "keyDown").length, 1);
  assert.equal(keys.actions.filter((event) => event.type === "keyUp").length, 1);
  assert.ok(keyDownAt > 0, "focus aim before input");
});

test("M121 preserves actual physical side, attack pointer and proper native W3C source identity", () => {
  for (const [strafeKey, xOffset] of [["s", -200], ["w", 200]]) {
    const { actions } = plan(strafeKey, xOffset);
    const keys = actions.find((source) => source.type === "key");
    const pointer = actions.find((source) => source.type === "pointer");
    assert.equal(keys.id, "keyboard-chrome");
    assert.equal(pointer.id, "mouse-chrome");
    assert.equal(pointer.parameters.pointerType, "mouse");
    assert.equal(keys.actions.find((event) => event.type === "keyDown").value, strafeKey);
    assert.equal(keys.actions.find((event) => event.type === "keyUp").value, strafeKey);
    assert.equal(pointer.actions[0].origin["element-6066-11e4-a52e-4f735466cecf"], "arena-id");
    assert.equal(pointer.actions[0].x, xOffset);
    assert.equal(pointer.actions.filter((event) => event.type === "pointerDown")[0].button, 0);
    assert.equal(pointer.actions.filter((event) => event.type === "pointerUp")[0].button, 0);
  }
});

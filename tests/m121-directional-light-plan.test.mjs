import test from "node:test";
import assert from "node:assert/strict";
import { dispatchM121DirectionalLight, planM121DirectionalLight } from "../scripts/m121-directional-light-plan.mjs";

const arena = { "element-6066-11e4-a52e-4f735466cecf": "live-arena-element" };

test("M121 holds a genuine W/S key throughout real LMB pointer release", () => {
  for (const [key, direction] of [["w", 200], ["s", -200]]) {
    const plan = planM121DirectionalLight(key, arena, direction, "keyboard-chrome", "mouse-chrome");
    assert.deepEqual(Object.keys(plan), ["keyDown", "pointerGesture", "keyUp"]);
    assert.equal(plan.keyDown.actions.length, 1, "dedicated keydown request only");
    assert.equal(plan.pointerGesture.actions.length, 1, "dedicated pointer request only");
    assert.equal(plan.keyUp.actions.length, 1, "dedicated keyup request only");
    assert.deepEqual(plan.keyDown.actions[0].actions, [{ type: "keyDown", value: key }]);
    assert.deepEqual(plan.keyUp.actions[0].actions, [{ type: "keyUp", value: key }]);
    assert.equal(plan.keyDown.actions[0].id, plan.keyUp.actions[0].id);
    assert.equal(plan.pointerGesture.actions[0].parameters.pointerType, "mouse");
    const actions = plan.pointerGesture.actions[0].actions;
    assert.deepEqual(actions.map(x => x.type), ["pointerMove", "pointerDown", "pause", "pointerUp"]);
    assert.equal(actions[0].origin, arena);
    assert.equal(actions[0].x, direction);
    assert.equal(actions[1].button, 0);
    assert.equal(actions[3].button, 0);
    assert.ok(actions[2].duration > 0 && actions[2].duration < 320, "must commit a real light tap, not a charged heavy");
    assert.equal(JSON.stringify(plan).includes("keyUp\""), true);
    assert.ok(!actions.some(x => x.type === "keyUp" || x.type === "keyDown"));
  }
});

test("M121 W3C requests preserve key through pointer-up and finally release it", async () => {
  const plan = planM121DirectionalLight("w", arena, 200, "keyboard-chrome", "mouse-chrome");
  const sent = [];
  await dispatchM121DirectionalLight(async (packet) => {
    sent.push(packet);
  }, plan);
  assert.deepEqual(sent, [plan.keyDown, plan.pointerGesture, plan.keyUp]);

  const sentOnFailure = [];
  await assert.rejects(() => dispatchM121DirectionalLight(async (packet) => {
    sentOnFailure.push(packet);
    if (packet === plan.pointerGesture) throw new Error("simulated driver failure");
  }, plan), /simulated driver failure/);
  assert.deepEqual(sentOnFailure, [plan.keyDown, plan.pointerGesture, plan.keyUp]);
});

test("M121 plan rejects non-perpendicular, non-arena and non-staged inputs", () => {
  assert.throws(() => planM121DirectionalLight("e", arena, 200, "k", "p"), TypeError);
  assert.throws(() => planM121DirectionalLight("w", arena, 150, "k", "p"), TypeError);
  assert.throws(() => planM121DirectionalLight("w", {}, 200, "k", "p"), TypeError);
  assert.throws(() => planM121DirectionalLight("w", arena, 200, "", "p"), TypeError);
});

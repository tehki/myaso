import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { planM147NativeFocusKeyActions } from "../scripts/m147-native-focus-stage.mjs";

test("M147 physical 210ms KeyD and 260ms KeyA use ONE original native W3C transaction", () => {
  for (const [keyboardId, key, ms] of [
    ["keyboard-chrome", "d", 210],
    ["keyboard-chrome2", "a", 260],
  ]) {
    const plan = planM147NativeFocusKeyActions({ keyboardId, key, durationMs: ms });
    assert.equal(plan.actions.length, 1, "no duplicate input sources");
    assert.equal(plan.actions[0].type, "key");
    assert.equal(plan.actions[0].id, keyboardId);
    assert.deepEqual(plan.actions[0].actions, [
      { type: "keyDown", value: key },
      { type: "pause", duration: ms },
      { type: "keyUp", value: key },
    ]);
  }
});

test("M147 corrective 45ms KeyA is bounded and rejects synthetic alternatives", () => {
  const plan = planM147NativeFocusKeyActions({
    keyboardId: "keyboard-chrome2", key: "a", durationMs: 45,
  });
  assert.equal(plan.actions[0].actions[2].type, "keyUp");
  for (const args of [
    { keyboardId: "keyboard-firefox", key: "a", durationMs: 260 },
    { keyboardId: "keyboard-chrome", key: "d", durationMs: 1363 },
    { keyboardId: "keyboard-chrome2", key: "a", durationMs: 1613 },
    { keyboardId: "keyboard-chrome", key: "e", durationMs: 210 },
    { keyboardId: "keyboard-chrome2", key: "a", durationMs: 300 },
  ]) assert.throws(() => planM147NativeFocusKeyActions(args), TypeError);
});

test("M147 original native three-player focus fixture never uses split WebDriver key holds", () => {
  const source = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
  const start = source.indexOf("  // Bring both rivals inside normal light-attack distance");
  const end = source.indexOf("  const jumpBefore =", start);
  assert.ok(start >= 0 && end > start, "strict original M147 focus staging scope remains");
  const stage = source.slice(start, end);
  assert.ok(stage.includes('pulseM147FocusStageKey(jumpAttacker, "d", 210)'), "genuine bounded attacker KeyD");
  assert.ok(stage.includes('pulseM147FocusStageKey(closerIdle, "a", 260)'), "genuine bounded closer KeyA");
  assert.ok(stage.includes('pulseMovementKeyBoundedW3c(closerIdle, plan.key, plan.durationMs)'), "replica-driven bounded physical correction");
  assert.ok(stage.includes('planM147CloserIdleGeometry('), "native durations alone cannot qualify ordinary focus geometry");
  assert.ok(!stage.includes('pulseMovementKey('), "no detached keyDown/keyup HTTP transactions");
  assert.ok(stage.includes('NEAREST #${closerId}'), "physical geometry focus gate stays strict");
});

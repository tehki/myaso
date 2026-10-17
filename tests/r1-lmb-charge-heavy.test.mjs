import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createLeftButtonCharge, LEFT_HEAVY_CHARGE_MS } from "../src/browser/left-button-charge.mjs";

function harness() {
  let ms = 1000;
  const actions = [];
  const gesture = createLeftButtonCharge({
    now: () => ms,
    onLight() { actions.push("light"); },
    onHeavy() { actions.push("heavy"); },
  });
  return { gesture, actions, set(value) { ms = value; } };
}

test("R1 short LMB release triggers precisely one light, not a premature heavy", () => {
  const h = harness();
  assert.equal(h.gesture.press(1), true);
  h.set(1100);
  assert.deepEqual(h.actions, [], "do not swing until tap versus hold is known");
  assert.equal(h.gesture.progress(), 100 / LEFT_HEAVY_CHARGE_MS);
  assert.equal(h.gesture.release(1), "light");
  assert.deepEqual(h.actions, ["light"]);
  assert.equal(h.gesture.release(1), null, "duplicate bubble must not double attack");
  assert.equal(h.gesture.progress(), 0);
});

test("R1 held LMB loads forward, then fires one heavy exactly on release", () => {
  const h = harness();
  h.gesture.press(7);
  h.set(1000 + LEFT_HEAVY_CHARGE_MS - 1);
  assert.ok(h.gesture.progress() < 1);
  assert.deepEqual(h.actions, []);
  h.set(1000 + LEFT_HEAVY_CHARGE_MS);
  assert.equal(h.gesture.progress(), 1, "full charge is a visible held state, not an auto strike");
  h.set(1000 + LEFT_HEAVY_CHARGE_MS + 130);
  assert.equal(h.gesture.progress(), 1, "charge level is bounded");
  assert.equal(h.gesture.release(7), "heavy");
  assert.deepEqual(h.actions, ["heavy"]);
  assert.equal(h.gesture.release(7), null);
});

test("R1 jump and sprint chords still attack immediately, then ignore LMB release", () => {
  const h = harness();
  assert.equal(h.gesture.press(2, { immediate: true }), true);
  assert.deepEqual(h.actions, ["light"]);
  h.set(2000);
  assert.equal(h.gesture.progress(), 0);
  assert.equal(h.gesture.release(2), "committed");
  assert.deepEqual(h.actions, ["light"]);
  h.set(3000);
  h.gesture.press(3);
  assert.equal(h.gesture.commitLight(), true, "Space pressed while LMB held");
  assert.equal(h.gesture.commitLight(), false);
  h.set(4000);
  assert.equal(h.gesture.release(3), "committed");
  assert.deepEqual(h.actions, ["light", "light"]);
});

test("R1 blur, capture loss, unmatched IDs and repeats never accidentally strike", () => {
  const h = harness();
  assert.equal(h.gesture.press(1), true);
  h.set(1100);
  assert.equal(h.gesture.press(1), false, "repeated down cannot reset charge threshold");
  assert.equal(h.gesture.press(9), false);
  assert.equal(h.gesture.release(9), null);
  assert.equal(h.gesture.cancel(9), false);
  assert.equal(h.gesture.cancel(1), true);
  h.set(2000);
  assert.equal(h.gesture.release(1), null);
  assert.deepEqual(h.actions, []);
  h.gesture.press(2);
  h.set(5000);
  h.gesture.cancel();
  assert.equal(h.gesture.release(2), null);
  assert.deepEqual(h.actions, []);
});

test("R1 preserves original RMB sprint/kick, E heavy, and space/run attack input routes", () => {
  const online = readFileSync(new URL("../web/online-game.mjs", import.meta.url), "utf8");
  const offline = readFileSync(new URL("../web/game.mjs", import.meta.url), "utf8");
  const rmb = readFileSync(new URL("../src/browser/right-button-gesture.mjs", import.meta.url), "utf8");
  const html = readFileSync(new URL("../web/index.html", import.meta.url), "utf8");
  for (const source of [online, offline]) {
    assert.match(source, /installRightButtonGesture\(canvas/);
    assert.match(source, /createLeftButtonCharge\(/);
    assert.match(source, /leftButtonCharge\.release\(event\.pointerId\)/);
    assert.match(source, /leftButtonCharge\.commitLight\(\)/);
    assert.match(source, /rightButtonGesture\.isRunning\(\)/);
    assert.match(source, /if \(event\.code === "KeyE" && !event\.repeat\) heavyAttackRequested = true;/);
    assert.match(source, /ctx\.translate\(lean, 0\)/);
    assert.match(source, /function drawLmbChargeTell\(progress\)/);
  }
  assert.match(rmb, /holdThresholdMs = 180/);
  assert.match(rmb, /onKick\(\)/);
  assert.match(html, /LMB tap/);
  assert.match(html, /LMB hold/);
  assert.match(html, /RMB hold/);
});

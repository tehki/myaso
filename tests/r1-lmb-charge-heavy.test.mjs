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

test("R2 LMB pointerDOWN commits exactly one light immediately", () => {
  const h = harness();
  assert.equal(h.gesture.press(1), true);
  assert.deepEqual(h.actions, ["light"], "no 320ms tap classification wait");
  h.set(1000 + LEFT_HEAVY_CHARGE_MS - 1);
  assert.equal(h.gesture.release(1), "light");
  assert.deepEqual(h.actions, ["light"], "pointerUP does not issue a second light");
});

test("R2 sustained LMB upgrades windup into heavy before light can hit", () => {
  const h = harness();
  assert.equal(h.gesture.press(7), true);
  assert.deepEqual(h.actions, ["light"]);
  h.set(1000 + LEFT_HEAVY_CHARGE_MS);
  assert.equal(h.gesture.release(7), "heavy");
  assert.deepEqual(h.actions, ["light", "heavy"]);
  assert.equal(h.gesture.release(7), null);
});

test("R2 timer-driven hold upgrade fires without waiting for mouse release", () => {
  let ms = 0, callback = null;
  const actions = [];
  const gesture = createLeftButtonCharge({
    now: () => ms,
    schedule(fn) { callback = fn; return 1; },
    cancelScheduled() { callback = null; },
    onLight: () => actions.push("light"),
    onHeavy: () => actions.push("heavy"),
  });
  gesture.press(1);
  ms = LEFT_HEAVY_CHARGE_MS;
  callback();
  assert.deepEqual(actions, ["light", "heavy"]);
  assert.equal(gesture.release(1), "heavy");
  assert.deepEqual(actions, ["light", "heavy"]);
});

test("R2 jump chord commits light immediately and cannot upgrade", () => {
  const h = harness();
  h.gesture.press(2, { immediate: true });
  assert.deepEqual(h.actions, ["light"]);
  h.set(2000);
  assert.equal(h.gesture.progress(), 0);
  assert.equal(h.gesture.release(2), "committed");
  h.gesture.press(3);
  assert.equal(h.gesture.commitLight(), true);
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
  assert.deepEqual(h.actions, ["light"]);
  h.gesture.press(2);
  h.set(5000);
  h.gesture.cancel();
  assert.equal(h.gesture.release(2), null);
  assert.deepEqual(h.actions, ["light", "light"]);
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

test("M324 genuine wheel+LMB release in same W3C tick", () => {
  const runner = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
  const start = runner.indexOf("async function performArenaFeint(");
  const end = runner.indexOf("async function performArenaRecoveryBufferedRoll(", start);
  assert.ok(start > 0 && end > start, "genuine Firefox/Chrome feint command remains present");
  const body = runner.slice(start, end);
  assert.match(body, /{ type: "pointerDown", button: 0 },\s*{ type: "pause", duration: 20 },\s*{ type: "pointerUp", button: 0 }/);
  assert.match(body, /{ type: "pause", duration: 20 },\s*{ type: "scroll", x: 0, y: 0, deltaX: 0, deltaY: 120/);
  assert.match(body, /W3C multi-source action/);
  assert.doesNotMatch(body, /window\.__MYASO|dispatchEvent\(/, "only real browser-owned actions can prove feint");
});

test("R1 charge meter is independently visible even while damage/status messages update", () => {
  const html = readFileSync(new URL("../web/index.html", import.meta.url), "utf8");
  const css = readFileSync(new URL("../web/styles.css", import.meta.url), "utf8");
  for (const path of ["../web/game.mjs", "../web/online-game.mjs"]) {
    const content = readFileSync(new URL(path, import.meta.url), "utf8");
    assert.match(content, /function updateChargeHud\(\)/);
    assert.match(content, /chargeHud\.root\.hidden = progress <= 0/);
    assert.match(content, /chargeHud\.value\.textContent = percent === 100 \? "READY"/);
    assert.match(content, /updateChargeHud\(\);/);
  }
  assert.match(html, /id="heavy-charge-indicator"/);
  assert.match(css, /\.heavy-charge-indicator\[hidden\]/);
  assert.match(css, /pointer-events: none/);
});

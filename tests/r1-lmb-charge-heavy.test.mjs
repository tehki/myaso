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

test("R1 restored 320ms LMB loading: short tap releases exactly one light", () => {
  const h = harness();
  assert.equal(LEFT_HEAVY_CHARGE_MS, 320);
  assert.equal(h.gesture.press(1), true);
  assert.deepEqual(h.actions, [], "no 135ms light while heavy still loading");
  h.set(1000 + LEFT_HEAVY_CHARGE_MS - 1);
  assert.equal(h.gesture.release(1), "light");
  assert.deepEqual(h.actions, ["light"]);
  assert.equal(h.gesture.release(1), null);
});

test("320ms held LMB commits only heavy upon release, never free early light", () => {
  const h = harness();
  assert.equal(h.gesture.press(7), true);
  h.set(1000 + LEFT_HEAVY_CHARGE_MS);
  assert.equal(h.gesture.progress(), 1);
  assert.deepEqual(h.actions, []);
  assert.equal(h.gesture.release(7), "heavy");
  assert.deepEqual(h.actions, ["heavy"]);
  assert.equal(h.gesture.release(7), null);
});

test("sustained hold without release cannot secretly land a light", () => {
  const h = harness();
  h.gesture.press(9);
  h.set(1000 + LEFT_HEAVY_CHARGE_MS + 600);
  assert.deepEqual(h.actions, []);
  assert.equal(h.gesture.release(9), "heavy");
  assert.deepEqual(h.actions, ["heavy"]);
});

test("jump chord commits immediately and does not turn into heavy after long hold", () => {
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

test("blur, capture loss, unmatched IDs and repeat presses never fire pending attack", () => {
  const h = harness();
  h.gesture.press(1);
  h.set(1100);
  assert.equal(h.gesture.press(1), false);
  assert.equal(h.gesture.press(9), false);
  assert.equal(h.gesture.release(9), null);
  assert.equal(h.gesture.cancel(9), false);
  assert.equal(h.gesture.cancel(1), true);
  h.set(2000);
  assert.equal(h.gesture.release(1), null);
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

test("R2 restored charge defers wheel until after the real LMB release", () => {
  const runner = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
  const start = runner.indexOf("async function performArenaFeint(");
  const end = runner.indexOf("async function performArenaRecoveryBufferedRoll(", start);
  assert.ok(start > 0 && end > start, "genuine Firefox/Chrome feint command remains present");
  const body = runner.slice(start, end);
  assert.match(body, /{ type: "pointerDown", button: 0 },\s*{ type: "pause", duration: 20 },\s*{ type: "pointerUp", button: 0 }/);
  assert.match(body, /{ type: "pause", duration: 20 },\s*{ type: "pause", duration: 20 },\s*{ type: "scroll", x: 0, y: 0, deltaX: 0, deltaY: 120/);
  assert.match(body, /genuine wheel-back tick/);
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

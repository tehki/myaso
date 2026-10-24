import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createLeftButtonCharge, LEFT_HEAVY_CHARGE_MS } from "../src/browser/left-button-charge.mjs";
import { installRightButtonGesture } from "../src/browser/right-button-gesture.mjs";

function harness() {
  let ms = 1000;
  const actions = [];
  const gesture = createLeftButtonCharge({
    now: () => ms,
    onLight: () => actions.push("light"),
    onHeavy: () => actions.push("heavy"),
  });
  return { gesture, actions, set: value => { ms = value; } };
}

test("LMB pointerDOWN never strikes: release before full charge fires exactly one light", () => {
  const h = harness();
  assert.equal(h.gesture.press(7), true);
  assert.deepEqual(h.actions, [], "a held LMB must not deal early light damage");
  h.set(1000 + LEFT_HEAVY_CHARGE_MS - 1);
  assert.equal(h.gesture.release(7), "light");
  assert.deepEqual(h.actions, ["light"]);
  assert.equal(h.gesture.release(7), null);
});

test("fully charged LMB does not fire until pointerUP, even after a long hold", () => {
  const h = harness();
  h.gesture.press(8);
  h.set(1160);
  assert.equal(h.gesture.progress(), 0.5);
  assert.deepEqual(h.actions, []);
  h.set(1320);
  assert.equal(h.gesture.progress(), 1);
  assert.deepEqual(h.actions, [], "READY may be held indefinitely without auto-strike");
  h.set(9900);
  assert.equal(h.gesture.progress(), 1);
  assert.deepEqual(h.actions, []);
  assert.equal(h.gesture.release(8), "heavy");
  assert.deepEqual(h.actions, ["heavy"]);
  assert.equal(h.gesture.progress(), 0);
});

test("full 320ms charge is strict; early release fires light, not heavy", () => {
  assert.equal(LEFT_HEAVY_CHARGE_MS, 320);
  const h = harness();
  h.gesture.press(1);
  h.set(1319.999);
  assert.equal(h.gesture.release(1), "light");
  h.gesture.press(2);
  h.set(1640);
  assert.equal(h.gesture.release(2), "heavy");
  assert.deepEqual(h.actions, ["light", "heavy"]);
});

test("Space+LMB commits jump-chord light immediately exactly once", () => {
  const h = harness();
  h.gesture.press(1, { immediate: true });
  assert.deepEqual(h.actions, ["light"]);
  h.set(5000);
  assert.equal(h.gesture.progress(), 0);
  assert.equal(h.gesture.release(1), "committed");
  assert.deepEqual(h.actions, ["light"]);
  h.gesture.press(2);
  assert.equal(h.gesture.commitLight(), true);
  assert.equal(h.gesture.commitLight(), false);
  assert.deepEqual(h.actions, ["light", "light"]);
  assert.equal(h.gesture.release(2), "committed");
});

test("lost capture, blur and unmatched pointer IDs never issue phantom strikes", () => {
  const h = harness();
  h.gesture.press(1);
  h.set(1500);
  assert.equal(h.gesture.press(1), false);
  assert.equal(h.gesture.press(2), false);
  assert.equal(h.gesture.release(2), null);
  assert.equal(h.gesture.cancel(2), false);
  assert.equal(h.gesture.cancel(1), true);
  assert.equal(h.gesture.release(1), null);
  assert.deepEqual(h.actions, []);
  h.gesture.press(3);
  h.set(6000);
  h.gesture.cancel();
  assert.equal(h.gesture.release(3), null);
  assert.deepEqual(h.actions, []);
});

test("RMB running state survives LMB capture migration and stops at real RMB release", () => {
  let ms = 1000;
  const canvas = { listeners: new Map(), addEventListener(name, fn) {
    this.listeners.set(name, [...(this.listeners.get(name) || []), fn]);
  }, fire(name, event) { for (const fn of this.listeners.get(name) || []) fn(event); } };
  const host = { listeners: new Map(), addEventListener(name, fn) {
    this.listeners.set(name, [...(this.listeners.get(name) || []), fn]);
  }, fire(name, event) { for (const fn of this.listeners.get(name) || []) fn(event); } };
  const kicked = [];
  const rmb = installRightButtonGesture(canvas, {
    onKick: () => kicked.push("kick"), now: () => ms, eventTarget: host,
  });
  canvas.fire("pointerdown", { button: 2, pointerId: 1 });
  ms += 200;
  assert.equal(rmb.isRunning(), true);
  canvas.fire("lostpointercapture", { button: 0, buttons: 2, pointerId: 1 });
  assert.equal(rmb.isRunning(), true, "LMB capture changes cannot cancel held RMB run");
  canvas.fire("pointerup", { button: 0, pointerId: 1 });
  assert.equal(rmb.isRunning(), true);
  host.fire("pointerup", { button: 2, pointerId: 1 });
  assert.equal(rmb.isRunning(), false);
  assert.deepEqual(kicked, [], "long RMB hold is never a kick");
});

test("both clients receive chorded RMB+LMB mouse events and retain running release", () => {
  for (const path of ["../web/game.mjs", "../web/online-game.mjs"]) {
    const s = readFileSync(new URL(path, import.meta.url), "utf8");
    assert.match(s, /canvas\.addEventListener\("mousedown"/);
    assert.match(s, /canvas\.addEventListener\("mouseup", onChordedLeftMouseUp\)/);
    assert.match(s, /window\.addEventListener\("mouseup", onChordedLeftMouseUp\)/);
    assert.match(s, /event\.button !== 0 \|\| !\(event\.buttons & 2\)/);
    assert.match(s, /leftButtonCharge\.press\(CHORDED_LEFT_POINTER_ID/);
    assert.match(s, /leftButtonCharge\.release\(CHORDED_LEFT_POINTER_ID\)/);
    assert.match(s, /chordedLeftDown = false/);
    assert.match(s, /rightButtonGesture\.isRunning\(\)/);
    assert.match(s, /runningAttackRequested/);
    assert.match(s, /leftButtonCharge\.isCharging\(\)/, "held charge sent on existing wire bits");
    assert.match(s, /rightButtonGesture\.isRunning\(\) \|\| runningAttackRequested/, "RMB run is latched through the outgoing attack tick");
    assert.match(s, /leftButtonCharge\.release\(event\.pointerId\)/);
    assert.match(s, /leftButtonCharge\.commitLight\(\)/);
    assert.match(s, /if \\(event\\.code === "KeyE"\\) return;/,
      "E is reserved for Use and never reaches Combat input");
    assert.doesNotMatch(s, /event\\.code === "KeyE"[^\\n]*heavyAttackRequested/);
    assert.doesNotMatch(s, /event\\.code === "KeyE"[^\\n]*audio\\.play\\("heavy"\\)/);
    assert.match(s, /onHeavy\\(\\) \\{ heavyAttackRequested = true;/,
      "physical LMB still owns heavy commit");
    assert.match(s, /function drawLmbChargeTell\(progress\)/);
  }
  const rmb = readFileSync(new URL("../src/browser/right-button-gesture.mjs", import.meta.url), "utf8");
  assert.match(rmb, /holdThresholdMs = 180/);
  assert.doesNotMatch(rmb, /addEventListener\("lostpointercapture"/);
});

test("M333 W3C feint gesture remains true mouse and wheel input", () => {
  const runner = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
  const start = runner.indexOf("async function performArenaFeint(");
  const end = runner.indexOf("async function performArenaRecoveryBufferedRoll(", start);
  assert.ok(start > 0 && end > start);
  const body = runner.slice(start, end);
  assert.match(body, /\{ type: "pointerDown", button: 0 \},\s*\{ type: "pause", duration: 0 \},\s*\{ type: "pause", duration: 0 \},\s*\{ type: "pointerUp", button: 0 \}/);
  assert.match(body, /\{ type: "pause", duration: 0 \},\s*\{ type: "pause", duration: 0 \},\s*\{ type: "scroll", x: 0, y: 0, deltaX: 0, deltaY: 120/);
  assert.doesNotMatch(body, /window\.__MYASO|dispatchEvent\(/);
});

test("full charge HUD stays READY independently of status events", () => {
  const html = readFileSync(new URL("../web/index.html", import.meta.url), "utf8");
  const css = readFileSync(new URL("../web/styles.css", import.meta.url), "utf8");
  for (const path of ["../web/game.mjs", "../web/online-game.mjs"]) {
    const s = readFileSync(new URL(path, import.meta.url), "utf8");
    assert.match(s, /function updateChargeHud\(\)/);
    assert.match(s, /chargeHud\.root\.hidden = progress <= 0/);
    assert.match(s, /chargeHud\.value\.textContent = percent === 100 \? "READY"/);
    assert.match(s, /updateChargeHud\(\)/);
  }
  assert.match(html, /id="heavy-charge-indicator"/);
  assert.match(css, /\.heavy-charge-indicator\[hidden\]/);
});

test("existing server-authoritative heavy windup and reach remain unchanged", () => {
  const model = readFileSync(new URL("../src/combat/model.mjs", import.meta.url), "utf8");
  const server = readFileSync(new URL("../server/src/simulation.rs", import.meta.url), "utf8");
  assert.match(model, /windupMs: 320,\s*activeMs: 100,\s*recoveryMs: 420,\s*reach: 82/);
  assert.match(server, /HEAVY_ATTACK_WINDUP_MS: f32 = 320\.0/);
});

test("M111 one genuine LMB release gives exactly one 34HP guard-break punish", () => {
  const source = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
  const start = source.indexOf("async function runOnlineUiHeavyGuardBreakPunishFlight(");
  const end = source.indexOf("\nasync function ", start + 40);
  assert.ok(start >= 0 && end > start);
  const proof = source.slice(start, end);
  assert.match(proof, /const firstClickTargetMs = COMBAT\.heavyAttack\.windupMs\s*\+ COMBAT\.heavyAttack\.activeMs \+ COMBAT\.heavyAttack\.recoveryMs \+ 60/,
    "M111 must release a genuine light after authoritative heavy recovery, not during it");
  assert.match(proof, /performArenaAttackBurst\(attacker, 1, initialPauseMs, 0\)/);
  assert.doesNotMatch(proof, /performArenaAttackBurst\(attacker, 9/);
  assert.match(proof, /Opponent hit - 34 HP\./);
  assert.match(proof, /Hit taken - 34 HP\./);
  assert.match(proof, /hitDuringStun/);
  assert.match(proof, /punishLightThreatTransitions/);
});

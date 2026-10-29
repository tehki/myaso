import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import { createLeftButtonCharge } from "../src/browser/left-button-charge.mjs";

const source = readFileSync(new URL("../web/online-game.mjs", import.meta.url), "utf8");
const start = source.indexOf("function cancelActiveLeftPointer(pointerId) {");
const end = source.indexOf("\ncanvas.addEventListener(\"pointercancel\"", start);

test("4A cancel is exact-pointer scoped; stale capture-loss cannot cancel a newer physical press", () => {
  assert.ok(start >= 0 && end > start, "one shared active-left cancellation handler");
  let now = 0;
  let lights = 0;
  let heavies = 0;
  const charge = createLeftButtonCharge({
    now: () => now,
    onLight: () => { lights++; },
    onHeavy: () => { heavies++; },
  });
  const context = {
    leftButtonCharge: charge,
    leftButtonDown: true,
    leftButtonPressMovement: { moveX: 1, moveY: 0 },
    chordedLeftDown: true,
    typedLmbEnabled: false,
  };
  runInNewContext(source.slice(start, end), context);
  assert.equal(typeof context.cancelActiveLeftPointer, "function");
  assert.equal(charge.press(17), true);
  assert.equal(context.cancelActiveLeftPointer(16), false, "stale lostcapture id must not cancel");
  assert.equal(context.leftButtonDown, true);
  assert.equal(context.leftButtonPressMovement.moveX, 1);
  assert.equal(charge.isPressed(), true);
  assert.equal(context.cancelActiveLeftPointer(17), true);
  assert.equal(context.leftButtonDown, false);
  assert.equal(context.leftButtonPressMovement, null);
  assert.equal(context.chordedLeftDown, false);
  assert.equal(charge.isPressed(), false);
  now = 450;
  assert.equal(charge.release(17), null, "cancel is terminal; no phantom heavy on release");
  assert.equal(lights, 0);
  assert.equal(heavies, 0);
});

test("4A pointercancel honors physical pointer identity even when event.button is -1", () => {
  const startCancel = source.indexOf('canvas.addEventListener("pointercancel", (event) => {');
  const endCancel = source.indexOf('canvas.addEventListener("lostpointercapture"', startCancel);
  assert.ok(startCancel > 0 && endCancel > startCancel);
  const handler = source.slice(startCancel, endCancel);
  assert.ok(handler.includes("cancelActiveLeftPointer(event.pointerId)"));
  assert.doesNotMatch(handler, /if\s*\(event\.button\s*===\s*0\)/,
    "pointercancel commonly reports button=-1; do not discard real cancellation");
  const lost = source.slice(endCancel, source.indexOf('canvas.addEventListener("wheel"', endCancel));
  assert.ok(lost.includes("cancelActiveLeftPointer(event.pointerId)"));
  assert.doesNotMatch(lost, /leftButtonPressMovement\s*=\s*null/,
    "stale capture-loss cannot clear the next pointer's capture state");
});

test("4A keyup is observed on window after arena focus transfers within the same tab", () => {
  assert.match(source, /canvas\.addEventListener\("keydown",/);
  assert.match(source, /window\.addEventListener\("keyup", \(event\) => keys\.delete\(event\.code\)\)/);
  assert.doesNotMatch(source, /canvas\.addEventListener\("keyup"/);
  assert.match(source, /window\.addEventListener\("blur", releaseInputs\)/);
  assert.match(source, /function releaseInputs\(\)\s*\{\s*keys\.clear\(\)/);
  // No synthetic keydowns, movement packets or additional input producer:
  const changedHandler = source.slice(
    source.indexOf('window.addEventListener("keyup"'),
    source.indexOf('window.addEventListener("blur"'));
  assert.doesNotMatch(changedHandler, /sendInput|dispatchEvent|currentInput/);
});

test("4A genuine pointerUP rejects stale pointer ID without erasing the next gesture", () => {
  const upStart = source.indexOf("function onLeftPointerUp(event) {");
  const upEnd = source.indexOf('canvas.addEventListener("pointerup", onLeftPointerUp);', upStart);
  assert.ok(upStart > 0 && upEnd > upStart);
  let lights = 0;
  let heavies = 0;
  let moved = 0;
  const charge = createLeftButtonCharge({
    now: () => 10,
    onLight: () => { lights++; },
    onHeavy: () => { heavies++; },
  });
  const ctx = {
    leftButtonCharge: charge,
    leftButtonDown: true,
    leftButtonPressMovement: { moveX: 1, moveY: -1 },
    middleBlockHeld: false,
    typedLmbEnabled: false,
    m111InputProbe: null,
    audio: { isUnlocked: () => true },
    updateMouse: () => { moved++; },
  };
  runInNewContext(source.slice(upStart, upEnd), ctx);
  assert.equal(charge.press(37), true);
  ctx.onLeftPointerUp({ button: 0, pointerId: 36 });
  assert.equal(charge.isPressed(), true, "wrong-pointer event cannot release current gesture");
  assert.equal(ctx.leftButtonDown, true);
  assert.equal(ctx.leftButtonPressMovement.moveX, 1);
  assert.equal(ctx.leftButtonPressMovement.moveY, -1);
  assert.equal(lights, 0);
  assert.equal(heavies, 0);
  ctx.onLeftPointerUp({ button: 0, pointerId: 37 });
  assert.equal(charge.isPressed(), false);
  assert.equal(ctx.leftButtonDown, false);
  assert.equal(ctx.leftButtonPressMovement, null);
  assert.equal(lights, 1, "exactly one genuine matching short LMB commits light");
  assert.equal(heavies, 0);
  ctx.onLeftPointerUp({ button: 0, pointerId: 37 });
  assert.equal(lights, 1, "duplicate stale pointerUP cannot commit a second attack");
  assert.equal(moved, 3);
});

test("4A attached window keyup handler clears real arena movement after in-tab focus transfer", () => {
  const fragment = 'window.addEventListener("keyup", (event) => keys.delete(event.code));';
  assert.ok(source.includes(fragment));
  const listeners = new Map();
  const keys = new Set(["KeyD", "Space"]);
  runInNewContext(fragment, {
    window: { addEventListener: (type, cb) => listeners.set(type, cb) },
    keys,
  });
  assert.equal(listeners.has("keyup"), true);
  listeners.get("keyup")({ code: "KeyD" });
  assert.equal(keys.has("KeyD"), false, "real keyup delivered to window clears movement key");
  assert.equal(keys.has("Space"), true, "unrelated held Space must remain held");
  listeners.get("keyup")({ code: "Space" });
  assert.equal(keys.size, 0);
});

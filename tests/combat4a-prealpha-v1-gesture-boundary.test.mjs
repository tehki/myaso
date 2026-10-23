import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { createLeftButtonCharge } from "../src/browser/left-button-charge.mjs";
import { NETWORK } from "../src/network/constants.mjs";
import { encodeInputPacket, decodeInputPacket, inputPacketBytes } from "../src/network/input-codec.mjs";

// REVIEW-ONLY P0 regression witnesses for #531/#696/#723.
// These tests deliberately prove existing v1 limitations; they do NOT claim
// to exercise authenticated QUIC, server admission, or World hit resolution.
// Do not replace these witnesses with fabricated "passing" hit assertions.

test("Combat 4A: live normal LMB has no light callback at pointerDOWN (known Pre-Alpha blocker)", () => {
  let clock = 100;
  const events = [];
  const lmb = createLeftButtonCharge({
    now: () => clock,
    onLight: () => events.push("LIGHT"),
    onHeavy: () => events.push("HEAVY"),
  });
  assert.equal(lmb.press(7), true);
  assert.equal(lmb.isCharging(), true);
  assert.deepEqual(events, [], "v1 controller currently defers normal light until release");
  clock = 112; // Native 12ms witness duration from issue #531.
  assert.equal(lmb.release(7), "light");
  assert.deepEqual(events, ["LIGHT"]);
  assert.equal(lmb.release(7), null, "repeated release cannot queue a second attack");
});

test("Combat 4A: old held LMB produces simultaneous attack + heavy flags before any light callback", () => {
  let clock = 100;
  const events = [];
  const lmb = createLeftButtonCharge({
    now: () => clock,
    onLight: () => events.push("LIGHT"),
    onHeavy: () => events.push("HEAVY"),
  });
  lmb.press(5);
  const leftChargeHeld = lmb.isCharging();
  const sample = { attack: leftChargeHeld, heavyAttack: leftChargeHeld };
  assert.deepEqual(sample, { attack: true, heavyAttack: true });
  assert.deepEqual(events, []);
  const packet = decodeInputPacket(encodeInputPacket({
    sequence: 5,
    clientTick: 40,
    samples: [{ tick: 40, ...sample }],
  }));
  assert.equal(packet.samples[0].attack, true);
  assert.equal(packet.samples[0].heavyAttack, true);
  clock = 112;
  assert.equal(lmb.release(5), "light");
  assert.deepEqual(events, ["LIGHT"]);
  // This DOES NOT prove which flag combination an actual server tick admitted.
});

test("Combat 4A: 34-byte legacy v1 packet cannot encode independent KeyE vs orphaned LMB provenance", () => {
  assert.equal(NETWORK.protocolVersion, 1);
  assert.equal(inputPacketBytes(NETWORK.inputRedundancy), 34);
  const sample = { tick: 40, attack: false, heavyAttack: true };
  const keyE = new Uint8Array(encodeInputPacket({
    sequence: 6, clientTick: 40,
    samples: [sample, { tick: 39 }, { tick: 38 }],
  }));
  // Same observed v1 sample when the preceding held-LMB press is lost:
  // one heavy pulse, without typed gesture identity or source.
  const orphanLmb = new Uint8Array(encodeInputPacket({
    sequence: 6, clientTick: 40,
    samples: [sample, { tick: 39 }, { tick: 38 }],
  }));
  assert.deepEqual(keyE, orphanLmb, "distinct physical origins collide on identical v1 wire bytes");
  assert.equal(keyE.length, 34);
  const decoded = decodeInputPacket(keyE);
  assert.deepEqual(
    decoded.samples.map(x => [x.attack, x.heavyAttack]),
    [[false, true], [false, false], [false, false]],
  );
  assert.equal("inputSource" in decoded.samples[0], false);
  assert.equal("gestureId" in decoded.samples[0], false);
});

test("Combat 4A: fast DOWN+UP can fit within one real v1 sampler interval", () => {
  // This arithmetic witnesses the gap; it does not pretend that onLight()
  // cannot enqueue a later sampled attack, nor claim a real packet was lost.
  assert.equal(NETWORK.inputSendHz, 60, "re-evaluate this witness if live send cadence changes");
  const interval = 1000 / NETWORK.inputSendHz;
  const downMs = 2;
  const upMs = 14;
  assert.ok(downMs > 0 && upMs < interval);
  assert.equal(upMs - downMs, 12);
  assert.ok(interval > upMs - downMs);
});

test("Combat 4A: W3C pointercancel with button=-1 retires only the matching LMB pointer", () => {
  let nowMs = 0;
  const events = [];
  const lmb = createLeftButtonCharge({
    now: () => nowMs,
    onLight: () => events.push("LIGHT"),
    onHeavy: () => events.push("HEAVY"),
  });
  assert.equal(lmb.press(41), true);
  const cancellationEvent = { pointerId: 41, button: -1 };
  assert.equal(lmb.cancel(999), false, "an unrelated pointer cannot cancel the LMB");
  assert.equal(lmb.isPressed(), true);
  assert.equal(lmb.cancel(cancellationEvent.pointerId), true);
  nowMs = 500;
  assert.equal(lmb.isPressed(), false);
  assert.equal(lmb.release(cancellationEvent.pointerId), null);
  assert.deepEqual(events, [], "a canceled long charge may not cause delayed heavy/light");
});

test("Combat 4A: live pointercancel handlers do not require a pointer-button transition", () => {
  for (const path of ["../web/online-game.mjs", "../web/game.mjs"]) {
    const source = readFileSync(new URL(path, import.meta.url), "utf8");
    const match = source.match(/canvas\.addEventListener\("pointercancel", \(event\) => \{([\s\S]*?)\n\}\);/);
    assert.ok(match, path + " must own the real pointercancel handler");
    assert.doesNotMatch(match[1], /if \(event\.button === 0\)/,
      path + " must not ignore a genuine W3C pointercancel(button=-1)");
    assert.match(match[1], /leftButtonCharge\.cancel\(event\.pointerId\)/,
      path + " must cancel by active pointer identity, not event.button");
  }
  const online = readFileSync(new URL("../web/online-game.mjs", import.meta.url), "utf8");
  assert.match(online, /leftButtonCharge\.release\(event\.pointerId\);\s*leftButtonPressMovement = null;/,
    "keep the exact original R1 release/movement-clear contract");
  assert.match(online, /leftButtonPressMovement = null;\s*leftButtonCharge\.cancel\(event\.pointerId\)/,
    "keep the exact original R1 cancel/movement-clear contract");
});

function loadRealInputHandler(filePath, kind, context) {
  const source = readFileSync(new URL(filePath, import.meta.url), "utf8");
  let start, end;
  if (kind === "onLeftPointerUp") {
    start = source.indexOf("function onLeftPointerUp(event) {");
    end = source.indexOf("\n}\ncanvas.addEventListener(\"pointerup\"", start);
    assert.ok(start >= 0 && end > start, filePath + " pointerup function present");
    runInNewContext(source.slice(start, end + 2), context);
    return context.onLeftPointerUp;
  }
  const marker = 'canvas.addEventListener("' + kind + '", (event) => {';
  start = source.indexOf(marker);
  end = source.indexOf("\n});", start);
  assert.ok(start >= 0 && end > start, filePath + " " + kind + " handler present");
  const listeners = new Map();
  context.canvas = { addEventListener: (event, fn) => listeners.set(event, fn) };
  runInNewContext(source.slice(start, end + 4), context);
  return listeners.get(kind);
}

test("Combat 4A: online active LMB survives foreign pointerup and release remains genuine", () => {
  let clock = 100;
  const events = [];
  const leftButtonCharge = createLeftButtonCharge({
    now: () => clock, onLight: () => events.push("LIGHT"), onHeavy: () => events.push("HEAVY"),
  });
  leftButtonCharge.press(7);
  assert.equal(leftButtonCharge.isActivePointer(12), false);
  assert.equal(leftButtonCharge.isActivePointer(7), true);
  assert.equal(leftButtonCharge.isActivePointer(undefined), false);
  const context = {
    leftButtonDown: true,
    leftButtonPressMovement: { moveX: 1 },
    leftButtonCharge,
    updateMouse: () => {},
    audio: { isUnlocked: () => true },
  };
  const up = loadRealInputHandler("../web/online-game.mjs", "onLeftPointerUp", context);
  up({ pointerId: 12, button: 0 });
  assert.equal(leftButtonCharge.isPressed(), true);
  assert.equal(context.leftButtonDown, true, "other pointer cannot end real held LMB");
  assert.ok(context.leftButtonPressMovement, "foreign release cannot erase captured left movement");
  clock = 112;
  up({ pointerId: 7, button: 0 });
  assert.equal(context.leftButtonDown, false);
  assert.equal(context.leftButtonPressMovement, null);
  assert.deepEqual(events, ["LIGHT"]);
});

test("Combat 4A: lost capture retires only own LMB, clears online latch and never yields hit", () => {
  const events = [];
  const leftButtonCharge = createLeftButtonCharge({
    onLight: () => events.push("LIGHT"), onHeavy: () => events.push("HEAVY"),
  });
  leftButtonCharge.press(7);
  const context = {
    leftButtonDown: true,
    leftButtonPressMovement: { moveY: 1 },
    middleBlockHeld: false,
    leftButtonCharge,
  };
  const lost = loadRealInputHandler("../web/online-game.mjs", "lostpointercapture", context);
  lost({ pointerId: 19, button: -1, buttons: 0 });
  assert.equal(leftButtonCharge.isPressed(), true);
  assert.equal(context.leftButtonDown, true);
  assert.ok(context.leftButtonPressMovement, "unrelated capture loss cannot clear movement");
  lost({ pointerId: 7, button: -1, buttons: 0 });
  assert.equal(leftButtonCharge.isPressed(), false);
  assert.equal(context.leftButtonDown, false, "own loss must clear Space+LMB latch");
  assert.equal(context.leftButtonPressMovement, null);
  assert.equal(leftButtonCharge.release(7), null);
  assert.deepEqual(events, []);
});

test("Combat 4A: practice lost-capture without pointer identity cannot cancel current LMB", () => {
  const leftButtonCharge = createLeftButtonCharge({
    onLight: () => {}, onHeavy: () => {},
  });
  leftButtonCharge.press(7);
  const lost = loadRealInputHandler("../web/game.mjs", "lostpointercapture", {
    middleBlockHeld: false,
    leftButtonCharge,
  });
  lost({ button: -1, buttons: 0 });
  assert.equal(leftButtonCharge.isPressed(), true, "missing pointerId is not authority to cancel");
  lost({ pointerId: 7, button: -1, buttons: 0 });
  assert.equal(leftButtonCharge.isPressed(), false);
});

test("Combat 4A: duplicate/foreign pointerDOWN cannot overwrite real LMB movement", () => {
  let nowMs = 100;
  const events = [];
  const leftButtonCharge = createLeftButtonCharge({
    now: () => nowMs,
    onLight: () => events.push("LIGHT"),
    onHeavy: () => events.push("HEAVY"),
  });
  const keys = new Set(["KeyA"]);
  const context = {
    keys,
    leftButtonDown: false,
    leftButtonPressMovement: null,
    leftButtonCharge,
    jumpRequested: false,
    local: { action: "idle" },
    COMBAT_ACTION: { jump: "jump" },
    updateMouse: () => {},
    captureLightAttackMovement: keySet => ({
      moveX: (keySet.has("KeyD") ? 1 : 0) - (keySet.has("KeyA") ? 1 : 0),
      moveY: (keySet.has("KeyS") ? 1 : 0) - (keySet.has("KeyW") ? 1 : 0),
    }),
  };
  const down = loadRealInputHandler("../web/online-game.mjs", "pointerdown", context);
  context.canvas.focus = () => {};
  down({ pointerId: 7, button: 0 });
  assert.equal(context.leftButtonDown, true);
  assert.equal(leftButtonCharge.isActivePointer(7), true);
  assert.equal(context.leftButtonPressMovement.moveX, -1);
  const firstMovement = context.leftButtonPressMovement;
  keys.clear();
  keys.add("KeyD");
  nowMs = 110;
  down({ pointerId: 7, button: 0 });
  down({ pointerId: 19, button: 0 });
  assert.equal(leftButtonCharge.isActivePointer(7), true);
  assert.equal(context.leftButtonPressMovement, firstMovement,
    "ignored additional DOWN must not overwrite accepted gesture movement");
  assert.equal(context.leftButtonPressMovement.moveX, -1);
  nowMs = 112;
  const up = loadRealInputHandler("../web/online-game.mjs", "onLeftPointerUp", context);
  context.audio = { isUnlocked: () => true };
  up({ pointerId: 7, button: 0 });
  assert.deepEqual(events, ["LIGHT"]);
  assert.equal(context.leftButtonPressMovement, null);
});

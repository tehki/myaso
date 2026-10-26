import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { captureLightAttackMovement } from "../src/browser/light-attack-movement.mjs";

test("LMB light release captures genuine strafe before same-frame keyup", () => {
  const keys = new Set(["KeyW"]);
  const committed = captureLightAttackMovement(keys);
  keys.delete("KeyW");
  assert.deepEqual(committed, { moveX: 0, moveY: -1 });
  assert.deepEqual(captureLightAttackMovement(keys), { moveX: 0, moveY: 0 });
  assert.equal(committed.moveY, -1);
});

test("directional light snapshots handle opposed keys and diagonals", () => {
  assert.deepEqual(captureLightAttackMovement(new Set(["KeyD", "KeyA"])), { moveX: 0, moveY: 0 });
  assert.deepEqual(captureLightAttackMovement(new Set(["KeyW", "KeyD"])), { moveX: 1, moveY: -1 });
  assert.deepEqual(captureLightAttackMovement(new Set()), { moveX: 0, moveY: 0 });
});

test("practice and online freeze only genuine light-commit movement then discard after input", () => {
  const offline = readFileSync(new URL("../web/game.mjs", import.meta.url), "utf8");
  const online = readFileSync(new URL("../web/online-game.mjs", import.meta.url), "utf8");
  assert.match(offline, /onLight\(\) \{[\s\S]{0,140}committedLightMove = captureLightAttackMovement\(keys\)/);
  assert.match(online, /onLight\(\) \{[\s\S]{0,170}committedLightMove = resolveLightAttackReleaseMovement\(/);
  assert.match(online, /captureLightAttackMovement\(keys\), leftButtonPressMovement/);
  assert.match(online, /leftButtonPressMovement = captureLightAttackMovement\(keys\)/);
  for (const content of [offline, online]) {
    assert.match(content, /committedLightMove\?\.moveX|attackRequested && committedLightMove/);
    assert.match(content, /committedLightMove = null;/);
    assert.match(content, /leftButtonCharge\.cancel\(\);/);
  }
  // Live combat must never schedule expensive AudioContext creation inside
  // either the original source0 input sender or its terminal clear sequence.
  const originalSend = "networkClient.sendInput({ tick: outgoingTick, ...currentInput });";
  const sendAt = online.indexOf(originalSend);
  assert.ok(sendAt >= 0, "original source0 writer must submit the input");
  const clearAt = online.indexOf("committedLightMove = null;", sendAt + originalSend.length);
  assert.ok(clearAt > sendAt, "committed movement clears only after original input submission");
  const betweenSendAndClear = online.slice(sendAt + originalSend.length, clearAt);
  assert.doesNotMatch(betweenSendAndClear, /audio\.unlock\(\)|afterSource0Audio/,
    "no audio startup during the original send-to-clear sequence");
  assert.doesNotMatch(online, /afterSource0Audio/,
    "combat inputs must not schedule first-use AudioContext creation");
});

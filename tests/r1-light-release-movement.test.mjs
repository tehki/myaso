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
  for (const content of [offline, online]) {
    assert.match(content, /onLight\(\) \{[\s\S]{0,140}committedLightMove = captureLightAttackMovement\(keys\)/);
    assert.match(content, /committedLightMove\?\.moveX|attackRequested && committedLightMove/);
    assert.match(content, /committedLightMove = null;/);
    assert.match(content, /leftButtonCharge\.cancel\(\);/);
  }
  assert.match(online, /networkClient\.sendInput\(\{ tick: outgoingTick, \.\.\.currentInput \}\);[\s\S]{0,130}committedLightMove = null;/);
});

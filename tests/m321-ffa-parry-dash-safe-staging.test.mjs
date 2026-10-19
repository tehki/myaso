import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createDirectionalDash, DASH_DOUBLE_TAP_MS } from "../src/browser/dash-input.mjs";

const runner = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
const begin = runner.indexOf("async function runOnlineUiParryPunishFfaFocusFlight(");
const end = runner.indexOf("async function runOnlineUiParryPunishWindowFlight(", begin);
const flight = runner.slice(begin, end);

test("M321 both M147/M150 corrective W3C W loops avoid accidental R2 dash", () => {
  assert.ok(begin >= 0 && end > begin, "real FFA test remains");
  assert.equal(DASH_DOUBLE_TAP_MS, 240);
  const pulse = 'await pulseMovementKey(closerIdle, "w", 30);';
  const starts = [
    "for (let attempt = 0; attempt < 4 && defenderBefore?.focusLabel",
    "for (let attempt = 0; attempt < 3 && stagedDefender?.focusLabel",
  ];
  assert.equal(flight.split(pulse).length - 1, 2, "both genuine staging loops preserved");
  for (const start of starts) {
    const pos = flight.indexOf(start);
    const next = flight.indexOf(pulse, pos);
    assert.ok(pos >= 0 && next > pos, "genuine 30ms W movement remains");
    const between = flight.slice(pos, next);
    assert.ok(between.includes("await sleep(300);"), "300ms ahead of each W tap");
  }
  assert.ok(flight.includes("if (stagedDefender?.focusLabel !== "));
  assert.ok(flight.includes("if (defenderBefore?.focusLabel !== "));
  assert.ok(flight.includes("currentCloser.playerHp < 100"));
  assert.ok(flight.includes("currentAttacker?.playerHp === 66"));
  assert.ok(!flight.includes("dispatchEvent("));
});

test("M321 101ms physical W double-tap requests dash, spaced W taps do not", () => {
  const quick = createDirectionalDash();
  assert.equal(quick.press("KeyW", 100), null);
  assert.deepEqual(quick.press("KeyW", 201), { x: 0, y: -1 });
  const staged = createDirectionalDash();
  assert.equal(staged.press("KeyW", 100), null);
  assert.equal(staged.press("KeyW", 430), null);
  assert.equal(staged.press("KeyW", 760), null);
});

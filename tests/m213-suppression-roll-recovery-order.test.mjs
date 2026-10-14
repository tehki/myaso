import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const runner = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
const body = runner.slice(
  runner.indexOf("async function runOnlineUiBoundedRollKnockdownFlight("),
  runner.indexOf("async function runOnlineUiBoundedRollKnockdownFlight(") + 22000,
);
test("M213 orders real suppression roll after opener dodge recovery without weakening proof", () => {
  assert.ok(body.includes("scrollArenaWheel(opener, openerElementId, -120, 0)"));
  assert.ok(body.includes("scrollArenaWheel(suppressor, suppressorElementId, -120, 215)"));
  assert.ok(!body.includes("scrollArenaWheel(suppressor, suppressorElementId, -120, 185)"));
  assert.ok(body.includes("COMBAT.dodge.collisionKnockdownMs"));
  assert.ok(body.includes("COMBAT_ACTION.dodgeRecovery"));
  assert.ok(body.includes("openerDodgeRecovery"));
  assert.ok(body.includes("suppressedDodge"));
  assert.ok(body.includes("suppressorDodgeRecovery"));
  assert.ok(body.includes("originalRecovery"));
  assert.ok(body.includes("suppressedDodge.serverTick < openerDodgeRecovery.serverTick"));
  assert.ok(body.includes("originalRecovery.epochMs >= suppressorDodgeRecovery.epochMs"));
  assert.ok(body.includes("did not observe suppression roll plus original recovery"));
});

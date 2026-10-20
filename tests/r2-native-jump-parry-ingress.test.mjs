import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
const begin = source.indexOf("async function runOnlineUiJumpAttackCounterplayFlight(");
const end = source.indexOf("\nasync function ", begin + 45);
const flight = source.slice(begin, end);
const helper = source.slice(
  source.indexOf("async function calibrateNativeParryIngress("),
  source.indexOf("\nasync function runOnlineUiParryFlight("),
);
test("M138 calibrates genuine Firefox chord and Chrome wheel ingress before the actual jump strike", () => {
  assert.ok(begin >= 0 && end > begin);
  assert.match(flight, /defense === "parry"/);
  assert.match(flight, /calibrateNativeParryIngress\([\s\S]*?attackOffset, 25,/);
  assert.match(flight, /if \(jumpParryIngress\) await Promise\.all\(entries\.map\(installUiObserver\)\)/);
  assert.match(flight, /jumpParryIngress\.attackLeadMs/);
  assert.match(flight, /jumpParryIngress\.wheelLeadMs/);
  assert.match(flight, /pressArenaJumpAttackChord\(attacker, attackerElementId, attackOffset\)/);
  assert.match(flight, /scrollArenaWheel\(defender, defenderElementId, 120, 0\)/);
  assert.ok(!flight.includes("scrollArenaWheel(defender, defenderElementId, 120, 70)"));
  assert.match(flight, /attackerResult\.playerHp < 100 \|\| defenderResult\.playerHp < 100/);
  assert.match(flight, /defenderResult\.playerGuard === 100/);
  assert.match(flight, /COMBAT_ACTION\.stunned/);
});
test("M138 shared calibration measures trusted events but never fakes combat inputs or widens the parry", () => {
  assert.match(helper, /event\.isTrusted/);
  assert.match(helper, /pointerSamples/);
  assert.match(helper, /wheelSamples/);
  assert.match(helper, /COMBAT\.block\.shortBlockMs \+ 130/);
  assert.match(helper, /targetAfterPointerDownMs/);
  assert.match(helper, /targetAfterPointerDownMs = 50/);
  assert.match(helper, /targetAfterPointerDownMs > 85/);
  assert.match(helper, /Math\.max\(0, -skewMs\)/);
  assert.match(helper, /Math\.max\(0, skewMs\)/);
  assert.ok(!helper.includes("dispatchEvent("));
  assert.ok(!helper.includes("new WheelEvent("));
  assert.ok(!helper.includes("new PointerEvent("));
});

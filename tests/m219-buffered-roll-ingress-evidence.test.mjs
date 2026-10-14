import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { observeM219RollBufferIngress } from "../scripts/m219-buffered-roll-ingress-evidence.mjs";
const sample = () => ({
  sameBrowserClock: true,
  wheel: { deltaY: -120, epochMs: 1180 },
  recovery: { epochMs: 1000, serverTick: 100 },
  dodge: { epochMs: 1274, serverTick: 117 },
  recoveryMs: 255, bufferWindowMs: 90,
});
test("M219 records real wheel candidate against same actor observed buffer window", () => {
  const r = observeM219RollBufferIngress(sample());
  assert.equal(r.placement, "within-observed-window");
  assert.equal(r.wheelFromObservedBufferOpenMs, 15);
  assert.equal(r.wheelBeforeNominalRecoveryExitMs, 75);
  assert.equal(r.wheelToObservedDodgeMs, 94);
  assert.equal(r.postRecoveryDodgeMs, 19);
});
test("M219 reports post-recovery real wheel and delay, never calls it buffered proof", () => {
  const s = sample(); s.wheel.epochMs = 1260; s.dodge.epochMs = 1398;
  const r = observeM219RollBufferIngress(s);
  assert.equal(r.placement, "after-observed-recovery");
  assert.equal(r.wheelBeforeNominalRecoveryExitMs, -5);
  assert.equal(r.postRecoveryDodgeMs, 143);
});
test("M219 cross-clock, missing wheel and negative time remain unknown/null", () => {
  const a = sample(); a.sameBrowserClock = false;
  assert.equal(observeM219RollBufferIngress(a).placement, "unknown");
  const b = sample(); b.wheel.deltaY = 120;
  assert.equal(observeM219RollBufferIngress(b).wheelToObservedDodgeMs, null);
  const c = sample(); c.dodge.epochMs = 1100;
  assert.equal(observeM219RollBufferIngress(c).wheelToObservedDodgeMs, null);
});
test("M219 instrumentation is before old unchanged M129 strict deadline and buffer checks", () => {
  const src = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
  const part = src.slice(src.indexOf("async function runOnlineUiRollBufferFlight("), src.indexOf("async function runOnlineUiJumpBufferFlight("));
  const log = part.indexOf('console.log("M219_BUFFERED_ROLL_INGRESS "');
  const bound = part.indexOf("recoveryToDodgeDelayMs > 140");
  const window = part.indexOf("rollWheel.epochMs < bufferOpenEpochMs");
  assert.ok(log > part.indexOf("const recoveryToDodgeDelayMs ="));
  assert.ok(log < bound && bound < window);
  assert.ok(part.includes("sameBrowserClock: true"));
  assert.ok(part.includes("wheel: rollWheel"));
  assert.ok(part.includes("rollWheels.length !== 1"));
});

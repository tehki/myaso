import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source=readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs",import.meta.url),"utf8");
const start=source.indexOf("async function calibrateNativeParryIngress(");
const end=source.indexOf("async function runOnlineUiParryFlight(",start);
const calibration=source.slice(start,end);

test("M334 samples trusted pointerdown on HUD instead of attack-triggering arena", () => {
  assert.ok(start>=0&&end>start);
  assert.match(calibration,/value: "#event-text"/);
  assert.match(calibration,/measure\(attacker, "pointerdown"/);
  assert.match(calibration,/event\.isTrusted/);
  assert.match(calibration,/\{ type: "pointerDown", button: 0 \}/);
  assert.match(calibration,/\{ type: "pointerUp", button: 0 \}/);
  assert.match(calibration,/target === "pointerdown"|eventKind === "pointerdown"/);
  assert.ok(!calibration.includes("dispatchEvent("));
  assert.ok(!calibration.includes("new PointerEvent("));
});

test("M334 retains strict timing limits, genuine wheel and fail-closed outcomes", () => {
  assert.match(calibration,/targetAfterPointerDownMs = 50/);
  assert.match(calibration,/targetAfterPointerDownMs > 85/);
  assert.match(calibration,/COMBAT\.block\.shortBlockMs \+ 130/);
  assert.match(calibration,/scrollArenaWheel\(defender, defenderElementId, 120, 0\)/);
  assert.match(calibration,/Math\.max\(0, -skewMs\)/);
  assert.match(calibration,/Math\.max\(0, skewMs\)/);
  assert.match(source,/M33 genuine short-click parry resolved unexpectedly/);
  assert.match(source,/M41 remote parry-stun tell never appeared/);
});

test("M334 restores arena focus before real parry and retains strict single wheel", () => {
  const flight=source.slice(end,source.indexOf("async function runOnlineUiParryPunishFfaFocusFlight(",end));
  assert.match(flight,/document\.querySelector\('#arena'\)\.focus\(\)/);
  assert.match(flight,/await Promise\.all\(entries\.map\(installUiObserver\)\)/);
  assert.match(flight,/if \(!pristine\)/);
});

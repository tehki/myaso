import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createDirectionalDash, DASH_DOUBLE_TAP_MS } from "../src/browser/dash-input.mjs";

const flight = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
const start = flight.indexOf("const positionRelativeToAuthoritativeTarget = async (");
const end = flight.indexOf("// Stage from replicated world coordinates", start);
const staging = flight.slice(start, end);

test("M158 real W3C positioning leaves the directional dash gesture window before re-steering", () => {
  assert.ok(start >= 0 && end > start, "M158 positioning helper must exist");
  assert.match(flight, /import \{ DASH_DOUBLE_TAP_MS \} from "\.\.\/src\/browser\/dash-input\.mjs";/);
  assert.match(staging, /await pulseMovementKey\(entry, key, durationMs\);[\s\S]*?await sleep\(DASH_DOUBLE_TAP_MS \+ 20\);/);
  assert.match(staging, /const tolerance = 5;/);
  assert.match(staging, /attempt < 12/);
  assert.doesNotMatch(staging, /dispatchEvent\(|fake|synthetic/i);
});

test("M158 previous 70ms pause allowed an unplanned dash; new W3C spacing cannot trigger it", () => {
  assert.equal(DASH_DOUBLE_TAP_MS, 240);
  const previous = createDirectionalDash();
  assert.equal(previous.press("KeyD", 1000), null);
  assert.deepEqual(previous.press("KeyD", 1000 + 35 + 70), { x: 1, y: 0 });

  const corrected = createDirectionalDash();
  assert.equal(corrected.press("KeyD", 1000), null);
  assert.equal(corrected.press("KeyD", 1000 + 35 + DASH_DOUBLE_TAP_MS + 20), null);
  assert.equal(corrected.press("KeyD", 1000 + 2 * (35 + DASH_DOUBLE_TAP_MS + 20)), null);
});

test("M158 preserves genuine three-fighter knockdown and fail-closed combat assertions", () => {
  const section = flight.slice(flight.indexOf("async function runOnlineUiMultiKnockdownFfaFlight("), flight.indexOf("async function", flight.indexOf("async function runOnlineUiMultiKnockdownFfaFlight(") + 14));
  assert.match(section, /await scrollArenaWheel\(roller, rollerElementId, -120, 0\);/);
  assert.match(section, /firstKnockdown\.epochMs >= secondKnockdown\.epochMs/);
  assert.match(section, /rollWheels\.length === 1 && vitalsClean && primaryRendered/);
  assert.match(section, /could not stabilize authoritative three-fighter roll geometry/);
});

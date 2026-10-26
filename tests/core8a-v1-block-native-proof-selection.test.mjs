import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

// Use the real native-runner env mapping, never a synthetic helper substitute.
const source = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
function selected(key, scenario) {
  const start = source.indexOf(key + ":");
  assert.ok(start > 0, key + " exists in native runner");
  const fragment = source.slice(start + key.length + 1, start + key.length + 3200);
  const end = fragment.indexOf('? "1" : "0"');
  assert.ok(end > 0, key + " is a fail-closed flight selector");
  return Boolean(runInNewContext(fragment.slice(0, end), { scenario }));
}

test("M33 and M194 original World probes have authenticated action AND Block admission", () => {
  for (const scenario of [
    "uiparry", "uiparrytell", "uistun",
    "uiguardbreak", "uiheavyguardbreakpunish",
  ]) {
    assert.equal(selected("MYASO_FLIGHT_ACTION_PROOF", scenario), true,
      scenario + " has World log proof");
    assert.equal(selected("MYASO_FLIGHT_M41_INPUT_PROOF", scenario), true,
      scenario + " has original post-ingress accepted v1 Block proof");
  }
});

test("original Block admission telemetry stays disabled for unrelated fixtures", () => {
  for (const scenario of [
    "uidirectionallight", "uijumppunishffa", "uiheavyinputloss", "damage",
  ]) {
    assert.equal(selected("MYASO_FLIGHT_M41_INPUT_PROOF", scenario), false, scenario);
  }
});

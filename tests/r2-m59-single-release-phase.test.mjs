import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
const start = source.indexOf("async function runOnlineUiMultiThreatFlight(");
const end = source.indexOf("async function ", start + 20);
const scenario = source.slice(start, end);
const holdStart = source.indexOf("async function performArenaM221GuardBreakClick(");
const hold = source.slice(holdStart, source.indexOf("async function ", holdStart + 20));

test("M59 uses one real short release per simultaneous attacker, not heavy-producing bursts", () => {
  assert.ok(start > 0 && end > start);
  assert.match(scenario, /if \(requireSecondaryPhase\) \{\s*await Promise\.all\(\[\s*performArenaM221GuardBreakClick\(left, 0\),\s*performArenaM221GuardBreakClick\(right, 0\),\s*\]\);/);
  assert.match(scenario, /\} else \{\s*await Promise\.all\(\[\s*performArenaAttackBurst\(left\),\s*performArenaAttackBurst\(right\),/);
  assert.match(hold, /clickHoldMs > 100/);
  assert.match(hold, /type: "pause", duration: clickHoldMs/);
  assert.doesNotMatch(hold, /type: "pointerMove"/);
  assert.match(hold, /await webdriver\(session\.base, "POST"/);
  assert.match(hold, /\{ type: "pointerDown", button: 0 \}/);
  assert.match(hold, /\{ type: "pointerUp", button: 0 \}/);
  assert.doesNotMatch(hold, /dispatchEvent\(/);
});

test("M59 keeps required normal secondary light WINDUP and STRIKE plus strict phase priority", () => {
  assert.match(scenario, /!secondaryPhases\.has\("WINDUP"\) \|\| !secondaryPhases\.has\("STRIKE"\)/);
  assert.match(scenario, /fighterThreatPhaseState\(event\.secondaryPhase\) !== "windup"/);
  assert.match(scenario, /secondary threat phase leaked to an attacker client/);
  assert.match(scenario, /multi-threat proof lacked two real pointer commits/);
  assert.match(scenario, /sampleUiEvidenceWhileActive\(entries, 240\)/);
});

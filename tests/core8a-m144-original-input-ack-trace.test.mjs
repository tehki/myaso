// Source-level policy checks for the read-only original M144 input-plane trace.
// Real W3C send/ACK/World proof still requires strict native protected CI.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const browser=readFileSync(new URL("../web/online-game.mjs",import.meta.url),"utf8");
const runner=readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs",import.meta.url),"utf8");

test("M144 and prior M145 observe genuine 30Hz submitted samples without changing sender",()=>{
  assert.match(browser,/acceptanceScenario === "uimultirecoveryspatial" \|\| acceptanceScenario === "uimultirecoveryffa"/);
  assert.match(browser,/acceptanceScenario === "uimultirecoveryffa" \|\| currentInput\.attack \|\| currentInput\.jump \|\| currentInput\.heavyAttack/);
  assert.match(browser,/networkClient\.sendInput\(\{ tick: outgoingTick, \.\.\.currentInput \}\);/);
  assert.equal((browser.match(/networkClient\.sendInput\(\{ tick: outgoingTick, \.\.\.currentInput \}\);/g)??[]).length,1);
});

test("M144 sender telemetry includes idle samples and enforces prior 32-record ceiling",()=>{
  assert.match(browser,/debug\.lastSubmittedClientTick = outgoingTick;/);
  assert.match(browser,/debug\.lastSubmittedAtEpochMs = Date\.now\(\);/);
  assert.match(browser,/inputSubmissions\.length > 32/);
  assert.match(browser,/if \(acceptanceScenario === "uimultirecoveryffa" \|\| currentInput\.attack/);
});

test("M144 authentic input ACK observation remains read-only, bounded and actor-owned",()=>{
  assert.match(browser,/onAck\(ack\) \{\s*\/\/ M144 only:/);
  assert.match(browser,/debug\.inputAckReceipts\s*\?\?= \[\];/);
  assert.match(browser,/processedClientTick: networkClient\?\.processedClientTick \?\? null/);
  assert.match(browser,/serverTick: networkClient\?\.latestServerTick \?\? null/);
  assert.match(browser,/inputAckReceipts\.length > 32/);
  assert.match(browser,/const ownId = networkClient\?\.playerNetId;/);
});

test("original native M144 scenario and its strict focus verdict remain intact",()=>{
  assert.match(runner,/M144 simultaneous recovery FFA focus/);
  assert.match(runner,/const expectedScenario = spatial \? "uimultirecoveryspatial" : "uimultirecoveryffa";/);
  assert.match(runner,/inputSubmissions: \(window\.__MYASO_ACCEPTANCE_STATE__\.inputSubmissions \?\? \[\]\)\.slice\(-32\)/);
  assert.match(runner,/inputAckReceipts: \(window\.__MYASO_ACCEPTANCE_STATE__\.inputAckReceipts \?\? \[\]\)\.slice\(-32\)/);
  assert.match(runner,/did not arbitrate nearest punishable -> remaining punishable -> nearest rival/);
});

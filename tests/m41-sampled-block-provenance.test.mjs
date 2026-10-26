import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
// RED on the pre-fix SHA: M41's actual v1 block submission was not recorded.
// World PARRY/HIT is still checked independently by native Rust/Chrome/Firefox.
const online = readFileSync(new URL("../web/online-game.mjs", import.meta.url), "utf8");
const i = online.indexOf("function simulatePrediction(");
const sender = online.slice(i, i + 5300);
test("M41/M35 prove genuine short-block intent at original v1 sender, without changing it", () => {
  assert.ok(i >= 0);
  const acceptanceGate = online.slice(online.indexOf("function recordAcceptanceState("), online.indexOf("function recordAcceptanceAction("));
  assert.ok(acceptanceGate.includes('"uiparrytell"') && acceptanceGate.includes('"uistun"'),
    "M41/M35 must initialize the real acceptance state, not silently return null");
  assert.match(sender, /const m41InputProbe = acceptanceScenario === "uiparrytell"\s+\|\| acceptanceScenario === "uistun"/);
  assert.match(sender, /\|\| \(m41InputProbe && currentInput\.block\)/);
  assert.match(sender, /clientTick: outgoingTick, epochMs: debug\.lastSubmittedAtEpochMs/);
  assert.match(sender, /block: Boolean\(currentInput\.block\)/);
  assert.match(sender, /if \(debug\.inputSubmissions\.length > 32\) debug\.inputSubmissions\.shift\(\)/);
  assert.ok(sender.indexOf("block: Boolean(currentInput.block)") < sender.indexOf("networkClient.sendInput("),
    "diagnostic must run before sole unmodified source0 v1 sender");
  assert.match(online, /shortBlockUntil = Math\.max\(shortBlockUntil, performance\.now\(\) \+ COMBAT\.block\.shortBlockMs\)/);
  assert.match(online, /currentInput\.block = middleBlockHeld \|\| performance\.now\(\) < shortBlockUntil/);
});

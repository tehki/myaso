import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("M237 real M156 light releases in 5ms after authentic victim knockdown", () => {
  const src = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
  const a = src.indexOf("async function runOnlineUiRollKnockdownFfaHitFlight(");
  const b = src.indexOf("\nasync function ", a + 30);
  assert.ok(a > 0 && b > a);
  const s = src.slice(a,b);
  const watcher = s.indexOf("const knockdownTransition = await knockdownWatcher");
  const input = s.indexOf("await performArenaM221GuardBreakClick(punisher, 5)");
  const wheelAck = s.indexOf("const rollResult = await rollCompletion", input);
  assert.ok(watcher >= 0 && input > watcher && wheelAck > input);
  assert.ok(!s.includes("performArenaM221GuardBreakClick(punisher, 35)"));
  assert.ok(s.includes("punishDowns.length !== 1 || punishUps.length !== 1"));
  assert.ok(s.includes("punishUp.epochMs <= punishDown.epochMs"));
  assert.ok(s.includes("punishUp.epochMs - punishDown.epochMs >= 320"));
  assert.ok(s.includes("punishDown.epochMs < conversion.knockdownTransition.epochMs"));
  assert.ok(s.includes("punishActive.epochMs >= knockdownEndEpochMs || !attackPrecedesRecovery"));
  assert.ok(s.includes("verifiedSameTickHit"));
  assert.ok(s.includes('defenderState.events.includes("Hit taken - 34 HP.")'));
  assert.ok(s.includes("defenderState?.playerHp === 66 && defenderState?.playerGuard === 100"));
  const w3c = src.slice(src.indexOf("async function performArenaM221GuardBreakClick("),
    src.indexOf("\nasync function ", src.indexOf("async function performArenaM221GuardBreakClick(")+30));
  assert.ok(w3c.includes("clickHoldMs < 0 || clickHoldMs > 100"));
  assert.ok(w3c.includes('{ type: "pointerDown", button: 0 }'));
  assert.ok(w3c.includes('{ type: "pause", duration: clickHoldMs }'));
  assert.ok(w3c.includes('{ type: "pointerUp", button: 0 }'));
  assert.ok(!w3c.includes("dispatchEvent("));
});

test("M156 records sampled v1 LMB attack/heavy origin without changing the outgoing command", () => {
  const src = readFileSync(new URL("../web/online-game.mjs", import.meta.url), "utf8");
  const a = src.indexOf("function simulatePrediction(stepMs) {");
  const b = src.indexOf("\nfunction ", a + 30);
  assert.ok(a > 0 && b > a);
  const s = src.slice(a, b);
  assert.ok(s.includes('acceptanceScenario === "uirollknockdownffahit"'));
  assert.ok(s.includes('heavyAttack: Boolean(currentInput.heavyAttack)'));
  assert.ok(s.includes('attack: Boolean(currentInput.attack)'));
  assert.ok(s.includes("leftChargingAtSample: leftButtonCharge.isCharging()"));
  assert.ok(s.includes("pendingLightReleaseAtSample: Boolean(attackRequested)"));
  assert.ok(s.includes("pendingHeavyReleaseAtSample: Boolean(heavyAttackRequested)"));
  assert.ok(s.includes("lmbPointerHeldAtSample: Boolean(leftButtonDown)"));
  assert.ok(s.includes("debug.inputSubmissions.length > 32"));
  const telemetry = s.slice(s.indexOf('if (acceptanceScenario === "uimultirecoveryspatial"'));
  const within = telemetry.slice(0, telemetry.indexOf("if (m111InputProbe)"));
  assert.doesNotMatch(within, /currentInput\.[A-Za-z]+\s*=/);
});

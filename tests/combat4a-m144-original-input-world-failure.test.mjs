import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("M144 original input trace is read-only, bounded and before unchanged v1 sendInput", () => {
  const web = readFileSync(new URL("../web/online-game.mjs", import.meta.url), "utf8");
  const a = web.indexOf("function simulatePrediction(stepMs) {");
  const b = web.indexOf("\nfunction predictMovement(", a);
  assert.ok(a >= 0 && b > a);
  const sender = web.slice(a, b);
  const start = sender.indexOf('if ((acceptanceScenario === "uimultirecoveryffa"');
  const stop = sender.indexOf("    // M336:", start);
  const probe = sender.slice(start, stop);
  assert.ok(start >= 0 && stop > start);
  for (const proof of [
    'acceptanceScenario === "uimultirecoveryspatial"',
    'debug.m144SentSamples.push({',
    'attack: Boolean(currentInput.attack)',
    'jump: Boolean(currentInput.jump)',
    'heavyAttack: Boolean(currentInput.heavyAttack)',
    'keySpace: keys.has("Space")',
    'debug.m144SentSamples.length > 96',
  ]) assert.ok(probe.includes(proof), "missing " + proof);
  assert.doesNotMatch(probe, /(?:sendInput|dispatchEvent|setTimeout|setInput)\s*\(/);
  assert.doesNotMatch(probe, /currentInput\.[\w]+\s*=(?!=)/);
  assert.ok(sender.indexOf("networkClient.sendInput({ tick: outgoingTick, ...currentInput });", stop) > stop);
});

test("M144 genuine native flight logs sampled and World state before original fail-closed focus", () => {
  const script = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
  const start = script.indexOf("async function runOnlineUiMultiRecoveryFfaFocusFlight(");
  const end = script.indexOf("\nasync function ", start + 40);
  assert.ok(start >= 0 && end > start);
  const fragment = script.slice(start, end);
  const printed = fragment.indexOf("M144_4A_ORIGINAL_INPUT_WORLD_BEFORE_STRICT_FOCUS");
  const strict = fragment.indexOf("const focusTransitions = observerState.focusTransitions.slice(observerFocusOffset);");
  assert.ok(printed > 0 && strict > printed);
  assert.ok(fragment.includes("m144SentSamples ?? []"));
  assert.ok(fragment.includes('line.startsWith("M201_AUTH_ACTION ")'));
  assert.ok(script.includes("m144SentSamples: (window.__MYASO_ACCEPTANCE_STATE__.m144SentSamples ?? [])"));
  const after = fragment.slice(strict);
  assert.match(after, /PUNISH TARGET/);
  assert.match(after, /throw new Error\(\x60\$\{milestone\}/);
});

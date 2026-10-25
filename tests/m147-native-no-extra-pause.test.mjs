import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Combat4B/4D source contract: M147 MUST use genuine pre-aimed W3C
// DOWN/UP with no extra pause. Never fake the recovery/HIT or loosen the
// unchanged original Rust 60Hz World proof to obtain a green test.
const flight = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
const start = flight.indexOf("async function runOnlineUiJumpRecoveryFfaPunishFlight(");
const end = flight.indexOf("async function runOnlineUiMultiRecoveryFfaFocusFlight(", start);
const m147 = flight.slice(start, end);
test("M147 genuine recovery cue precedes one pause-free W3C LMB and strict World proof", () => {
  assert.ok(start >= 0 && end > start, "M147 genuine native function must exist");
  const observer = m147.indexOf("`/session/${observer.sessionId}/execute/async`");
  const cue = m147.indexOf("isM147RenderedRecoveryCue(recoveryCue, jumpId)");
  const click = m147.indexOf("await performArenaM221GuardBreakClick(observer, 0)");
  const strict = m147.indexOf("verifyM147WorldRecoveryProof(");
  assert.ok(observer >= 0 && cue > observer && click > cue && strict > click,
    "observe the genuine rendered cue, send one real W3C click, then enforce original World proof");
  assert.ok(!m147.includes("performArenaM221GuardBreakClick(observer, 5)"));
  const criticalPoll = m147.slice(observer, click);
  assert.ok(!criticalPoll.includes("await sleep("), "do not delay native W3C action after recovery observation");
  assert.match(criticalPoll, /state\.recoveryTransitions \?\? \[\]/);
  assert.match(criticalPoll, /!recovery\.hidden/);
  assert.match(criticalPoll, /focus === 'PUNISH TARGET #' \+ victimId/);
  assert.match(criticalPoll, /row\.label === 'PUNISH'/);
  assert.match(criticalPoll, /const pristine =/);
  assert.match(criticalPoll, /setInterval\(check, 4\)/);
  assert.match(flight, /async function performArenaM221GuardBreakClick\(session, clickHoldMs = 10\)/);
  assert.match(flight, /\{ type: "pointerDown", button: 0 \}/);
  assert.match(flight, /\{ type: "pointerUp", button: 0 \}/);
  assert.match(m147, /punishDown\.epochMs < recovery\.epochMs/);
  assert.match(m147, /punishDown\.epochMs < recoveryCue\.epochMs/);
  assert.match(m147, /jumpState\.playerHp !== 66/);
});

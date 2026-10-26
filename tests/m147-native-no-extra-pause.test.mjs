import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { createDirectionalDash, DASH_DOUBLE_TAP_MS } from "../src/browser/dash-input.mjs";
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

test("M147 zero-hold physical W3C click omits the driver pause tick while ordinary holds remain identical", async () => {
  const begin = flight.indexOf("async function performArenaM221GuardBreakClick(");
  const end = flight.indexOf("async function setArenaAttackButton(", begin);
  assert.ok(begin >= 0 && end > begin, "use the actual original native click helper");
  const calls = [];
  const webdriver = async (...args) => { calls.push(args); };
  const click = vm.runInNewContext(
    flight.slice(begin, end) + "\nperformArenaM221GuardBreakClick;",
    { webdriver },
  );
  const session = { base: "http://localhost:9515", sessionId: "native", name: "firefox" };
  await click(session, 0);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][1], "POST");
  assert.equal(calls[0][2], "/session/native/actions");
  const actualZero = JSON.parse(JSON.stringify(calls[0][3].actions));
  assert.deepEqual(actualZero, [{
    type: "pointer", id: "mouse-firefox", parameters: { pointerType: "mouse" },
    actions: [
      { type: "pointerDown", button: 0 },
      { type: "pointerUp", button: 0 },
    ],
  }], "no synthetic event, zero-ms W3C pause tick, second pointer or changed order");
  await click(session, 10);
  const ordinary = JSON.parse(JSON.stringify(calls[1][3].actions[0].actions));
  assert.deepEqual(ordinary, [
    { type: "pointerDown", button: 0 },
    { type: "pause", duration: 10 },
    { type: "pointerUp", button: 0 },
  ], "normal M221 physical hold remains unchanged");
  await assert.rejects(click(session, -1), { name: "TypeError" });
});

test("M147 correction KeyA pulses cannot accidentally trigger genuine 240ms R2 Dash", () => {
  const stage = m147.slice(m147.indexOf("await Promise.all(["),
    m147.indexOf("const jumpBefore = baseline.find("));
  assert.match(stage, /pulseMovementKey\(closerIdle, "a", 260\)/,
    "original initial KeyA staging remains real");
  assert.match(stage,
    /for \(let attempt = 0; attempt < 3[^\n]*\{[\s\S]*?await sleep\(300\);\s*await pulseMovementKey\(closerIdle, "a", 45\);/,
    "each genuine corrective KeyA tap is separated from the prior KeyA by at least 300ms");
  assert.equal(DASH_DOUBLE_TAP_MS, 240, "original R2 dash interval remains unchanged");
  const accidental = createDirectionalDash();
  assert.equal(accidental.press("KeyA", 100), null);
  assert.deepEqual(accidental.press("KeyA", 200), { x: -1, y: 0 },
    "the historical 100ms correction spacing is an authentic native Dash");
  const corrected = createDirectionalDash();
  assert.equal(corrected.press("KeyA", 100), null);
  assert.equal(corrected.press("KeyA", 445), null);
  assert.equal(corrected.press("KeyA", 790), null);
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");

test("M147 uses its already aimed pointer for the first native chord tick", async () => {
  const start = source.indexOf("async function runOnlineUiJumpRecoveryFfaPunishFlight(");
  const end = source.indexOf("\nasync function ", start + 30);
  const flight = source.slice(start, end);
  const aim = flight.indexOf("await aimArena(jumpAttacker, jumpArena, -200)");
  const chord = flight.indexOf("performArenaPreAimedJumpAttackChord(jumpAttacker, 90)");
  assert.ok(aim > 0 && chord > aim);
  assert.doesNotMatch(flight, /performArenaJumpAttackChord\(/);
  assert.match(flight, /Math\.abs\(spaceDowns\[0\]\.epochMs - jumpDowns\[0\]\.epochMs\) > 60/);
  assert.match(flight, /verifyM147WorldRecoveryProof\(/);

  const helperStart = source.indexOf("async function performArenaPreAimedJumpAttackChord(");
  const helperEnd = source.indexOf("\nasync function ", helperStart + 30);
  const calls = [];
  const chordInput = vm.runInNewContext(source.slice(helperStart, helperEnd)
    + "\nperformArenaPreAimedJumpAttackChord;", {
    webdriver: async (...args) => calls.push(args),
  });
  await chordInput({ name: "chrome", base: "http://localhost:9515", sessionId: "native" }, 90);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][2], "/session/native/actions");
  const actions = JSON.parse(JSON.stringify(calls[0][3].actions));
  assert.deepEqual(actions.map(row => row.type), ["pointer", "key"]);
  assert.deepEqual(actions[0].actions, [
    { type: "pointerDown", button: 0 },
    { type: "pause", duration: 90 },
    { type: "pointerUp", button: 0 },
  ]);
  assert.deepEqual(actions[1].actions, [
    { type: "keyDown", value: " " },
    { type: "pause", duration: 90 },
    { type: "keyUp", value: " " },
  ]);
});

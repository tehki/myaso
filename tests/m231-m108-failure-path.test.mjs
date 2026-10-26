import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  diagnoseM231M108Failure,
  withM231M108FailureEvidence,
} from "../scripts/m231-m108-failure-path.mjs";

const drop = "M63_INPUT_ACTION_PACKET_DROPPED session=12345 tick=40 packet_tick=40";
const accepted = "M229_LOOPBACK_HEAVY_INPUT_ACCEPTED session=12345 action_tick=40 client_tick=41 packet_tick=41 accepted_samples=2";
const logs = (...lines) => lines.join("\n") + "\n";

test("M231 preserves distinction between unobserved, dropped and accepted evidence", () => {
  assert.equal(diagnoseM231M108Failure("").classification, "no-drop-or-acceptance-observed");
  const missing = diagnoseM231M108Failure(logs(drop));
  assert.equal(missing.classification, "first-drop-without-observed-heavy-acceptance");
  assert.equal(missing.droppedSession, "12345");
  assert.equal(missing.droppedActionTick, "40");
  assert.equal(missing.acceptedHeavyInputs, 0);
  assert.equal(diagnoseM231M108Failure(logs(accepted)).classification,
    "acceptance-without-observed-original-drop");
  const recovered = diagnoseM231M108Failure(logs(drop, accepted));
  assert.equal(recovered.classification, "original-heavy-accepted-but-browser-flight-failed");
  assert.equal(recovered.provenance, "captured-loopback-server-stdout");
  assert.equal(recovered.originalActionTick, 40);
  assert.equal(recovered.replayPacketTick, 41);
});

test("M231 never mislabels mismatched, ambiguous or reversed heavy evidence as recovered", () => {
  const wrongSession = accepted.replace("session=12345", "session=12346");
  const wrongTick = accepted.replace("action_tick=40", "action_tick=42");
  const wrongPacket = accepted.replace("packet_tick=41", "packet_tick=45");
  for (const bad of [wrongSession, wrongTick, wrongPacket]) {
    assert.equal(diagnoseM231M108Failure(logs(drop, bad)).classification,
      "original-drop-and-acceptance-not-correlated");
  }
  assert.equal(diagnoseM231M108Failure(logs(accepted, drop)).classification,
    "original-drop-and-acceptance-not-correlated");
  assert.equal(diagnoseM231M108Failure(logs(drop, drop, accepted)).classification,
    "ambiguous-multiple-server-events");
  assert.equal(diagnoseM231M108Failure(logs(drop, accepted, accepted)).classification,
    "ambiguous-multiple-server-events");
});

test("M231 emits one diagnostic on M108 failure and throws original error unchanged", async () => {
  const originalError = new Error("M106 authoritative attacker HUD remained at 100 HP");
  const messages = [];
  let executions = 0;
  await assert.rejects(
    withM231M108FailureEvidence(
      async () => {
        executions += 1;
        throw originalError;
      },
      () => logs(drop),
      (entry) => messages.push(entry),
    ),
    (error) => error === originalError,
  );
  assert.equal(executions, 1, "no synthetic retries allowed");
  assert.equal(messages.length, 1);
  assert.equal(messages[0].classification, "first-drop-without-observed-heavy-acceptance");
});

test("M231 diagnostic I/O failures cannot hide or replace original real-browser red", async () => {
  const originalError = new Error("real WebDriver M108 failed");
  let reporterCalls = 0;
  await assert.rejects(
    withM231M108FailureEvidence(
      () => Promise.reject(originalError),
      () => { throw new Error("server output unavailable"); },
      (entry) => {
        reporterCalls += 1;
        assert.equal(entry.classification, "server-diagnostic-unavailable");
        throw new Error("stderr unavailable");
      },
    ),
    (error) => error === originalError,
  );
  assert.equal(reporterCalls, 1);
});

test("M231 does not emit failure provenance or alter an accepted strict successful flight", async () => {
  const evidence = [{ browser: "chrome", playerHp: 100, opponentHp: 54 }];
  let reads = 0, writes = 0, flights = 0;
  const result = await withM231M108FailureEvidence(
    async () => { flights += 1; return evidence; },
    () => { reads += 1; return logs(drop, accepted); },
    () => { writes += 1; },
  );
  assert.equal(result, evidence);
  assert.equal(flights, 1);
  assert.equal(reads, 0);
  assert.equal(writes, 0);
});

test("M231 only wraps genuine M108 and preserves pre-existing M229/M230 strict checks", () => {
  const runner = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
  const m108 = runner.slice(runner.indexOf('} else if (scenario === "uiheavyinputloss") {'),
    runner.indexOf('} else if (scenario === "uiheavyblock") {'));
  assert.ok(m108.includes("await withM231M108FailureEvidence("));
  assert.ok(m108.includes("await runOnlineUiHeavyStrikeFlight(sessions)"));
  assert.ok(m108.includes("M231_M108_FAILURE_PATH_EVIDENCE"));
  assert.ok(m108.includes("correlateM230HeavyReplayEvidence(game.output())"));
  assert.ok(m108.includes("M108_HEAVY_INPUT_LOSS_RECOVERY"));
  assert.ok(m108.indexOf("await withM231M108FailureEvidence")
    < m108.indexOf("correlateM230HeavyReplayEvidence"));
  const original = runner.slice(runner.indexOf("async function runOnlineUiHeavyStrikeFlight(entries)"),
    runner.indexOf("async function prepareHeavyCounterplayFlight("));
  assert.ok(original.includes("attackerResult.opponentHp !== 54"));
  assert.ok(original.includes("defenderResult.playerHp !== 54"));
  assert.ok(original.includes('performM110NativeHeldLmb(attacker, attackerElementId, attackOffset)'));
  assert.ok(original.includes('requireM188NativeHeldLmb(attackerResult.pointers, attackRight, "M106")'));
  assert.ok(original.includes('retired E cannot produce heavy Combat'));
  assert.ok(!original.includes('pulseMovementKey(attacker, "e"'));
  assert.ok(original.includes("Opponent hit - 46 HP."));
});

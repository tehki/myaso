import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Core8A multi-packet native gap is bounded, loopback-only and same-tick strict", () => {
  const server = readFileSync(new URL("../server/src/main.rs", import.meta.url), "utf8");
  const runner = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
  const workflow = readFileSync(new URL("../.github/workflows/core8a-two-packet-gap-native.yml", import.meta.url), "utf8");

  assert.ok(server.includes("MYASO_FLIGHT_DROP_FOLLOWING_INPUT_DATAGRAMS"));
  assert.ok(server.includes("if drop_following_input_datagrams > 2"), "fixture must stay bounded to two following datagrams");
  assert.ok(server.includes("drop_following_input_datagrams > 0 && !drop_new_action_datagrams"),
    "the gap fixture cannot run without the first-action drop");
  assert.ok(server.includes("|| drop_following_input_datagrams > 0)\n        && !bind.ip().is_loopback()"),
    "network impairment must remain loopback-only");
  assert.ok(server.includes("CORE8A_FOLLOWING_INPUT_DATAGRAM_DROPPED"));

  assert.ok(runner.includes('"uiheavyinputlossgap"'), "native runner must expose the opt-in scenario");
  assert.ok(runner.includes('scenario === "uiheavyinputlossgap" ? "1" : "0"'));
  assert.ok(runner.includes("CORE8A_TWO_PACKET_GAP_NATIVE_PASS"));
  assert.ok(runner.includes("recovered[2] !== firstDrop[2]"), "recovery must match the original action tick");
  assert.ok(runner.includes("followupDrops.length !== 1"), "the following datagram must be observed dropped");

  assert.ok(workflow.includes("MYASO_PVP_SCENARIO: uiheavyinputlossgap"));
  assert.ok(workflow.includes("trial: [1, 2]"), "run two genuine native trials");
  assert.ok(workflow.includes("timeout --signal=TERM --kill-after=5s 180s node scripts/pvp_browser_flight_runner.mjs"));
});

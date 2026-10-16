import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { NETWORK } from "../src/network/constants.mjs";
import { encodeInputPacket, decodeInputPacket } from "../src/network/input-codec.mjs";

const ACTION_TICK = 700;

// Wire-contract probe, not a substitute for real W3C Chrome/Firefox combat.
// Every packet is encoded by the game's production JS protocol codec.
const encodedHeavyFlight = () => Array.from({ length: 4 }, (_, sequence) => {
  const tick = ACTION_TICK + sequence;
  const samples = Array.from({ length: NETWORK.inputRedundancy }, (_, age) => {
    const sampleTick = tick - age;
    return { tick: sampleTick, facing: 0.25, heavyAttack: sampleTick === ACTION_TICK };
  });
  return decodeInputPacket(encodeInputPacket({
    sequence,
    clientTick: tick,
    samples,
  }));
});

test("M229 three genuine codec samples retain one heavy edge through two packet drops", () => {
  assert.equal(NETWORK.inputRedundancy, 3, "changing redundancy requires revisiting the loss contract");
  const flight = encodedHeavyFlight();
  assert.deepEqual(flight.map(packet => packet.clientTick), [700, 701, 702, 703]);
  for (const packet of flight) {
    assert.deepEqual(packet.samples.map(s => s.tick), [
      packet.clientTick, packet.clientTick - 1, packet.clientTick - 2,
    ]);
  }
  assert.deepEqual(
    flight.map(packet => packet.samples.some(s => s.heavyAttack && s.tick === ACTION_TICK)),
    [true, true, true, false],
  );
  for (const packetsLost of [1, 2, 3]) {
    const received = flight.slice(packetsLost);
    const recovered = received.flatMap(packet => packet.samples)
      .some(s => s.tick === ACTION_TICK && s.heavyAttack);
    assert.equal(recovered, packetsLost < 3,
      "the test must expose, not conceal, exhaustion after all three copies are lost");
  }
});

test("M229 M108 requires both the original real 46HP proof and server-accepted ingress", () => {
  const runner = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
  const m108 = runner.slice(runner.indexOf('} else if (scenario === "uiheavyinputloss") {'),
    runner.indexOf('} else if (scenario === "uiheavyblock") {'));
  assert.ok(m108.includes("await runOnlineUiHeavyStrikeFlight(sessions)"));
  assert.ok(m108.includes("M63_INPUT_ACTION_PACKET_DROPPED"));
  assert.ok(m108.includes("M229_LOOPBACK_HEAVY_INPUT_ACCEPTED"));
  assert.ok(m108.includes("if (acceptedHeavyInputs < 1)"));
  assert.ok(m108.includes("M108_HEAVY_INPUT_LOSS_RECOVERY"));
  assert.ok(m108.indexOf("M229_LOOPBACK_HEAVY_INPUT_ACCEPTED")
    > m108.indexOf("await runOnlineUiHeavyStrikeFlight(sessions)"));

  const server = readFileSync(new URL("../server/src/main.rs", import.meta.url), "utf8");
  assert.ok(server.includes("M229_LOOPBACK_HEAVY_INPUT_ACCEPTED"));
  const portion = server.slice(server.indexOf("let accepted = ingress.ingest(&packet);"),
    server.indexOf("let server_tick = {", server.indexOf("let accepted = ingress.ingest(&packet);")));
  assert.ok(portion.includes("if game.drop_new_action_datagrams"));
  assert.ok(portion.includes("if intent.heavy_attack"));
  assert.ok(portion.includes("coalesce_accepted_input_batch(accepted.as_slice())"));
});

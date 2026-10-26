import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { correlateM230HeavyReplayEvidence } from "../scripts/m230-heavy-replay-correlation.mjs";

const output = ({
  dropSession = "140295844967328", acceptSession = dropSession,
  dropTick = 40, acceptTick = dropTick, droppedPacket = 40, replayPacket = 42,
  coalescedTick = replayPacket, acceptedSamples = 3,
} = {}) => [
  `M63_INPUT_ACTION_PACKET_DROPPED session=${dropSession} tick=${dropTick} packet_tick=${droppedPacket}`,
  `M229_LOOPBACK_HEAVY_INPUT_ACCEPTED session=${acceptSession} action_tick=${acceptTick} client_tick=${coalescedTick} packet_tick=${replayPacket} accepted_samples=${acceptedSamples}`,
].join("\n") + "\n";

test("M230 pairs genuine heavy replay with original one-shot sample and same session", () => {
  const proof = correlateM230HeavyReplayEvidence(output());
  assert.equal(proof.ok, true);
  assert.equal(proof.originalActionTick, 40);
  assert.equal(proof.droppedPacketTick, 40);
  assert.equal(proof.replayPacketTick, 42);
  assert.equal(proof.acceptedSamples, 3);
  assert.equal(proof.droppedActionDatagrams, 1);
  assert.equal(proof.acceptedHeavyInputs, 1);
  assert.equal(proof.session, "140295844967328");
  assert.equal(proof.source, "same-loopback-server-session");
});

test("M230 rejects unrelated session and another heavy edge, despite positive counts", () => {
  assert.throws(() => correlateM230HeavyReplayEvidence(output({ acceptSession: "140295844967329" })),
    /cross-session/);
  assert.throws(() => correlateM230HeavyReplayEvidence(output({ acceptTick: 41 })),
    /differs from dropped original/);
});

test("M230 fails closed for duplicate, missing or misordered original evidence", () => {
  const valid = output();
  assert.throws(() => correlateM230HeavyReplayEvidence(valid + valid),
    /exactly one original drop/);
  assert.throws(() => correlateM230HeavyReplayEvidence(valid.split("\n")[0] + "\n"),
    /exactly one original drop/);
  assert.throws(() => correlateM230HeavyReplayEvidence(valid.split("\n").reverse().join("\n")),
    /accepted before deliberate first drop/);
  assert.throws(() => correlateM230HeavyReplayEvidence(undefined), /actual loopback server output/);
});

test("M230 enforces original three-copy replay window and uint32 bounds", () => {
  assert.throws(() => correlateM230HeavyReplayEvidence(output({ replayPacket: 43 })),
    /outside the exact three-copy/);
  assert.throws(() => correlateM230HeavyReplayEvidence(output({ droppedPacket: 42, replayPacket: 41 })),
    /outside the exact three-copy/);
  assert.throws(() => correlateM230HeavyReplayEvidence(output({ replayPacket: 40 })),
    /outside the exact three-copy/);
  assert.throws(() => correlateM230HeavyReplayEvidence(output({ acceptedSamples: 4 })),
    /invalid accepted redundancy sample count/);
  assert.throws(() => correlateM230HeavyReplayEvidence(output({ coalescedTick: 41 })),
    /outside the exact three-copy/);
  assert.throws(() => correlateM230HeavyReplayEvidence(output({ acceptTick: "4294967296", dropTick: "4294967296" })),
    /invalid dropped action tick/);
  assert.equal(correlateM230HeavyReplayEvidence(output({
    dropTick: 4294967295, acceptTick: 4294967295, droppedPacket: 4294967295,
    replayPacket: 0, coalescedTick: 0,
  })).replayPacketTick, 0, "wraparound is valid");
});

test("M230 remains a read-only post-M108 strict 46HP proof", () => {
  const runner = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
  const m108 = runner.slice(runner.indexOf('} else if (scenario === "uiheavyinputloss") {'),
    runner.indexOf('} else if (scenario === "uiheavyblock") {'));
  assert.ok(m108.includes("await runOnlineUiHeavyStrikeFlight(sessions)"));
  assert.ok(m108.includes("correlateM230HeavyReplayEvidence(game.output())"));
  assert.ok(m108.indexOf("correlateM230HeavyReplayEvidence") > m108.indexOf("await runOnlineUiHeavyStrikeFlight"));
  assert.ok(m108.includes("M230_EXACT_HEAVY_REPLAY_EVIDENCE"));
  const heavy = runner.slice(runner.indexOf("async function runOnlineUiHeavyStrikeFlight(entries)"),
    runner.indexOf("async function prepareHeavyCounterplayFlight("));
  assert.ok(heavy.includes("attackerResult.opponentHp !== 54"));
  assert.ok(heavy.includes("defenderResult.playerHp !== 54"));
  assert.ok(heavy.includes("Opponent hit - 46 HP."));

  const server = readFileSync(new URL("../server/src/main.rs", import.meta.url), "utf8");
  const begin = server.indexOf("let accepted = ingress.ingest(&packet);");
  const section = server.slice(begin, server.indexOf("let server_tick = {", begin));
  assert.ok(section.includes("if game.drop_new_action_datagrams"));
  assert.ok(section.includes("recovered_dropped_heavy_tick("));
  assert.ok(section.includes("accepted.as_slice(), &dropped_action_ticks"));
  const filter = server.slice(server.indexOf("fn recovered_dropped_heavy_tick("),
    server.indexOf("struct LoopbackFlightConfig"));
  assert.ok(filter.includes("sample.heavy_attack && dropped_action_ticks.contains(&sample.tick)"),
    "only the exact dropped input tick may generate M229 replay evidence");
  assert.ok(section.includes("action_tick={action_tick}"));
  assert.ok(section.includes("client_tick={input_tick}"));
});

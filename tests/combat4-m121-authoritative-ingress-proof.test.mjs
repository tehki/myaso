import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("M121 original v1 server receipt trace is loopback gated, World-locked and not gameplay mutation", () => {
  const server = readFileSync(new URL("../server/src/main.rs", import.meta.url), "utf8");
  const native = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
  const source = readFileSync(new URL("../web/online-game.mjs", import.meta.url), "utf8");

  assert.ok(server.includes('env::var("MYASO_FLIGHT_M121_INPUT_PROOF")'));
  assert.ok(server.includes('!bind.ip().is_loopback() || !flight_action_proof || v2_lab'),
    "never allow M121 v1 observation on public binds or experimental v2");
  assert.ok(native.includes('MYASO_FLIGHT_M121_INPUT_PROOF: scenario === "uidirectionallight" ? "1" : "0"'));
  assert.ok(native.includes('MYASO_FLIGHT_ACTION_PROOF: (scenario === "uidirectionallight"'));
  assert.ok(server.includes("let accepted = ingress.ingest(&packet);"));
  assert.ok(server.includes("let m121_coalesced = if prove_m121 {"));
  assert.ok(server.includes("let tick = apply_coalesced_input_and_read_tick("));
  assert.ok(server.includes("state.world.fighter(player_id).map(|fighter|"));
  assert.ok(server.includes("M121_V1_SERVER_INPUT actor={player_id}"));
  assert.ok(native.includes('line.startsWith("M121_V1_SERVER_INPUT ")'));
  assert.ok(native.includes('line.startsWith("M201_AUTH_ACTION ")'));

  const sim = source.slice(source.indexOf("function simulatePrediction(stepMs) {"), source.indexOf("\nfunction predictMovement("));
  assert.ok(sim.includes("m121SentSamples.push"));
  assert.ok(sim.indexOf("m121SentSamples.push") < sim.indexOf("networkClient.sendInput("));
  assert.ok(native.includes('m121SentSamples: (window.__MYASO_ACCEPTANCE_STATE__.m121SentSamples ?? [])'));
});

import { performance } from "node:perf_hooks";
import { NETWORK } from "../src/network/constants.mjs";
import { SpatialInterestGrid } from "../src/network/interest-grid.mjs";
import { planReplication } from "../src/network/replication-planner.mjs";

const playerCount = Number.parseInt(process.argv[2] ?? String(NETWORK.targetPlayersPerMap), 10);
if (!Number.isInteger(playerCount) || playerCount < 1 || playerCount > 4096) {
  throw new RangeError("player count must be an integer in [1, 4096]");
}

const entities = [];
const grid = new SpatialInterestGrid({ cellSize: NETWORK.interest.cellSize });
for (let index = 0; index < playerCount; index += 1) {
  const angle = index * 2.399963229728653;
  const ring = Math.floor(Math.sqrt(index)) * 54;
  const entity = {
    netId: index + 1,
    x: 4096 + Math.cos(angle) * ring,
    y: 4096 + Math.sin(angle) * ring,
    facing: angle,
    hp: 100,
    guard: 100,
    action: index % 17 === 0 ? "attack_windup" : "idle",
    combatHot: index % 17 === 0,
  };
  entities.push(entity);
  grid.upsert(entity);
}

const { buildWireStateMap } = await import("../src/network/snapshot-codec.mjs");
const wireStates = buildWireStateMap(entities);
const baseline = buildWireStateMap(entities.map((entity) => ({ ...entity, x: entity.x - 0.5 })));
const samples = [];
let totalBytes = 0;
let totalSelected = 0;
let totalCandidates = 0;
for (let iteration = 0; iteration < 120; iteration += 1) {
  const viewer = entities[(iteration * 37) % entities.length];
  const query = grid.queryCircle(viewer.x, viewer.y, NETWORK.interest.farRadius);
  const start = performance.now();
  const plan = planReplication({ viewer, candidates: query.entities, baseline, wireStates, serverTick: 600 + iteration * 3 });
  samples.push(performance.now() - start);
  totalBytes += plan.bytes;
  totalSelected += plan.selected.length;
  totalCandidates += query.candidatesChecked;
}

samples.sort((a, b) => a - b);
const percentile = (p) => samples[Math.min(samples.length - 1, Math.floor(samples.length * p))];
console.log(JSON.stringify({
  players: playerCount,
  samples: samples.length,
  planner_ms_p50: Number(percentile(0.50).toFixed(3)),
  planner_ms_p95: Number(percentile(0.95).toFixed(3)),
  planner_ms_p99: Number(percentile(0.99).toFixed(3)),
  avg_packet_bytes: Number((totalBytes / samples.length).toFixed(1)),
  avg_selected_entities: Number((totalSelected / samples.length).toFixed(1)),
  avg_spatial_candidates_checked: Number((totalCandidates / samples.length).toFixed(1)),
  datagram_budget: NETWORK.conservativeDatagramBytes,
}, null, 2));

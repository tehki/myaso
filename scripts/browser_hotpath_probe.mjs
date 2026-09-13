import { performance } from "node:perf_hooks";
import {
  applySnapshotPacketInPlace,
  createSnapshotApplyResult,
} from "../src/browser/snapshot-store.mjs";
import {
  buildEntityDelta,
  encodeSnapshot,
  quantizeEntity,
} from "../src/network/snapshot-codec.mjs";

const entities = Array.from({ length: 64 }, (_, index) => ({
  netId: index + 1,
  x: 100 + index * 7,
  y: 200 + (index % 8) * 9,
  facing: index * 0.07,
  hp: 100,
  guard: 100,
  action: "idle",
}));

const full = encodeSnapshot({
  sequence: 1,
  baselineSequence: 0xffff,
  serverTick: 1,
  full: true,
  records: entities.map((entity) => buildEntityDelta(quantizeEntity(entity))),
});

const state = new Map();
const result = createSnapshotApplyResult();
applySnapshotPacketInPlace(state, full, result);
const stableReferences = new Map([...state].map(([id, entity]) => [id, entity]));
let before = entities.map(quantizeEntity);
let sequence = 2;
const iterations = 2000;
const started = performance.now();

for (let iteration = 0; iteration < iterations; iteration += 1) {
  const next = before.map((entity, index) => ({
    ...entity,
    x: (entity.x + 1 + (index % 3)) & 0xffff,
  }));
  const packet = encodeSnapshot({
    sequence: sequence & 0xffff,
    baselineSequence: (sequence - 1) & 0xffff,
    serverTick: sequence,
    records: next.map((entity, index) => buildEntityDelta(entity, before[index])),
  });
  applySnapshotPacketInPlace(state, packet, result);
  before = next;
  sequence += 1;
}

const elapsedMs = performance.now() - started;
for (const [id, reference] of stableReferences) {
  if (state.get(id) !== reference) throw new Error(`entity ${id} was replaced during hot-path updates`);
}
if (state.size !== entities.length) throw new Error("browser snapshot store lost entities during probe");

console.log(JSON.stringify({
  iterations,
  entities: entities.length,
  totalRecordApplications: iterations * entities.length,
  elapsedMs: Number(elapsedMs.toFixed(3)),
  recordApplicationsPerMs: Number(((iterations * entities.length) / elapsedMs).toFixed(1)),
  replacementEntityObjects: 0,
}));

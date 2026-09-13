import test from "node:test";
import assert from "node:assert/strict";
import { createFrameBudget } from "../src/browser/frame-budget.mjs";
import {
  applySnapshotPacketInPlace,
  createSnapshotApplyResult,
} from "../src/browser/snapshot-store.mjs";
import {
  buildEntityDelta,
  encodeSnapshot,
  quantizeEntity,
} from "../src/network/snapshot-codec.mjs";

function fullRecord(entity) {
  return buildEntityDelta(quantizeEntity(entity));
}

test("browser frame budget bounds catch-up work and drops stale simulation debt", () => {
  const budget = createFrameBudget({ stepMs: 10, maxFrameDeltaMs: 50, maxStepsPerFrame: 3 });
  let stepped = 0;
  assert.deepEqual(budget.advance(100, () => { stepped += 1; }), {
    steps: 0,
    elapsedMs: 0,
    droppedMs: 0,
    alpha: 0,
  });

  const overloaded = budget.advance(200, () => { stepped += 1; });
  assert.equal(overloaded.steps, 3);
  assert.equal(overloaded.elapsedMs, 50);
  assert.equal(overloaded.droppedMs, 20);
  assert.equal(stepped, 3);

  const normal = budget.advance(210, () => { stepped += 1; });
  assert.equal(normal.steps, 1);
  assert.equal(normal.droppedMs, 0);
  assert.equal(stepped, 4);
});

test("browser snapshot store mutates existing entities instead of cloning the map", () => {
  const state = new Map([[99, { netId: 99, x: 1, y: 1 }]]);
  const result = createSnapshotApplyResult();
  const first = encodeSnapshot({
    sequence: 10,
    baselineSequence: 0xffff,
    serverTick: 100,
    full: true,
    records: [
      fullRecord({ netId: 1, x: 100, y: 120, facing: 0.5, hp: 100, guard: 100, action: "idle" }),
      fullRecord({ netId: 2, x: 180, y: 120, facing: 3.1, hp: 100, guard: 100, action: "block" }),
    ],
  });

  const returned = applySnapshotPacketInPlace(state, first, result);
  assert.equal(returned, result);
  assert.equal(state.has(99), false, "full snapshots clear stale browser entities");
  assert.equal(state.size, 2);
  assert.equal(result.created, 2);
  const entityOne = state.get(1);
  const entityTwo = state.get(2);

  const beforeOne = quantizeEntity({ netId: 1, x: 100, y: 120, facing: 0.5, hp: 100, guard: 100, action: "idle" });
  const afterOne = quantizeEntity({ netId: 1, x: 103, y: 121, facing: 0.6, hp: 66, guard: 80, action: "attack_recovery" });
  const delta = encodeSnapshot({
    sequence: 11,
    baselineSequence: 10,
    serverTick: 103,
    records: [
      buildEntityDelta(afterOne, beforeOne),
      { netId: 2, mask: 1 << 7 },
    ],
  });

  applySnapshotPacketInPlace(state, delta, result);
  assert.equal(state.get(1), entityOne, "updated entities keep object identity for renderer references");
  assert.equal(state.has(2), false);
  assert.equal(entityTwo.netId, 2, "removed entity references are not mutated after removal");
  assert.equal(state.get(1).hp, 66);
  assert.ok(Math.abs(state.get(1).x - 103) <= 0.25);
  assert.equal(result.created, 0);
  assert.equal(result.updated, 1);
  assert.equal(result.removed, 1);
});

test("repeated browser snapshot updates allocate no replacement entity objects", () => {
  const state = new Map();
  const result = createSnapshotApplyResult();
  const baselineEntity = { netId: 7, x: 20, y: 30, facing: 0, hp: 100, guard: 100, action: "idle" };
  const full = encodeSnapshot({
    sequence: 1,
    baselineSequence: 0xffff,
    serverTick: 1,
    full: true,
    records: [fullRecord(baselineEntity)],
  });
  applySnapshotPacketInPlace(state, full, result);
  const stableReference = state.get(7);
  let before = quantizeEntity(baselineEntity);

  for (let index = 2; index <= 250; index += 1) {
    const next = quantizeEntity({ ...baselineEntity, x: 20 + index * 0.25 });
    const packet = encodeSnapshot({
      sequence: index,
      baselineSequence: index - 1,
      serverTick: index,
      records: [buildEntityDelta(next, before)],
    });
    applySnapshotPacketInPlace(state, packet, result);
    assert.equal(state.get(7), stableReference);
    assert.equal(result.created, 0);
    before = next;
  }
});

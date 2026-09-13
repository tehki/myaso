import test from "node:test";
import assert from "node:assert/strict";
import { createDeterministicImpairment } from "../src/browser/impairment.mjs";
import { createPredictionHistory, reconcilePrediction } from "../src/browser/reconciliation.mjs";

test("deterministic impairment bounds delay loss and reordering", () => {
  const impairment = createDeterministicImpairment({
    baseDelayMs: 40,
    jitterPatternMs: [0, 15, 5],
    dropEvery: 5,
    reorderEvery: 3,
    reorderExtraDelayMs: 35,
  });
  for (let index = 1; index <= 10; index += 1) impairment.schedule(100, index);
  assert.equal(impairment.scheduled, 10);
  assert.equal(impairment.dropped, 2);
  assert.equal(impairment.pending, 8);

  const delivered = [];
  impairment.drain(139, (value) => delivered.push(value));
  assert.deepEqual(delivered, []);
  impairment.drain(200, (value) => delivered.push(value));
  assert.equal(delivered.length, 8);
  assert.equal(impairment.pending, 0);
  assert.equal(impairment.delivered, 8);
  assert.ok(delivered.indexOf(3) > delivered.indexOf(4), "configured extra delay produces deterministic reordering");
});

test("prediction reconciliation remains bounded with delayed acknowledgement", () => {
  const history = createPredictionHistory({ maxEntries: 16 });
  const local = { x: 0, y: 0 };
  for (let tick = 1; tick <= 8; tick += 1) history.push(tick, { tick, moveX: 1, moveY: 0, facing: 0 });
  const result = reconcilePrediction({
    history,
    processedClientTick: 5,
    authoritativeState: { x: 10, y: 4 },
    restoreAuthoritative(state) { local.x = state.x; local.y = state.y; },
    replayInput() { local.x += 2; },
  });
  assert.equal(result.discarded, 5);
  assert.equal(result.replayed, 3);
  assert.deepEqual(local, { x: 16, y: 4 });
  assert.equal(history.size, 3);
});

import test from "node:test";
import assert from "node:assert/strict";
import { recordM161IngressTrace } from "../src/browser/m161-ingress-trace.mjs";

const tick = (t, action, source = "datagram") => ({
  source, serverTick: t, ownAction: action, focusAction: 12, epochMs: 1000 + t,
});

test("M161 keeps actual source/tick/action without inventing a knockdown", () => {
  let trace = [];
  trace = recordM161IngressTrace(trace, tick(243, 0));
  trace = recordM161IngressTrace(trace, tick(244, 19, "reliable"));
  assert.deepEqual(trace, [
    { ...tick(243, 0) },
    { ...tick(244, 19, "reliable") },
  ]);
});

test("M161 missing remote action remains null, never idle/knockdown", () => {
  const row = recordM161IngressTrace([], { ...tick(244, undefined), focusAction: undefined })[0];
  assert.equal(row.ownAction, null);
  assert.equal(row.focusAction, null);
});

test("M161 preserves bounded per-browser order, including duplicate tick deliveries", () => {
  let history = [];
  for (let t = 1; t <= 8; t++) {
    history = recordM161IngressTrace(history, tick(t, 0), 3);
  }
  assert.deepEqual(history.map(x => x.serverTick), [6, 7, 8]);
  history = recordM161IngressTrace(history, tick(8, 19, "reliable"), 3);
  assert.deepEqual(history.map(x => x.serverTick), [7, 8, 8]);
  assert.equal(history.at(-1).ownAction, 19);
});

test("M161 rejects malformed provenance, tick and unbounded storage", () => {
  for (const obj of [
    { ...tick(244, 19), source: "synthetic" },
    { ...tick(244, 19), serverTick: NaN },
    { ...tick(244, 19), epochMs: undefined },
  ]) assert.throws(() => recordM161IngressTrace([], obj), TypeError);
  assert.throws(() => recordM161IngressTrace([], tick(1, 19), 257), TypeError);
});

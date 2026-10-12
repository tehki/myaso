import assert from "node:assert/strict";
import test from "node:test";
import { planM197KnockdownClusterNudge } from "../scripts/m197-knockdown-cluster.mjs";

const fixture = (overrides = {}) => ({
  rollRight: true, firstX: 200, secondX: 218, moveSpeed: 215,
  targetLeadPx: 18, tolerancePx: 8, ...overrides,
});

test("M197 keeps already ordered 18px roll contacts intact", () => {
  assert.deepEqual(planM197KnockdownClusterNudge(fixture()), {
    aligned: true, leadPx: 18, errorPx: 0, targetLeadPx: 18,
    key: null, pulseMs: 0,
  });
  assert.equal(planM197KnockdownClusterNudge(fixture({ secondX: 224 })).aligned, true);
  assert.equal(planM197KnockdownClusterNudge(fixture({ secondX: 211 })).aligned, true);
});

test("M197 corrects excessive second-contact lag with one real forward key pulse", () => {
  const plan = planM197KnockdownClusterNudge(fixture({ secondX: 258 }));
  assert.equal(plan.aligned, false);
  assert.equal(plan.key, "a");
  assert.equal(plan.leadPx, 58);
  assert.equal(plan.errorPx, -40);
  assert.equal(plan.pulseMs, 175);
});

test("M197 respects leftward roll ordering and corrects either direction", () => {
  const retreat = planM197KnockdownClusterNudge(fixture({
    rollRight: false, firstX: 180, secondX: 135,
  }));
  assert.equal(retreat.leadPx, 45);
  assert.equal(retreat.key, "d");
  assert.equal(retreat.aligned, false);
  const advance = planM197KnockdownClusterNudge(fixture({
    rollRight: false, firstX: 180, secondX: 174,
  }));
  assert.equal(advance.leadPx, 6);
  assert.equal(advance.key, "a");
  assert.equal(advance.pulseMs, 56);
});

test("M197 rejects missing positions and invalid movement rather than guessing", () => {
  for (const bad of [
    { secondX: NaN }, { firstX: Infinity }, { moveSpeed: 0 },
    { moveSpeed: NaN }, { rollRight: null }, { tolerancePx: -1 },
    { targetLeadPx: 0 }, { maxPulseMs: 0 },
  ]) {
    assert.throws(() => planM197KnockdownClusterNudge(fixture(bad)), RangeError);
  }
});

test("M197 never needs to trigger a combat input or alter immutable state", () => {
  const original = Object.freeze(fixture({ secondX: 244 }));
  const before = JSON.stringify(original);
  const plan = planM197KnockdownClusterNudge(original);
  assert.equal(plan.key, "a");
  assert.ok(plan.pulseMs <= 175);
  assert.deepEqual(Object.keys(plan).sort(), [
    "aligned", "errorPx", "key", "leadPx", "pulseMs", "targetLeadPx",
  ].sort());
  assert.equal(JSON.stringify(original), before);
});

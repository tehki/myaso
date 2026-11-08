import assert from "node:assert/strict";
import test from "node:test";
import { planM197KnockdownClusterNudge, awaitM197SettledCluster } from "../scripts/m197-knockdown-cluster.mjs";

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

test("M197 waits through delayed original World motion before a compensating W3C nudge", async () => {
  // First-RED shape: misleading near-stationary sample followed by a genuine
  // delayed crossing from lead +30 to -34. Never correct from the first sample.
  const positions = [
    [134, 166], [134, 166], [130, 160], [124, 90],
    [124, 90], [124, 90], [124, 90], [124, 90],
  ];
  let clock = 0;
  let reads = 0;
  const settled = await awaitM197SettledCluster({
    read: async () => {
      const [firstX, secondX] = positions[Math.min(reads, positions.length - 1)];
      reads++;
      return {
        first: { x: firstX, y: 102 },
        second: { x: secondX, y: 165 },
        serverTick: 1400 + reads,
      };
    },
    sleep: async (ms) => { clock += ms; },
    now: () => clock,
    intervalMs: 100, timeoutMs: 2400, settleSamples: 4,
  });
  assert.equal(settled.first.x, 124);
  assert.equal(settled.second.x, 90);
  assert.ok(reads >= 8, "must not act on a transient stale World position");
  const plan = planM197KnockdownClusterNudge(fixture({
    firstX: settled.first.x, secondX: settled.second.x,
    maxPulseMs: 90,
  }));
  assert.equal(plan.key, "d", "correct the final observed sign, not the stale one");
  assert.ok(plan.pulseMs <= 90);
});

test("M197 refuses missing or stale Rust ticks and oscillating snapshots", async () => {
  await assert.rejects(awaitM197SettledCluster({
    read: async () => ({ first: { x: 1, y: 2 }, second: { x: 3, y: 4 } }),
    sleep: async () => {},
  }), /genuine Rust World positions and tick/);
  let clock = 0;
  let n = 0;
  await assert.rejects(awaitM197SettledCluster({
    read: async () => ({ first: { x: 124 + ((n++ % 2) ? 8 : -8), y: 102 },
      second: { x: 90, y: 165 }, serverTick: 1400 + n }),
    sleep: async (ms) => { clock += ms; },
    now: () => clock, intervalMs: 100, timeoutMs: 650, settleSamples: 2,
  }), /did not settle/);
  clock = 0;
  await assert.rejects(awaitM197SettledCluster({
    read: async () => ({ first: { x: 124, y: 102 },
      second: { x: 90, y: 165 }, serverTick: 1400 }),
    sleep: async (ms) => { clock += ms; },
    now: () => clock, intervalMs: 100, timeoutMs: 650, settleSamples: 2,
  }), /did not settle/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { COMBAT } from "../src/combat/model.mjs";
import { planM121NativeGeometry } from "../scripts/m121-native-geometry-plan.mjs";

const source = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
const start = source.indexOf("  const stagingFighters = observerBefore.acceptance?.fighters");
const end = source.indexOf("  const jumpKeyOffset =", start);
assert.ok(start > 0 && end > start);
function verify(fighters) {
  const logs = [];
  vm.runInNewContext(source.slice(start, end), {
    COMBAT, jumpId: 1, observerId: 2, closerId: 3, milestone: "M147",
    observerBefore: {acceptance: {serverTick: 100, fighters}},
    console: {log: line => logs.push(line)},
  });
  return logs;
}

test("M147 cannot mistake nearest-rival focus for actual original Light contact range", () => {
  const spawnWithCloserRival = [
    {netId: 1, x: 42, y: 42, action: 0},
    {netId: 2, x: 138, y: 42, action: 0},
    {netId: 3, x: 212, y: 42, action: 0},
  ];
  assert.equal(COMBAT.attack.reach + COMBAT.fighterRadius, 94);
  assert.throws(() => verify(spawnWithCloserRival), /outside the original Light contact geometry/);
  assert.throws(() => verify([]), /outside the original Light contact geometry/);
  assert.throws(() => verify([{netId: 1, x: NaN, y: 42}, ...spawnWithCloserRival.slice(1)]), /outside/);
});

test("M147 accepts real in-range ordered replicas and logs compact original geometry", () => {
  const fighters = [
    {netId: 1, x: 70, y: 42, action: 0},
    {netId: 2, x: 138, y: 42, action: 0},
    {netId: 3, x: 190, y: 42, action: 0},
  ];
  const logs = verify(fighters);
  assert.equal(logs.length, 1);
  const proof = JSON.parse(logs[0].slice("M147_STAGING_GEOMETRY ".length));
  assert.equal(proof.stagingGap, 68);
  assert.deepEqual(proof.fighters, fighters);
  assert.throws(() => verify([fighters[2], fighters[1], {...fighters[0], netId: 3}]), /outside/);
});

function runStaging(observedGaps) {
  const start = source.indexOf("  // A native hold duration is not proof of World displacement.");
  const end = source.indexOf("  for (let attempt = 0; attempt < 3 && observerBefore?.focusLabel", start);
  assert.ok(start > 0 && end > start);
  const block = source.slice(start, end).replace(
    /  const \{ planM121NativeGeometry \} = await import\("\.\/m121-native-geometry-plan\.mjs"\);\r?\n/, "");
  let observation = 0;
  const pulses = [], waits = [];
  const entries = [{name: "chrome"}, {name: "firefox"}, {name: "chrome2"}];
  const promise = vm.runInNewContext("(async()=>{" + block + "return {geometryReady,nativeGeometry};})()", {
    baseline: [], observerBefore: null, entries, observer: entries[1], jumpAttacker: entries[0],
    jumpId: 1, observerId: 2, milestone: "M147", planM121NativeGeometry,
    readUiEvidence: async entry => {
      if (entry.name !== "firefox") return {browser: entry.name};
      const gap = observedGaps[Math.min(observation++, observedGaps.length - 1)];
      return {browser: entry.name, acceptance: {serverTick: 100 + observation,
        fighters: [{netId: 1, x: 138 - gap, y: 42, action: 0},
          {netId: 2, x: 138, y: 42, action: 0},
          {netId: 3, x: 190, y: 42, action: 0}]}};
    },
    pulseMovementKeyBoundedW3c: async (actor, key, durationMs) => pulses.push({actor: actor.name, key, durationMs}),
    sleep: async ms => waits.push(ms), console: {log() {}},
  });
  return {promise, pulses, waits};
}

test("M147 rechecks actual replicas after under/over-delivered native movement before the single attack", async () => {
  // Observation sequence, not a replacement World simulation: an initial
  // out-of-range gap, a differently delivered correction, then stable replicas.
  const run = runStaging([96, 64, 72, 72, 72]);
  assert.equal((await run.promise).geometryReady, true);
  assert.deepEqual(run.pulses.map(p => p.key), ["d", "a"]);
  assert.ok(run.pulses.every(p => p.actor === "chrome" && p.durationMs >= 20 && p.durationMs <= 180));
  assert.ok(run.waits.filter(ms => ms === 310).length >= 3,
    "physical corrective keys stay beyond the existing Dash double-tap window");
});

test("M147 refuses a stalled native approach instead of treating the requested hold as displacement", async () => {
  const run = runStaging([96]);
  await assert.rejects(run.promise, /did not converge before the single JumpAttack/);
  assert.equal(run.pulses.length, 8, "bounded genuine attempts, no unlimited retry or fake position");
});

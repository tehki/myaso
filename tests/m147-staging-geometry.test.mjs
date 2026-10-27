import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { COMBAT } from "../src/combat/model.mjs";

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

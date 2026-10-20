import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { MAP_IDS } from "../src/world/authored-maps.mjs";
import { isAuthoredPreviewWalkable, PREVIEW_FIGHTER_RADIUS } from "../src/world/authored-preview-collision.mjs";

const fixtures = readFileSync(new URL("./fixtures/world-geometry-parity-v1.csv", import.meta.url), "utf8");
const rows = fixtures.trim().split(/\r?\n/).filter(line => line && !line.startsWith("#"))
  .map(line => {
    const [mapId, xs, ys, rs, expected, extra] = line.split(",");
    assert.equal(extra, undefined, `malformed fixture row: ${line}`);
    assert.ok([MAP_IDS.overworld, MAP_IDS.tavern].includes(mapId), `invalid map: ${line}`);
    assert.ok(expected === "0" || expected === "1");
    return { line, mapId, x: Number(xs), y: Number(ys),
      radius: Number(rs), expected: expected === "1" };
  });

test("D3 golden geometry fixtures agree with the existing D2 browser query", () => {
  assert.ok(rows.length >= 24);
  assert.ok(rows.some(row => row.mapId === MAP_IDS.overworld));
  assert.ok(rows.some(row => row.mapId === MAP_IDS.tavern));
  for (const { line, mapId, x, y, radius, expected } of rows) {
    assert.equal(isAuthoredPreviewWalkable(mapId, x, y, radius), expected, line);
  }
  assert.equal(PREVIEW_FIGHTER_RADIUS, 18);
});

test("D3 Rust collision constants are reproducibly regenerated from authored geography", () => {
  const generator = fileURLToPath(new URL("../scripts/generate-world-geometry.mjs", import.meta.url));
  const check = spawnSync(process.execPath, [generator, "--check"], {
    encoding: "utf8", timeout: 10000,
  });
  assert.equal(check.error, undefined);
  assert.equal(check.status, 0, check.stderr || check.stdout);
  assert.match(check.stdout, /constants match authored map/);
});

test("D3 Rust geometry is not connected to the production game network or simulation", () => {
  const main = readFileSync(new URL("../server/src/main.rs", import.meta.url), "utf8");
  const sim = readFileSync(new URL("../server/src/simulation.rs", import.meta.url), "utf8");
  const web = readFileSync(new URL("../web/online-game.mjs", import.meta.url), "utf8");
  for (const source of [main, sim, web]) {
    assert.doesNotMatch(source, /world_geometry|GEOMETRY_MANIFEST_VERSION|isAuthoredPreviewWalkable/);
  }
});

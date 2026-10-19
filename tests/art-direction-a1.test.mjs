import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { projectArenaPoint, ARENA_VIEW_ZOOM } from "../src/browser/arena-viewport.mjs";
import { NETWORK } from "../src/network/constants.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const assetDir = join(root, "assets/environment/greyhaven");
const manifest = JSON.parse(readFileSync(join(assetDir, "art-manifest.v1.json"), "utf8"));
const objText = readFileSync(join(assetDir, "red_lion_blockout.obj"), "utf8");
const mtlText = readFileSync(join(assetDir, "red_lion_blockout.mtl"), "utf8");

test("A1 art brief is approved, fixed-world, with separate interior and reversible visuals", () => {
  const brief = readFileSync(join(root, "docs/art/BLOOD_AND_IRON_ART_DIRECTION_RU.md"), "utf8");
  const pipeline = readFileSync(join(root, "docs/art/ASSET_PIPELINE_AND_A1_ACCEPTANCE_RU.md"), "utf8");
  assert.match(brief, /Blood & Iron: Medieval Realism/);
  assert.match(brief, /статус:.*утверждено/i);
  assert.match(brief, /процедурн/i);
  assert.match(brief, /масштаб/);
  assert.match(pipeline, /нет.*клиентом по умолчанию|не загружается игровым клиентом/i);
  assert.match(pipeline, /Blender/);
});

test("A1 camera is measured from real game; OBJ units do not silently change physics", () => {
  assert.equal(manifest.schemaVersion, 1);
  const scale = manifest.coordinateConvention;
  assert.equal(scale.metersPerWorldUnit, 0.025);
  assert.equal(scale.fighterRadiusWorldUnits, 18);
  assert.equal(scale.fighterRadiusMeters, 0.45);
  assert.equal(scale.cameraZoom, ARENA_VIEW_ZOOM);
  assert.equal(NETWORK.worldWidth, scale.worldCanvasWidth);
  assert.equal(NETWORK.worldHeight, scale.worldCanvasHeight);
  assert.match(scale.orthographicBakeAngle, /TBD/);
  const world = projectArenaPoint(4365, 4075, 4365, 4075, 1200, 800);
  assert.deepEqual(world, { x: 600, y: 400 });
  const other = projectArenaPoint(4405, 4075, 4365, 4075, 1200, 800);
  assert.ok(Math.abs(other.x - (600 + 40 * scale.cameraZoom)) < 1e-9);
});

test("Red Lion exterior and larger interior align with fixed authored world portal", () => {
  const b = manifest.firstSlice.approvedBuilding;
  assert.equal(b.mapId, "moonvale-overworld");
  assert.equal(b.exterior.width, 250);
  assert.equal(b.exterior.height, 170);
  assert.equal(b.door.x, b.exterior.x + b.exterior.width / 2);
  assert.ok(b.door.y >= b.exterior.y + b.exterior.height);
  assert.ok(b.door.y - (b.exterior.y + b.exterior.height) <= 52);
  assert.equal(b.door.portalId, "red-lion-enter");
  assert.equal(b.interior.id, "red-lion-inn");
  assert.ok(b.interior.width > b.exterior.width);
  assert.ok(b.interior.height > b.exterior.height);
  assert.equal(b.exterior.width * manifest.coordinateConvention.metersPerWorldUnit, 6.25);
  assert.equal(b.exterior.height * manifest.coordinateConvention.metersPerWorldUnit, 4.25);
});

test("OBJ is Blender-editable with intact indices, geometry bounds, and material names", () => {
  assert.match(objText, /^mtllib red_lion_blockout\.mtl$/m);
  assert.match(objText, /^g roof_slopes$/m);
  assert.match(objText, /^g door_front$/m);
  assert.match(objText, /^g foundation_stone$/m);
  assert.match(objText, /^g windows_and_shutters$/m);
  assert.match(objText, /^g chimney$/m);
  const vertices = objText.split("\n").filter(line => line.startsWith("v ")).map(line => line.slice(2).trim().split(/\s+/).map(Number));
  const faces = objText.split("\n").filter(line => line.startsWith("f ")).map(line => line.slice(2).trim().split(/\s+/).map(Number));
  assert.ok(vertices.length > 2000, "actual geometry expected, not an empty manifest");
  assert.ok(faces.length > 600);
  assert.ok(vertices.every(v => v.length === 3 && v.every(Number.isFinite)));
  assert.ok(faces.every(f => f.length >= 3 && f.every(n => Number.isInteger(n) && n >= 1 && n <= vertices.length)));
  const extent = [0, 1, 2].map(i => [Math.min(...vertices.map(v => v[i])), Math.max(...vertices.map(v => v[i]))]);
  assert.ok(extent[0][0] < -3.1 && extent[0][1] > 3.1);
  assert.ok(extent[1][0] < -2.1 && extent[1][1] > 2.1);
  assert.ok(extent[2][0] >= 0 && extent[2][1] > 5.1);
  assert.ok(extent[0][1] - extent[0][0] < 8, "decorations may overhang but geometry must remain near target footprint");
  const mtlIds = [...mtlText.matchAll(/^newmtl\s+(\S+)$/gm)].map(x => x[1]);
  const used = [...objText.matchAll(/^usemtl\s+(\S+)$/gm)].map(x => x[1]);
  assert.deepEqual(new Set(mtlIds), new Set(manifest.materials.map(m => m.id.replaceAll("-", "_"))));
  assert.ok(used.every(m => mtlIds.includes(m)));
});

test("A1 backlog describes real production kits without pretending they are finished", () => {
  const backlog = manifest.prefabBacklog;
  assert.ok(backlog.length >= 25);
  assert.ok(backlog.reduce((n, x) => n + x.quantity, 0) >= 55);
  assert.equal(backlog.filter(x => x.status === "geometry-blockout").length, 1);
  assert.ok(backlog.every(x => ["must", "should", "nice"].includes(x.priority) && Number.isInteger(x.quantity) && x.quantity > 0));
  assert.ok(backlog.some(x => x.kind === "interior"));
  assert.ok(backlog.some(x => x.kind === "vegetation"));
  assert.ok(backlog.some(x => x.kind === "terrain"));
});

test("OBJ generator is byte-reproducible when Python 3 is present", t => {
  const python = ["python3", "python"].find(binary => {
    const run = spawnSync(binary, ["--version"], { encoding: "utf8", timeout: 2000 });
    return run.status === 0;
  });
  if (!python) {
    t.diagnostic("Python unavailable; committed OBJ structural checks above still apply");
    return;
  }
  const scratch = mkdtempSync(join(tmpdir(), "myaso-red-lion-a1-"));
  try {
    const run = spawnSync(python, [join(root, "tools/art/build_red_lion_blockout.py"), "--output-dir", scratch], { encoding: "utf8", timeout: 10000 });
    assert.equal(run.status, 0, run.stderr);
    assert.equal(readFileSync(join(scratch, "red_lion_blockout.obj"), "utf8"), objText);
    assert.equal(readFileSync(join(scratch, "red_lion_blockout.mtl"), "utf8"), mtlText);
  } finally { rmSync(scratch, { recursive: true, force: true }); }
});

test("A1 has zero accidental production integration or combat changes", () => {
  const game = readFileSync(join(root, "web/online-game.mjs"), "utf8");
  assert.doesNotMatch(game, /red_lion_blockout|art-manifest\.v1/);
  assert.doesNotMatch(game, /BLOOD_AND_IRON_ART_DIRECTION/);
});

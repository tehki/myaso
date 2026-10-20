import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { MAP_IDS } from "../src/world/authored-maps.mjs";
import {
  isAuthoredPreviewWalkable,
  moveAuthoredPreview,
  MAX_PREVIEW_FRAME_MOVE,
} from "../src/world/authored-preview-collision.mjs";

const fixture = readFileSync(new URL("./fixtures/world-movement-parity-v1.csv", import.meta.url), "utf8");
const cases = fixture.trim().split(/\r?\n/).filter(line => line && !line.startsWith("#"))
  .map(line => {
    const fields = line.split(",");
    assert.equal(fields.length, 9, line);
    const [map,x,y,dx,dy,radius,outX,outY,result] = fields;
    assert.ok([MAP_IDS.overworld,MAP_IDS.tavern].includes(map), line);
    assert.ok(["ok","invalid-start","invalid-delta"].includes(result), line);
    return {line,map,x:Number(x),y:Number(y),dx:Number(dx),dy:Number(dy),
      radius:Number(radius),outX,outY,result};
  });

test("D4 generated 867 walking cases match D2 local collision and reject invalid inputs", () => {
  assert.equal(cases.length, 867);
  let collisions=0, invalid=0;
  for (const c of cases) {
    const startOK = isAuthoredPreviewWalkable(c.map,c.x,c.y,c.radius);
    const deltaOK = Number.isFinite(c.dx) && Number.isFinite(c.dy)
      && Math.hypot(c.dx,c.dy) <= MAX_PREVIEW_FRAME_MOVE;
    const expected = !startOK ? "invalid-start" : !deltaOK ? "invalid-delta" : "ok";
    assert.equal(c.result, expected, c.line);
    const output = moveAuthoredPreview(c.map,{x:c.x,y:c.y},c.dx,c.dy,c.radius);
    if (c.result === "ok") {
      assert.ok(output, c.line);
      assert.ok(isAuthoredPreviewWalkable(c.map,output.x,output.y,c.radius), c.line);
      assert.ok(Math.abs(output.x-Number(c.outX)) < .0001
        && Math.abs(output.y-Number(c.outY)) < .0001, c.line);
      if (Math.abs(output.x-c.x) < Math.abs(c.dx)-.01
        || Math.abs(output.y-c.y) < Math.abs(c.dy)-.01) collisions++;
    } else {
      invalid++;
      assert.equal(c.outX, "-", c.line);
      assert.equal(c.outY, "-", c.line);
      if (startOK) assert.deepEqual(output,{x:c.x,y:c.y},c.line);
    }
  }
  assert.ok(collisions >= 40, `lost collision coverage: ${collisions}`);
  assert.ok(invalid >= 200, `lost fail-closed coverage: ${invalid}`);
});

test("D4 movement parity fixture regeneration is stable in CI and Windows checkouts", () => {
  const script = fileURLToPath(new URL("../scripts/generate-world-movement-fixtures.mjs", import.meta.url));
  const p = spawnSync(process.execPath,[script,"--check"],{encoding:"utf8",timeout:10000});
  assert.equal(p.error,undefined);
  assert.equal(p.status,0,p.stderr || p.stdout);
  assert.match(p.stdout,/D4 fixtures verified: 867 steps/);
});

test("D4 dormant Rust movement never enters live authoritative simulation or networking", () => {
  const liveSources = ["../server/src/main.rs","../server/src/simulation.rs","../web/online-game.mjs"];
  for (const p of liveSources) {
    const source=readFileSync(new URL(p,import.meta.url),"utf8");
    assert.doesNotMatch(source,/world_movement|shadow_resolve_walk|MAX_SHADOW_WALK_DELTA/);
  }
  const rust=readFileSync(new URL("../server/src/world_movement.rs",import.meta.url),"utf8");
  assert.match(rust,/pub fn shadow_resolve_walk/);
  assert.doesNotMatch(rust,/crate::simulation::|wtransport|InputPacket|World::step/);
});

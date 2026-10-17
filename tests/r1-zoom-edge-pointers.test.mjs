import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { ARENA_VIEW_ZOOM, nearbyOffscreenPointers, projectArenaPoint } from "../src/browser/arena-viewport.mjs";

const width = 960, height = 540, camera = { x: 4000, y: 4000 };
const enemy = (netId, x, y, action = 0) => ({ netId, x: camera.x + x, y: camera.y + y, action });

test("R1 zoom widens real world visibility without modifying world positions or aim", () => {
  assert.ok(ARENA_VIEW_ZOOM >= 0.8 && ARENA_VIEW_ZOOM <= 0.9);
  assert.deepEqual(projectArenaPoint(4000, 4000, 4000, 4000, width, height),
    { x: 480, y: 270 });
  assert.ok(projectArenaPoint(4530, 4000, 4000, 4000, width, height).x < width);
  assert.equal(projectArenaPoint(4000, 4000, 4000, 4000, width, height).y, height / 2);
  assert.deepEqual(camera, {x: 4000,y: 4000}, "rendering cannot change the actual camera/world object");
  assert.throws(() => projectArenaPoint(4, 5, 0, 0, width, height, 1.5));
});

test("edge indicator only for truly offscreen nearby enemy, points along direction", () => {
  const right = nearbyOffscreenPointers([enemy(1, 0, 0), enemy(2, 800, 0),
    enemy(3, 530, 0), enemy(4, 1500, 0)], 1, camera, width, height);
  assert.equal(right.length, 1);
  assert.equal(right[0].netId, 2);
  assert.equal(right[0].x, width - 26);
  assert.equal(right[0].y, height / 2);
  assert.equal(right[0].angle, 0);
  const left = nearbyOffscreenPointers([enemy(2, -800, 0)], 1, camera, width, height);
  assert.equal(left[0].x, 26);
  assert.equal(Math.abs(left[0].angle), Math.PI);
  assert.equal(nearbyOffscreenPointers([enemy(2, 0, -800)], 1, camera, width, height)[0].y, 26);
  assert.equal(nearbyOffscreenPointers([enemy(2, 0, 800)], 1, camera, width, height)[0].y, 514);
});

test("diagonal marker clips within safe viewport insets", () => {
  const [p] = nearbyOffscreenPointers([enemy(8, 800, -800)], 1, camera, width, height);
  assert.ok(p.x >= 26 && p.x <= width - 26);
  assert.ok(p.y >= 26 && p.y <= height - 26);
  assert.ok(p.x > width / 2 && p.y < height / 2);
});

test("limit, ordering, dead/invalid exclusion and deterministic netId tie-breaker", () => {
  const targets = [enemy(9, 1100, 0), enemy(3, -1000, 0), enemy(2, 1000, 0),
    enemy(5, 0, 900), enemy(4, -900, 0), enemy(6, 800, 0),
    enemy(7, 900, 900), enemy(10, 800, 0, 99),
    { netId: 11, x: NaN, y: 5 }];
  const pointers = nearbyOffscreenPointers(targets, 1, camera, width, height,
    { deadAction: 99, maxPointers: 3 });
  assert.deepEqual(pointers.map(x => x.netId), [6, 4, 5]);
  assert.ok(pointers.every(p => Number.isFinite(p.x) && Number.isFinite(p.y)));
  assert.equal(nearbyOffscreenPointers(targets, 1, camera, width, height, {maxPointers:0}).length, 0);
});

test("real online loop applies scale only to world draw, then restores for readable HUD and edge pointers", () => {
  const online = readFileSync(new URL("../web/online-game.mjs", import.meta.url), "utf8");
  const begin=online.indexOf("function render(nowMs =");
  const end=online.indexOf("\nfunction drawImpactBurst(",begin);
  const body=online.slice(begin,end);
  const scale=body.indexOf("ctx.scale(ARENA_VIEW_ZOOM, ARENA_VIEW_ZOOM)");
  const actor=body.indexOf("drawFighterScreen(canvas.width / 2, canvas.height / 2, local");
  const restore=body.indexOf("ctx.restore()",actor);
  const pointers=body.indexOf("drawOffscreenEnemyPointers(visibleEnemyPositions, ownId)");
  assert.ok(scale>0 && actor>scale && restore>actor && pointers>restore);
  assert.ok(body.includes("networkClient.remoteInterpolator.sample"));
  assert.ok(body.includes("if (local.initialized)"));
  assert.ok(online.includes("projectArenaPoint(focus.x, focus.y"));
  assert.ok(!body.includes("local.x * ARENA_VIEW_ZOOM"));
  assert.ok(!body.includes("networkClient.sendInput({ tick: outgoingTick, ...currentInput, zoom:"));
});


test("M46/M47 remote HP, guard and identity stay full-resolution outside zoomed world",()=>{
  const online=readFileSync(new URL("../web/online-game.mjs",import.meta.url),"utf8");
  const begin=online.indexOf("function render(nowMs =");
  const end=online.indexOf("\nfunction drawImpactBurst(",begin);
  const body=online.slice(begin,end);
  const scale=body.indexOf("ctx.scale(ARENA_VIEW_ZOOM, ARENA_VIEW_ZOOM)");
  const actor=body.indexOf("drawFighterWorld(sampled,");
  const restore=body.indexOf("ctx.restore();",actor);
  const vitals=body.indexOf("drawRemoteVitals(projected.x, projected.y, enemy)");
  const identity=body.indexOf("drawRemoteIdentity(projected.x, projected.y, enemy.netId)");
  assert.ok(scale>=0 && actor>scale && restore>actor && vitals>restore && identity>restore);
  assert.ok(body.includes("projectArenaPoint(enemy.x, enemy.y,"));
  assert.ok(body.includes("visibleEnemyPositions.push(sampled)"));
  const world=online.slice(online.indexOf("function drawFighterWorld("),
    online.indexOf("\nfunction drawFighterScreen(",online.indexOf("function drawFighterWorld(")));
  assert.ok(!world.includes("drawRemoteVitals("));
  assert.ok(!world.includes("drawRemoteIdentity("));
  const vitalsFunction=online.slice(online.indexOf("function drawRemoteVitals("),
    online.indexOf("\nfunction drawRemoteIdentity(",online.indexOf("function drawRemoteVitals(")));
  assert.match(vitalsFunction,/const width = 42;/);
  assert.match(vitalsFunction,/presentation.hp \/ 100/);
  assert.match(vitalsFunction,/presentation.guard \/ 100/);
});

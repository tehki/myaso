import test from "node:test";
import assert from "node:assert/strict";
import { MAP_IDS } from "../src/world/authored-maps.mjs";
import { MOONVALE_LANDMARKS } from "../src/world/landmark-discovery.mjs";
import {
  PREVIEW_FIGHTER_RADIUS, MAX_PREVIEW_FRAME_MOVE,
  isAuthoredPreviewWalkable, moveAuthoredPreview,
} from "../src/world/authored-preview-collision.mjs";

const outside = MAP_IDS.overworld;
const inside = MAP_IDS.tavern;

function followRoute(points) {
  let p = { ...points[0] };
  assert.ok(isAuthoredPreviewWalkable(outside, p.x, p.y), "route must start on walkable ground");
  for (const target of points.slice(1)) {
    let stalled = 0;
    for (let i = 0; i < 1400; i++) {
      const dx = target.x - p.x, dy = target.y - p.y;
      const distance = Math.hypot(dx, dy);
      if (distance < 0.25) break;
      const distanceStep = Math.min(10, distance);
      const next = moveAuthoredPreview(outside, p, dx / distance * distanceStep, dy / distance * distanceStep);
      assert.ok(next && isAuthoredPreviewWalkable(outside, next.x, next.y));
      if (Math.hypot(next.x - p.x, next.y - p.y) < .001) stalled++;
      else stalled = 0;
      assert.ok(stalled < 2, `blocked route near ${p.x.toFixed(1)},${p.y.toFixed(1)} toward ${target.x},${target.y}`);
      p = next;
    }
    assert.ok(Math.hypot(p.x - target.x, p.y - target.y) < .25,
      `unreachable waypoint ${target.x},${target.y}; ended at ${p.x},${p.y}`);
  }
  return p;
}

test("D2 spawn, doors, discoveries, and tavern exit remain approachable", () => {
  assert.equal(PREVIEW_FIGHTER_RADIUS, 18);
  for (const p of [
    [outside, 4365, 4150],
    [outside, 4365, 4143],
    [inside, 390, 480],
    [inside, 390, 550],
    ...MOONVALE_LANDMARKS.map(site => [site.mapId, site.x, site.y]),
  ]) assert.ok(isAuthoredPreviewWalkable(...p), `blocked authored anchor: ${p}`);
});

test("D2 outdoor buildings, city walls and tavern furniture physically block travel", () => {
  for (const [map, x, y] of [
    [outside, 4365, 4000], // Red Lion roof
    [outside, 4450, 4400], // market hall roof
    [outside, 3520, 3900], // Greyhaven west wall
    [outside, 4000, 3460], // Greyhaven north wall
    [inside, 400, 115], // counter
    [inside, 400, 355], // table
    [inside, 165, 260], // barrels
  ]) assert.equal(isAuthoredPreviewWalkable(map, x, y), false, `solid did not block ${map} ${x},${y}`);
  assert.ok(isAuthoredPreviewWalkable(outside, 3520, 4180), "west gate");
  assert.ok(isAuthoredPreviewWalkable(outside, 4130, 3460), "north gate");
  assert.ok(isAuthoredPreviewWalkable(inside, 390, 480), "rug is decorative, spawn remains valid");
});

test("D2 river is impassable without a deck; bridge lanes remain open", () => {
  assert.equal(isAuthoredPreviewWalkable(outside, 1940, 3840), false, "unguarded river crossing");
  assert.equal(isAuthoredPreviewWalkable(outside, 1980, 4320), false, "water beside bridge");
  assert.equal(isAuthoredPreviewWalkable(outside, 1980, 4240), true, "King's Road bridge");
  assert.equal(isAuthoredPreviewWalkable(outside, 2100, 5500), true, "southern bridge");
});

test("D2 bounded swept movement stops on roofs and preserves wall sliding", () => {
  const start = { x: 4365, y: 4150 };
  let p = start;
  for (let i = 0; i < 40; i++) p = moveAuthoredPreview(outside, p, 0, -10);
  assert.ok(p.y >= 4068 && p.y < 4095, `should stop at inn entrance instead of walking through roof: ${p.y}`);
  assert.equal(p.x, start.x);
  const slide = moveAuthoredPreview(outside, { x: 4215, y: 3980 }, 11, 11);
  assert.ok(slide.x <= 4222 && slide.y > 3980, `should slide along Red Lion west wall: ${JSON.stringify(slide)}`);
  assert.ok(isAuthoredPreviewWalkable(outside, slide.x, slide.y));
});

test("D2 all four landmark sites are reachable along coherent authored routes", () => {
  const spawn = { x: 4365, y: 4150 };
  followRoute([spawn, { x: 4450, y: 4250 }]); // marketplace
  followRoute([spawn, { x: 4130, y: 4180 }, { x: 3500, y: 4180 },
    { x: 2815, y: 4100 }]); // mill
  followRoute([spawn, { x: 4130, y: 4150 }, { x: 4130, y: 3490 },
    { x: 3860, y: 2850 }, { x: 3560, y: 1900 },
    { x: 3350, y: 2070 }, { x: 3210, y: 2070 }]); // watch ruin
});

test("D2 a player can traverse the King's Road bridge but not swim across the river", () => {
  followRoute([{ x: 2800, y: 4180 }, { x: 2500, y: 4200 },
    { x: 2200, y: 4250 }, { x: 1700, y: 4250 }]);
  let p = { x: 2250, y: 3600 };
  for (let i = 0; i < 60; i++) p = moveAuthoredPreview(outside, p, -10, 0);
  assert.ok(p.x > 2000, `ungated swimmer passed river at x=${p.x}`);
});

test("D2 rejects NaN/unknown-map/infinite/oversized movement and edges", () => {
  for (const [map,x,y] of [
    [outside, NaN, 50], [outside, Infinity, 30],
    [outside, -1, 55], [outside, 10, 10],
    [outside, 8192, 4000], ["fabricated", 4000, 4000],
    [outside, 4365, 4150],
  ]) {
    if (x === 4365) continue;
    assert.equal(isAuthoredPreviewWalkable(map,x,y), false);
  }
  assert.equal(isAuthoredPreviewWalkable(outside, 4365, 4150, Infinity), false);
  assert.equal(moveAuthoredPreview("wrong", { x: 4365, y: 4150 }, 1, 1), null);
  assert.equal(moveAuthoredPreview(outside, { x: NaN, y: 4150 }, 1, 1), null);
  const start = { x: 4365, y: 4150 };
  for (const [dx,dy] of [[MAX_PREVIEW_FRAME_MOVE + 1, 0], [NaN, 0], [0, Infinity]]) {
    assert.deepEqual(moveAuthoredPreview(outside, start, dx, dy), start);
  }
  assert.deepEqual(start, { x: 4365, y: 4150 }, "no input mutation");
});

test("D2 deterministic movement and exit anchors preserve existing zone boundary", () => {
  const start = { x: 390, y: 480 };
  const a = moveAuthoredPreview(inside, start, 0, 11);
  const b = moveAuthoredPreview(inside, start, 0, 11);
  assert.deepEqual(a,b);
  assert.ok(a.y > start.y);
  assert.ok(isAuthoredPreviewWalkable(inside, 390, 550));
});

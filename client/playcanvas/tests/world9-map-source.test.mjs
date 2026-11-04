import test from 'node:test';
import assert from 'node:assert/strict';
import { AUTHORED_MAPS, MAP_IDS, getAuthoredMap } from '../src/world/authored-maps.mjs';

test('PlayCanvas visualization consumes the canonical World9 authored map', () => {
  const map = getAuthoredMap(MAP_IDS.overworld);
  assert.equal(map, AUTHORED_MAPS[MAP_IDS.overworld]);
  assert.equal(map.id, 'moonvale-overworld');
  assert.equal(map.width, 8192);
  assert.equal(map.height, 8192);
  assert.equal(map.city.id, 'greyhaven');
  assert.equal(map.buildings.length, 15);
  assert.deepEqual(map.spawn, { x: 4110, y: 4160 });
});

test('Red Lion and Blacksmith use their authored World9 footprints', () => {
  const map = getAuthoredMap(MAP_IDS.overworld);
  const redLion = map.buildings.find(building => building.id === 'red-lion');
  const blacksmith = map.buildings.find(building => building.id === 'smith');

  assert.deepEqual(
    { x: redLion.x, y: redLion.y, w: redLion.w, h: redLion.h, entrance: redLion.entrance },
    { x: 4240, y: 3880, w: 250, h: 170, entrance: { x: 4365, y: 4060 } }
  );
  assert.deepEqual(
    { x: blacksmith.x, y: blacksmith.y, w: blacksmith.w, h: blacksmith.h },
    { x: 3710, y: 3850, w: 182, h: 162 }
  );
});

test('visual map source includes authored roads, river, groves and bridges', () => {
  const map = getAuthoredMap(MAP_IDS.overworld);
  assert.ok(map.roads.length >= 5);
  assert.ok(map.river.points.length >= 5);
  assert.ok(map.groves.length >= 3);
  assert.ok(map.bridges.length >= 1);
});

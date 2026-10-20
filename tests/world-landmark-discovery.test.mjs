import test from "node:test";
import assert from "node:assert/strict";
import { MAP_IDS, getAuthoredMap } from "../src/world/authored-maps.mjs";
import {
  DISCOVERY_MANIFEST_VERSION, MOONVALE_LANDMARKS,
  createLocalDiscoveryJournal, recordLocalDiscoveries, localDiscoveryProgress,
} from "../src/world/landmark-discovery.mjs";

test("D1 authored landmarks have stable, unique IDs and valid approach points", () => {
  assert.equal(DISCOVERY_MANIFEST_VERSION, 1);
  const map = getAuthoredMap(MAP_IDS.overworld);
  assert.equal(MOONVALE_LANDMARKS.length, 4);
  assert.equal(new Set(MOONVALE_LANDMARKS.map(s => s.id)).size, MOONVALE_LANDMARKS.length);
  for (const site of MOONVALE_LANDMARKS) {
    assert.ok(Object.isFrozen(site));
    assert.match(site.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.equal(site.mapId, map.id);
    assert.ok(site.x >= 18 && site.x <= map.width - 18);
    assert.ok(site.y >= 18 && site.y <= map.height - 18);
    assert.ok(site.radius >= 32 && site.radius <= 150);
    assert.ok(site.clue.length > 10 && site.story.length > 10);
  }
});

test("D1 visits produce deterministic one-time journal entries in manifest order", () => {
  const journal = createLocalDiscoveryJournal();
  assert.deepEqual(localDiscoveryProgress(journal), { visited: 0, total: 4 });
  for (const site of MOONVALE_LANDMARKS) {
    assert.deepEqual(recordLocalDiscoveries(journal, site.mapId, site.x, site.y).map(s => s.id), [site.id]);
    assert.deepEqual(recordLocalDiscoveries(journal, site.mapId, site.x, site.y), []);
  }
  assert.deepEqual(localDiscoveryProgress(journal), { visited: 4, total: 4 });
  const again = createLocalDiscoveryJournal();
  assert.deepEqual(MOONVALE_LANDMARKS.flatMap(s =>
    recordLocalDiscoveries(again, s.mapId, s.x, s.y).map(p => p.id)),
  MOONVALE_LANDMARKS.map(s => s.id));
});

test("D1 discovery uses inclusive radius and never reveals places remotely", () => {
  const site = MOONVALE_LANDMARKS[2];
  const journal = createLocalDiscoveryJournal();
  assert.deepEqual(recordLocalDiscoveries(journal, site.mapId, site.x + site.radius + .01, site.y), []);
  assert.equal(journal.size, 0);
  assert.deepEqual(recordLocalDiscoveries(journal, site.mapId, site.x + site.radius, site.y).map(s => s.id), [site.id]);
});

test("D1 invalid coordinates, maps, or journal objects fail closed", () => {
  const journal = createLocalDiscoveryJournal();
  const site = MOONVALE_LANDMARKS[0];
  for (const [id, x, y] of [
    [MAP_IDS.tavern, site.x, site.y],
    ["missing-map", site.x, site.y],
    [site.mapId, Number.NaN, site.y],
    [site.mapId, Infinity, site.y],
    [site.mapId, site.x, -1],
    [site.mapId, 8193, site.y],
    [site.mapId, site.x, Number.NEGATIVE_INFINITY],
  ]) assert.deepEqual(recordLocalDiscoveries(journal, id, x, y), []);
  assert.deepEqual(recordLocalDiscoveries({}, site.mapId, site.x, site.y), []);
  assert.equal(journal.size, 0);
  assert.deepEqual(localDiscoveryProgress(null), { visited: 0, total: 4 });
});

test("D1 journal is session-local; independent visitors never share discoveries", () => {
  const first = createLocalDiscoveryJournal();
  const second = createLocalDiscoveryJournal();
  const site = MOONVALE_LANDMARKS[0];
  assert.equal(recordLocalDiscoveries(first, site.mapId, site.x, site.y).length, 1);
  assert.deepEqual(localDiscoveryProgress(second), { visited: 0, total: 4 });
  assert.equal(recordLocalDiscoveries(second, site.mapId, site.x, site.y).length, 1);
  assert.deepEqual(localDiscoveryProgress(createLocalDiscoveryJournal()), { visited: 0, total: 4 });
});

test("D1 cannot count fabricated IDs or issue loot by visiting a place", () => {
  const journal = createLocalDiscoveryJournal();
  journal.add("fabricated-place");
  assert.deepEqual(localDiscoveryProgress(journal), { visited: 0, total: 4 });
  const site = MOONVALE_LANDMARKS[0];
  const discoveries = recordLocalDiscoveries(journal, site.mapId, site.x, site.y);
  assert.deepEqual(discoveries.map(x => Object.keys(x)),
    [Object.keys(site)]);
  assert.equal(discoveries[0].id, site.id);
  assert.deepEqual(localDiscoveryProgress(journal), { visited: 1, total: 4 });
});

// World & Gameplay D1: authored landmarks for a local, visual-only discovery journal.
// This module cannot award items, change player state, authorize transfers or record
// persistent multiplayer progress. Server-owned discovery is a later contract.
import { MAP_IDS, getAuthoredMap } from "./authored-maps.mjs";

export const DISCOVERY_MANIFEST_VERSION = 1;

// Stable IDs are the save-schema boundary for any future server-side journal.
// Approach points lie on existing paths or outside building footprints.
export const MOONVALE_LANDMARKS = Object.freeze([
  Object.freeze({
    id: "greyhaven-red-lion",
    mapId: MAP_IDS.overworld,
    name: "The Red Lion",
    x: 4365, y: 4075, radius: 96,
    clue: "Somewhere in Greyhaven, warm lamplight gathers beneath a red sign.",
    story: "A meeting place on Greyhaven's busy streets.",
  }),
  Object.freeze({
    id: "greyhaven-market",
    mapId: MAP_IDS.overworld,
    name: "Greyhaven Market",
    x: 4450, y: 4250, radius: 86,
    clue: "Listen for the market near the eastern quarter of Greyhaven.",
    story: "A crossroads for future traders and craftspeople.",
  }),
  Object.freeze({
    id: "west-road-old-mill",
    mapId: MAP_IDS.overworld,
    name: "The Old Mill",
    x: 2815, y: 4100, radius: 110,
    clue: "The westward road passes an old mill outside the city.",
    story: "A weathered landmark above the western farms.",
  }),
  Object.freeze({
    id: "north-road-watch-ruin",
    mapId: MAP_IDS.overworld,
    name: "The Fallen Watch",
    x: 3210, y: 2070, radius: 125,
    clue: "Far along the northern road, an old watchpost has gone silent.",
    story: "Ruins recall a frontier that was not always peaceful.",
  }),
]);

// Caller owns its Set; no storage, player identity, rewards or global mutation.
export function createLocalDiscoveryJournal() {
  return new Set();
}

export function recordLocalDiscoveries(journal, mapId, x, y) {
  if (!(journal instanceof Set) || mapId !== MAP_IDS.overworld
    || !Number.isFinite(x) || !Number.isFinite(y)) return [];
  const map = getAuthoredMap(mapId);
  if (!map || x < 0 || y < 0 || x > map.width || y > map.height) return [];
  const newlyFound = [];
  for (const site of MOONVALE_LANDMARKS) {
    const dx = x - site.x, dy = y - site.y;
    if (!journal.has(site.id) && dx * dx + dy * dy <= site.radius * site.radius) {
      journal.add(site.id);
      newlyFound.push(site);
    }
  }
  return newlyFound;
}

export function localDiscoveryProgress(journal) {
  const visited = journal instanceof Set
    ? MOONVALE_LANDMARKS.reduce((n, site) => n + Number(journal.has(site.id)), 0)
    : 0;
  return Object.freeze({ visited, total: MOONVALE_LANDMARKS.length });
}

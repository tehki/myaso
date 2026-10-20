// D6 authored field-survey points for OFFLINE Moonvale exploration only.
// Observation is a local note, never a harvested item, economic entitlement,
// skill gain, server state, world entity, resource respawn or inventory grant.
import { MAP_IDS, getAuthoredMap } from "./authored-maps.mjs";
import { isAuthoredPreviewWalkable, PREVIEW_FIGHTER_RADIUS } from "./authored-preview-collision.mjs";

export const FIELD_SURVEY_MANIFEST_VERSION = 1;
export const FIELD_SURVEY_REACH = 68;

// Fixed designer-authored natural sites, with explicit approach points.
// Categories are descriptive; no stock quantity/harvest/monetary value exists.
export const MOONVALE_FIELD_SITES = Object.freeze([
  Object.freeze({
    id: "greyhaven-road-herbs", name: "Roadside Herbs", category: "botany",
    mapId: MAP_IDS.overworld, x: 4610, y: 4260,
    clue: "The eastern approach to Greyhaven shelters tough roadside herbs.",
    observation: "Lowland plant cover grows near the city's busy roads.",
  }),
  Object.freeze({
    id: "mill-field-flax", name: "Millfield Flax", category: "botany",
    mapId: MAP_IDS.overworld, x: 2915, y: 4160,
    clue: "Past the old mill, fields once fed a forgotten trade.",
    observation: "Fibrous stems could be useful to a future crafting profession.",
  }),
  Object.freeze({
    id: "west-bank-reeds", name: "River Reeds", category: "botany",
    mapId: MAP_IDS.overworld, x: 1780, y: 4260,
    clue: "The western bridge overlooks reeds above the riverbank.",
    observation: "Wetland vegetation marks the river's changing shoreline.",
  }),
  Object.freeze({
    id: "west-road-stone", name: "Roadside Stone", category: "geology",
    mapId: MAP_IDS.overworld, x: 2540, y: 4120,
    clue: "A stone outcrop lies beside the King's Road west of Greyhaven.",
    observation: "Broken sedimentary rock is exposed beside the old roadway.",
  }),
  Object.freeze({
    id: "fallen-watch-iron", name: "Watchpost Ore", category: "geology",
    mapId: MAP_IDS.overworld, x: 3220, y: 2110,
    clue: "Look for exposed ore on the southern approach to the Fallen Watch.",
    observation: "Dark mineral traces weather beneath the ancient watchpost.",
  }),
  Object.freeze({
    id: "stonebrook-clay", name: "Stonebrook Clay", category: "geology",
    mapId: MAP_IDS.overworld, x: 6480, y: 4110,
    clue: "Earthen deposits gather south of Stonebrook's cottages.",
    observation: "The moist ground holds dense clay deposits.",
  }),
  Object.freeze({
    id: "south-farm-berries", name: "Hedgerow Berries", category: "botany",
    mapId: MAP_IDS.overworld, x: 4810, y: 5550,
    clue: "Beyond Greyhaven's southern farms, a hedgerow bears small berries.",
    observation: "The hedge supports seasonal wild fruit and pollinators.",
  }),
  Object.freeze({
    id: "eastern-grove-timber", name: "Eastern Oak", category: "forestry",
    mapId: MAP_IDS.overworld, x: 5810, y: 5740,
    clue: "An old stand of trees rises east of the southern road.",
    observation: "Broadleaf growth marks a sheltered patch of eastern woodland.",
  }),
]);

export function createLocalFieldNotebook() {
  return new Set();
}

function validSurveyPosition(mapId, x, y) {
  const map = getAuthoredMap(mapId);
  return Boolean(map && mapId === MAP_IDS.overworld &&
    Number.isFinite(x) && Number.isFinite(y) &&
    isAuthoredPreviewWalkable(mapId, x, y, PREVIEW_FIGHTER_RADIUS));
}

// Geometric proximity *alone* never grants anything. The caller invokes
// observeLocalFieldSite only on an explicit F-key press, not on every frame.
// Ties are resolved by immutable manifest order; no per-frame allocations.
export function nearbyLocalFieldSite(mapId, x, y) {
  if (!validSurveyPosition(mapId, x, y)) return null;
  let chosen = null, distance = FIELD_SURVEY_REACH * FIELD_SURVEY_REACH;
  for (const site of MOONVALE_FIELD_SITES) {
    const dx = site.x - x, dy = site.y - y;
    const d2 = dx * dx + dy * dy;
    if (d2 < distance && isAuthoredPreviewWalkable(mapId, site.x, site.y,
      PREVIEW_FIGHTER_RADIUS)) {
      chosen = site;
      distance = d2;
    }
  }
  return chosen;
}

// Idempotent once-per-session notes; ignores forged notebooks/map/coordinates.
// A note cannot be used as proof for future server-side inventory/XP claims.
export function observeLocalFieldSite(notebook, mapId, x, y) {
  if (!(notebook instanceof Set)) return null;
  const site = nearbyLocalFieldSite(mapId, x, y);
  if (!site || notebook.has(site.id)) return null;
  notebook.add(site.id);
  return site;
}

export function localFieldSurveyProgress(notebook) {
  const documented = notebook instanceof Set
    ? MOONVALE_FIELD_SITES.reduce((n, site) => n + Number(notebook.has(site.id)), 0)
    : 0;
  return Object.freeze({ documented, total: MOONVALE_FIELD_SITES.length });
}

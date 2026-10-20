// World & Gameplay D7 — OFFLINE Moonvale expeditions.
// A route is a sequence of local walking/inspection milestones. It cannot
// confer rewards, items, achievements, money, XP, persistent player progress
// or multiplayer rights. The server never loads or trusts this module.
import { MAP_IDS } from "./authored-maps.mjs";
import { isAuthoredPreviewWalkable } from "./authored-preview-collision.mjs";
import { MOONVALE_LANDMARKS } from "./landmark-discovery.mjs";
import { FIELD_SURVEY_REACH, MOONVALE_FIELD_SITES } from "./field-survey.mjs";

export const LOCAL_EXPEDITION_VERSION = 1;
const landmark = id => {
  const site = MOONVALE_LANDMARKS.find(s => s.id === id);
  if (!site) throw new Error("Unknown authored expedition landmark: " + id);
  return Object.freeze({ action: "visit", site });
};
const field = id => {
  const site = MOONVALE_FIELD_SITES.find(s => s.id === id);
  if (!site) throw new Error("Unknown authored expedition survey: " + id);
  return Object.freeze({ action: "inspect", site });
};
const expedition = (id, name, story, steps) => Object.freeze({
  id, name, story, steps: Object.freeze(steps),
});

// Each route is a small authored narrative, not an economy/quest ledger.
// Completion only changes the current preview's UI.
export const MOONVALE_EXPEDITIONS = Object.freeze([
  expedition("greyhaven-circuit", "Greyhaven Circuit",
    "Begin at the Red Lion, study the east road and return to the market.", [
      landmark("greyhaven-red-lion"),
      field("greyhaven-road-herbs"),
      landmark("greyhaven-market"),
    ]),
  expedition("western-survey", "The Western Survey",
    "Follow the King's Road toward the Old Mill and cross the western bridge.", [
      landmark("greyhaven-market"),
      landmark("west-road-old-mill"),
      field("west-road-stone"),
      field("west-bank-reeds"),
    ]),
  expedition("fallen-watch", "The Fallen Watch",
    "Leave the Red Lion behind, find the northern ruins, inspect nearby ore.", [
      landmark("greyhaven-red-lion"),
      landmark("north-road-watch-ruin"),
      field("fallen-watch-iron"),
    ]),
]);

function knownRoute(state) {
  if (!state || typeof state !== "object") return null;
  return MOONVALE_EXPEDITIONS.find(e => e.id === state.routeId) ?? null;
}
export function createLocalExpeditionState() {
  return { routeId: null, stepIndex: 0 };
}

export function chooseLocalExpedition(state, routeId) {
  if (!state || typeof state !== "object" ||
      !Object.hasOwn(state, "routeId") || !Object.hasOwn(state, "stepIndex")) return false;
  const route = MOONVALE_EXPEDITIONS.find(e => e.id === routeId);
  if (!route) return false;
  state.routeId = route.id;
  state.stepIndex = 0;
  return true;
}

export function localExpeditionProgress(state) {
  const route = knownRoute(state);
  const valid = route && Number.isInteger(state.stepIndex)
    && state.stepIndex >= 0 && state.stepIndex <= route.steps.length;
  const index = valid ? state.stepIndex : 0;
  return Object.freeze({
    route: valid ? route : null,
    stepsCompleted: index,
    total: valid ? route.steps.length : 0,
    nextStep: valid ? (route.steps[index] ?? null) : null,
    finished: Boolean(valid && index === route.steps.length),
  });
}

// Called by the preview only for a physical visit (one check per animation
// frame) or a deliberate F-key inspect event. No route stage can be credited
// remotely, from blocked geometry, from another map, or out of order.
export function advanceLocalExpedition(state, mapId, x, y, action = "visit") {
  const progress = localExpeditionProgress(state);
  const next = progress.nextStep;
  if (!next || action !== next.action || mapId !== MAP_IDS.overworld
    || !Number.isFinite(x) || !Number.isFinite(y)
    || !isAuthoredPreviewWalkable(mapId, x, y)) return null;
  const radius = next.action === "inspect" ? FIELD_SURVEY_REACH : next.site.radius;
  const dx = next.site.x - x, dy = next.site.y - y;
  if (dx * dx + dy * dy > radius * radius) return null;
  state.stepIndex += 1;
  return Object.freeze({
    completedStep: next,
    finished: state.stepIndex === progress.route.steps.length,
  });
}

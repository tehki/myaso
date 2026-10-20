// D9 offline-only lookups for fixed, build-time collision-certified trails.
// This module performs ZERO path search at runtime and never grants progress,
// authority, network transfers, loot, items or persistent quest completion.
import { MAP_IDS } from "./authored-maps.mjs";
import { localExpeditionProgress } from "./local-expeditions.mjs";
import { CERTIFIED_TRAILS } from "./certified-trails.mjs";

// Paths are anchored from the PREVIOUS completed expedition milestone to the
// NEXT milestone. They are never claimed to be from the player's actual position.
export function certifiedTrailForNext(state,mapId) {
  if(mapId!==MAP_IDS.overworld)return null;
  const progress=localExpeditionProgress(state);
  if(!progress.route || progress.stepsCompleted<1 || !progress.nextStep)return null;
  const from=progress.route.steps[progress.stepsCompleted-1].site.id;
  const to=progress.nextStep.site.id;
  return CERTIFIED_TRAILS.find(trail=>trail.from===from && trail.to===to)??null;
}

// A trail is guidance only. Picking a stage never teleports, advances,
// or sets the player's position; completion uses D7 normal local proximity.
export function localTrailDescription(state,mapId) {
  const trail=certifiedTrailForNext(state,mapId);
  return trail?Object.freeze({
    from:trail.from,to:trail.to,waypoints:trail.points.length,
    caution:"Surveyed corridor joins expedition milestones; rejoin it on foot.",
  }):null;
}

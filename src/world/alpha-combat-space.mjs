// Moon Games / Department 9 — P0 authored Blacksmith-side melee clearing.
//
// This is an existing open part of Greyhaven, not a new zone or a server-owned
// combat arena. Coordinates are authored gameplay fixtures only. Core/Physics
// remain responsible for complete same-tick collision, dynamic players, world
// authority, authoritative roll/knockback and Combat state.
import { MAP_IDS } from "./authored-maps.mjs";

const point=(x,y)=>Object.freeze({x,y});

export const WORLD_ALPHA_COMBAT_SPACE_VERSION=1;
export const WORLD_ALPHA_COMBAT_SPACE=Object.freeze({
  id:"greyhaven-smith-south-courtyard",
  mapId:MAP_IDS.overworld,
  adjacentBuildingId:"smith",
  layout:"outdoor-shared-world",
  requiresZoneTransfer:false,
  hasCombatAuthority:false,
  // A contiguous clearing south of the four open-front Blacksmith sockets.
  // All authored boundaries must stay clear of a radius-18 character.
  bounds:Object.freeze({min_x:3700,min_y:4120,max_x:3940,max_y:4360}),
  referenceActorRadius:18,
  // Four independent visual/QA positions, not required network spawn slots.
  stations:Object.freeze([
    point(3740,4200),point(3860,4200),
    point(3740,4290),point(3860,4290),
  ]),
  // Static space to test mouse-directed movement from eight headings.
  // The 64-unit test probe is a World clearance sample, not a Combat roll
  // distance, live ability tuning or client-authoritative movement.
  directionalProbe:Object.freeze({origin:point(3820,4240),length:64}),
});

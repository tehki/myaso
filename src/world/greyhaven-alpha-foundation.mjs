// Greyhaven's original designer-authored exterior, for World9 preview and
// Core8C/Physics review. NEVER a client-side movement/collision authority.
import {MAP_IDS,getAuthoredMap} from "./authored-maps.mjs";
import {WORLD_ALPHA_GREYHAVEN_STATIC_SOLIDS,WORLD_ALPHA_SOLIDS_LAYOUT_ID}
  from "./alpha-solid-geometry.mjs";
import {worldBuildingPresentation} from "./building-presentation.mjs";

const point=(x,y)=>Object.freeze({x,y});
export const GREYHAVEN_ALPHA_FOUNDATION=Object.freeze({
  version:1,
  mapId:MAP_IDS.overworld,
  cityId:"greyhaven",
  kind:"outdoor",
  serverPreviewEnv:"MYASO_WORLD9_GREYHAVEN_ALPHA",
  staticLayoutId:WORLD_ALPHA_SOLIDS_LAYOUT_ID,
  serverStaticCollisionMode:"explicit-loopback-only-opt-in",
  serverStaticCollisionActiveByDefault:false,
  hasPortalAuthority:false,
  hasItemAuthority:false,
  spawns:Object.freeze([
    point(4110,4160),point(4206,4160),
    point(4110,4256),point(4206,4256),
  ]),
  landmarks:Object.freeze({
    smith:point(3820,4088),
    redLionDoor:point(4365,4060),
    redLionWalkableApproach:point(4365,4080),
    marketWest:point(4230,4380),
    chapelSouth:point(4590,3850),
  }),
  // Route is a static authored navigation *suggestion*, not a server pathfinder.
  // All legs are south of original collision footprints or on open town roads.
  route:Object.freeze([
    point(4110,4160),point(4000,4160),point(4000,4088),
    point(3820,4088),point(4000,4088),point(4110,4088),
    point(4110,4160),point(4365,4160),point(4365,4080),
    point(4365,4160),point(4230,4160),point(4230,4380),
    point(4230,4160),point(4590,4160),point(4590,3850),
  ]),
});

export function validateGreyhavenAlphaFoundation() {
  const map=getAuthoredMap(MAP_IDS.overworld);
  const city=map?.city;
  const lion=map?.buildings.find(b=>b.id==="red-lion");
  const smith=map?.buildings.find(b=>b.id==="smith");
  const view=worldBuildingPresentation(MAP_IDS.overworld,"red-lion",[]);
  if(map?.kind!=="outdoor"||city?.id!=="greyhaven"||
    map.width!==8192||map.height!==8192||
    city.x!==3520||city.y!==3460||
    lion?.x!==4240||lion?.y!==3880||lion?.w!==250||lion?.h!==170||
    lion.entrance?.x!==4365||lion.entrance?.y!==4060||
    smith?.x!==3710||smith?.y!==3850||smith?.w!==182||smith?.h!==162||
    smith.entrance!==undefined||view?.visualDepthY!==4075||
    WORLD_ALPHA_GREYHAVEN_STATIC_SOLIDS.length!==23)
    throw new Error("Greyhaven authored source contract mismatch");
  return {map,city,lion,smith,view};
}

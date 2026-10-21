/**
 * Graphics 3B → World & Gameplay First Playable attachment, A2.35.
 *
 * Source-only pixel art placement. This cannot authorize collisions, portals,
 * depth classification, player movement, indoor state, or world tile mutations.
 * World owns removal of the Red Lion placeholder; this adapter does not do it.
 */
import {ARENA_VIEW_ZOOM,projectArenaPoint} from "./arena-viewport.mjs";

export const RED_LION_ALPHA_ART = Object.freeze({
  buildingId: "red-lion",
  worldFootprint: Object.freeze({x:4240,y:3880,w:250,h:170}),
  authoredEntrance: Object.freeze({x:4365,y:4060}),
  visualDoor: Object.freeze({x:4365,y:4075}),
  threeCFixture: Object.freeze({x:4365,y:4045}),
  day: Object.freeze({
    src:"../assets/environment/greyhaven/a231-review/red_lion_a231_day_dimensional.webp",
    sha256:"f45ca685364666e7911128b75180eb1dea5636b48ab2ae5538cc37523ec2dfd0",
    width:228,height:297,offsetX:-114,offsetY:-269,
  }),
  dusk: Object.freeze({
    src:"../assets/environment/greyhaven/a231-review/red_lion_a231_dusk_dimensional.webp",
    sha256:"4b7d58f1dc3469ec612c3ac861089ed6665c2118fa27eb7b2fbb1914f55776c3",
    width:228,height:297,offsetX:-114,offsetY:-269,
  }),
  roof: Object.freeze({
    src:"../assets/environment/greyhaven/a231-review/red_lion_a231_roof_unchanged.webp",
    sha256:"f65554286ea1bb8b80562c72539d82172fd3ea8cc97e6b9d0d3203057a1aedc1",
    width:238,height:197,offsetX:-119,offsetY:-283,
  }),
  facadeStage: "world-owned-foreground-attachment",
  roofStage: "world-owned-roof-presentation",
  placeholderPolicy: "world-must-suppress-one-red-lion-placeholder",
  lightingPolicy: "three-c-owns-one-outdoor-lantern-no-three-b-radial-glow",
  serverMutation: false,
  runtimeIntegrationApproved: false,
  alphaGameplayApproved: false,
});

function compatibleWorldBuilding(building) {
  const f=RED_LION_ALPHA_ART.worldFootprint;
  const e=RED_LION_ALPHA_ART.authoredEntrance;
  return !!building && building.id===RED_LION_ALPHA_ART.buildingId &&
    building.x===f.x && building.y===f.y &&
    building.w===f.w && building.h===f.h &&
    building.entrance?.x===e.x && building.entrance?.y===e.y;
}

/**
 * Builds deterministic SCREEN-SPACE placement commands for an external World
 * compositor. Does not paint, import World code, remove placeholders or
 * classify fighter depth. Camera must be a validated client presentation
 * position, never a source of gameplay authority.
 */
export function createRedLionAlphaArtAttachment({
  building,
  camera,
  width=640,
  height=640,
  zoom=ARENA_VIEW_ZOOM,
  mood="day",
}={}) {
  if(!compatibleWorldBuilding(building))
    throw new RangeError("Red Lion World building identity/footprint/entrance mismatch");
  if(mood!=="day"&&mood!=="dusk")
    throw new RangeError("mood must be day or dusk");
  if(!camera || ![camera.x,camera.y,width,height,zoom].every(Number.isFinite) ||
    width<=0||height<=0||zoom<=0||zoom>1)
    throw new RangeError("invalid visual camera");
  const visual=RED_LION_ALPHA_ART.visualDoor;
  const position=projectArenaPoint(visual.x,visual.y,camera.x,camera.y,width,height,zoom);
  const command=(type,asset)=>Object.freeze({
    type,src:asset.src,sha256:asset.sha256,
    x:position.x+asset.offsetX,y:position.y+asset.offsetY,
    width:asset.width,height:asset.height,
    screenSpace:true,renderOnly:true,
  });
  return Object.freeze({
    buildingId:RED_LION_ALPHA_ART.buildingId,
    sourceMood:mood,
    visualDoorScreen:Object.freeze({x:position.x,y:position.y}),
    authoredEntrance:RED_LION_ALPHA_ART.authoredEntrance,
    visualDoor:RED_LION_ALPHA_ART.visualDoor,
    threeCFixture:RED_LION_ALPHA_ART.threeCFixture,
    facade:command("facade",RED_LION_ALPHA_ART[mood]),
    roof:command("roof",RED_LION_ALPHA_ART.roof),
    placeholderPolicy:RED_LION_ALPHA_ART.placeholderPolicy,
    lightingPolicy:RED_LION_ALPHA_ART.lightingPolicy,
    worldMustProvideOcclusionSemantics:true,
    actualWorldRendererIntegrated:false,
    portalOrCollisionChanged:false,
    productionApproved:false,
  });
}

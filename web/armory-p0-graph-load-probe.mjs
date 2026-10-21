// Graphics 3B P0 narrow source graph isolation — imports ORIGINAL files,
// byte-for-byte, from independent World/3B source. No game client/runtime.
export async function loadSourceGroup(mode) {
  if(!["world","graphics","graph","draw"].includes(mode))
    throw Error("Unexpected source group");
  const world = mode==="world"||mode==="graph"||mode==="draw";
  const graphics = mode==="graphics"||mode==="graph"||mode==="draw";
  let w=null,g=null;
  if(world){
    const [
      {createAuthoredWorldRenderer},
      {WORLD_ALPHA_ARMORY,WORLD_ALPHA_ARMORY_VERSION,validateWorldAlphaArmoryLayout},
      {MAP_IDS,getAuthoredMap}
    ]=await Promise.all([
      import("/__worldsource__/src/browser/authored-world-renderer.mjs"),
      import("/__worldsource__/src/world/alpha-armory.mjs"),
      import("/__worldsource__/src/world/authored-maps.mjs")
    ]);
    if(!validateWorldAlphaArmoryLayout()||
      WORLD_ALPHA_ARMORY_VERSION!==1||WORLD_ALPHA_ARMORY.rackSockets.length!==4)
      throw Error("Unrecognized exact original World four-socket layout");
    w={createAuthoredWorldRenderer,WORLD_ALPHA_ARMORY,
      WORLD_ALPHA_ARMORY_VERSION,MAP_IDS,getAuthoredMap};
  }
  if(graphics){
    const [
      {createWorld493RackArtPlan},
      {ARMORY_RACK_ART},
      {createArmorySwordAlphaSampler},
      {paintArmoryRackPresentedFrame}
    ]=await Promise.all([
      import("../src/browser/armory-world493-visual-bridge.mjs"),
      import("../src/browser/armory-rack-visual.mjs"),
      import("../src/browser/armory-sword-alpha-sampler.mjs"),
      import("../src/browser/armory-rack-presented-frame.mjs")
    ]);
    g={createWorld493RackArtPlan,ARMORY_RACK_ART,
      createArmorySwordAlphaSampler,paintArmoryRackPresentedFrame};
  }
  return Object.freeze({...w,...g,loadedWorld:world,loadedGraphics:graphics});
}

/**
 * Moon Games Graphics 3B P0 — opt-in original Blacksmith rack in the ACTUAL
 * rendered Greyhaven client. Default OFF, loopback-only, no item writer.
 *
 * WORLD #521 original authored outdoor Blacksmith sockets are copied unchanged.
 * Core #577 remains a dormant proposal: no signed current-rack item feed exists.
 * Therefore there are ZERO rendered rack swords in this actual client bridge.
 *
 * This module NEVER guesses four item IDs, sends TryPickup, suppresses Combat,
 * or equips an avatar. The original wood/iron rack is terrain decoration.
 */
import {WORLD_ALPHA_ARMORY,WORLD_ALPHA_ARMORY_VERSION,
  validateWorldAlphaArmoryLayout} from "../world/alpha-armory.mjs";
import {MAP_IDS,getAuthoredMap} from "../world/authored-maps.mjs";
import {ARMORY_RACK_ART} from "./armory-rack-visual.mjs";
import {createWorld493RackArtPlan} from "./armory-world493-visual-bridge.mjs";
import {createArmorySwordAlphaSampler} from "./armory-sword-alpha-sampler.mjs";
import {paintArmoryRackPresentedFrame} from "./armory-rack-presented-frame.mjs";

export const OPTIN_ARMORY_VISUAL_CONTRACT=Object.freeze({
  sourceWorldLayoutVersion:1,
  sourceBuilding:"smith",
  authorizesItemIds:false,
  activeServerWriter:false,
  requiresSourceCommittedRackItems:true,
  actualClientRackWithoutServerItems:true,
  actualClientSwordsBeforeAuthoritativeFeed:0,
  canSuppressCombat:false,
  productionApproved:false
});
const LOOPBACK=new Set(["localhost","127.0.0.1","[::1]"]);
export function isOriginalArmoryPreviewEnabled(url) {
  try {
    const u=new URL(url);
    return (u.protocol==="http:"||u.protocol==="https:") &&
      LOOPBACK.has(u.hostname) &&
      u.searchParams.get("world")==="1" &&
      u.searchParams.get("armoryart")==="1" &&
      !u.searchParams.has("scenario");
  }catch{return false;}
}
async function sourceImage(path){
  const image=new Image();
  image.src=path;
  await image.decode();
  if(!image.complete)throw new Error("Original rack source not complete");
  return image;
}
/**
 * SOURCE ONLY: caller gives no canonical server snapshot because none exists.
 * Caller owns the real World frame and actor depth; no other renderer is
 * installed. Await image decoding before any frame can present the rack.
 */
export async function loadOriginalBlacksmithRackPreview({
  imageLoader=sourceImage,
  alphaCanvasFactory
}={}) {
  if(typeof imageLoader!=="function"||!validateWorldAlphaArmoryLayout()||
     WORLD_ALPHA_ARMORY_VERSION!==OPTIN_ARMORY_VISUAL_CONTRACT.sourceWorldLayoutVersion||
     WORLD_ALPHA_ARMORY.mapId!==MAP_IDS.overworld)
    throw new Error("Original World/source image loader not ready");
  const map=getAuthoredMap(MAP_IDS.overworld);
  const [rackImage,swordImage]=await Promise.all([
    imageLoader(ARMORY_RACK_ART.rackSource),
    imageLoader(ARMORY_RACK_ART.swordSource)
  ]);
  const alphaSampler=createArmorySwordAlphaSampler(swordImage,{
    ...(alphaCanvasFactory?{canvasFactory:alphaCanvasFactory}:{})
  });
  let frame=0,last=null;
  function draw({ctx,camera,width,height,zoom}={}) {
    // Empty exact Core writer: no visual swords can be invented by graphics.
    const plan=createWorld493RackArtPlan({
      worldArmory:WORLD_ALPHA_ARMORY,authoredMap:map,
      layoutVersion:WORLD_ALPHA_ARMORY_VERSION,
      committedWorldItems:[],camera,width,height,zoom
    });
    const presented=paintArmoryRackPresentedFrame({
      ctx,plan,rackImage,swordImage,alphaSampler,frameId:frame+1
    });
    frame++;
    last=Object.freeze({
      renderedFrames:frame,drawnRackCount:presented.drawnRackCount,
      drawnSwordCount:presented.drawnSwordCount,
      originalWorldSockets:WORLD_ALPHA_ARMORY.rackSockets.length,
      actualGameRender:true,canonicalItemFeedConnected:false,
      serverTryPickup:false,productionApproved:false
    });
    return last;
  }
  return Object.freeze({
    draw,
    status:()=>last,
    actualClientArt:true,actualAuthenticatedItemFeed:false,
    originalSwordSourceDecoded:true,
    productionApproved:false
  });
}

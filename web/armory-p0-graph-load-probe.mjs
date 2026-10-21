// Graphics 3B P0 narrow original-source graph load diagnostic, not game client.
import {createAuthoredWorldRenderer} from "/__world521__/src/browser/authored-world-renderer.mjs";
import {WORLD_ALPHA_ARMORY,WORLD_ALPHA_ARMORY_VERSION,validateWorldAlphaArmoryLayout} from "/__world521__/src/world/alpha-armory.mjs";
import {MAP_IDS,getAuthoredMap} from "/__world521__/src/world/authored-maps.mjs";
import {createWorld493RackArtPlan} from "../src/browser/armory-world493-visual-bridge.mjs";
import {ARMORY_RACK_ART} from "../src/browser/armory-rack-visual.mjs";
import {createArmorySwordAlphaSampler} from "../src/browser/armory-sword-alpha-sampler.mjs";
import {paintArmoryRackPresentedFrame} from "../src/browser/armory-rack-presented-frame.mjs";

if(!validateWorldAlphaArmoryLayout())throw new Error("External World fixture invalid");
const p=window.__graphProbe;
p.log.push({stage:"graph:ready",at:performance.now(),socketCount:WORLD_ALPHA_ARMORY.rackSockets.length});
if(WORLD_ALPHA_ARMORY.rackSockets.length!==4||WORLD_ALPHA_ARMORY_VERSION!==1)
 throw new Error("Unrecognized original four World socket contract");
window.__graphProbeGraphics={ARMORY_RACK_ART,createWorld493RackArtPlan,
 createArmorySwordAlphaSampler,paintArmoryRackPresentedFrame,
 createAuthoredWorldRenderer,MAP_IDS,getAuthoredMap,WORLD_ALPHA_ARMORY,
 WORLD_ALPHA_ARMORY_VERSION};

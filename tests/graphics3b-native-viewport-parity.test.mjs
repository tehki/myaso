import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
 P0_CONTENT_VIEWPORT,nativeContentViewportMatches,nextNativeW3cWindowRect
} from "../scripts/graphics3b_native_viewport_parity.mjs";
const chrome={innerWidth:1280,innerHeight:761,outerWidth:1280,outerHeight:900};
const firefox={innerWidth:1366,innerHeight:682,outerWidth:1366,outerHeight:768};
test("P0 browser parity detects DIFFERENT original Chrome/Firefox viewport sizes",()=>{
 assert.equal(nativeContentViewportMatches(chrome),false);
 assert.equal(nativeContentViewportMatches(firefox),false);
 assert.deepEqual(P0_CONTENT_VIEWPORT,{width:1280,height:720});
});
test("P0 computes real W3C outer dimensions, not inner target sizes",()=>{
 assert.deepEqual(nextNativeW3cWindowRect(chrome),{width:1280,height:859});
 assert.deepEqual(nextNativeW3cWindowRect(firefox),{width:1280,height:806});
 assert.equal(nativeContentViewportMatches({...chrome,innerHeight:720}),true);
 assert.equal(nativeContentViewportMatches({...firefox,innerWidth:1280,innerHeight:720}),true);
});
test("P0 browser parity converges with browser-decorations independent of engine",()=>{
 const prev={...firefox,innerWidth:1272,innerHeight:716,outerWidth:1280,outerHeight:802};
 assert.deepEqual(nextNativeW3cWindowRect(prev),{width:1288,height:806});
});
test("P0 parity fails closed for malformed or impossible viewports",()=>{
 for(const v of [
  {innerWidth:NaN,innerHeight:720,outerWidth:1280,outerHeight:900},
  {innerWidth:1280,innerHeight:720,outerWidth:1000,outerHeight:900},
  {innerWidth:1280,innerHeight:720,outerWidth:1280,outerHeight:100},
  {innerWidth:1280,innerHeight:720,outerWidth:1280,outerHeight:Infinity},
  {...chrome,innerHeight:"761"}
 ])assert.throws(()=>nextNativeW3cWindowRect(v));
 assert.throws(()=>nextNativeW3cWindowRect(chrome,{width:600,height:300}));
 assert.equal(nativeContentViewportMatches({innerWidth:"1280",innerHeight:720}),false);
});
test("P0 real WebDriver experiment is opt-in and uses original screenshots/player movement",()=>{
 const script=readFileSync(new URL("alpha_p0_four_native_rack_at_approaches.mjs",new URL("../scripts/",import.meta.url)),"utf8");
 assert.match(script,/GRAPHICS3B_P0_VIEWPORT_PARITY/);
 assert.match(script,/nextNativeW3cWindowRect/);
 assert.match(script,/nativeContentViewportMatches/);
 assert.match(script,/window\/rect/);
 assert.match(script,/innerWidth/);
 assert.match(script,/originalWorldApproach:slot\.approach/);
 assert.match(script,/observedRustReplicatedPoint:pos/);
 assert.match(script,/W3C|w3c/);
 assert.doesNotMatch(script,/scrollTo\(|scrollIntoView\(|setPlayerPosition\(/);
});

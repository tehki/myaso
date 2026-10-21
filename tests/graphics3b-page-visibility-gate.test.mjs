import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {assessOriginalRackBrowserPageEvidence} from "../scripts/graphics3b_page_visibility_gate.mjs";

const ids=[1,2,3,4];
const browserNames=["chrome-1","firefox-2","chrome-3","firefox-4"];
const positions=()=>ids.map(netId=>({netId,x:3740+netId*28,y:4088}));
function fixture(){
 return {
  realFourW3cQuicClients:true,
  genuineRustReplicatedFourPeerPositions:true,
  originalWorldFourSockets:true,
  peerViews:browserNames.map((browser,index)=>{
   const firefox=index===1||index===3;
   return {browser,actualPlayerPositions:positions(),
    browserPageVisibility:{
     measuredFromRealDOM:true,actorCentersTotal:4,
     actorCentersInsideBrowser:firefox?0:4,
     rackFullyInBrowserViewport:true,rackVisibleFraction:1,
     canvasVisibleFraction:firefox?0.479894:0.999382,
     actors:ids.map((netId,j)=>({
      netId,pageCenterX:550+j*40,
      pageCenterY:firefox?694+j*37:450+j*37,
      centerInsideBrowserViewport:!firefox
     }))
    }
   };
  })
 };
}

test("real Chrome+Firefox log pattern BLOCKS rather than declaring 4 visible fighters",()=>{
 const a=assessOriginalRackBrowserPageEvidence(fixture());
 assert.equal(a.pass,false);
 assert.equal(a.exactFourNativeBrowserRoster,true);
 assert.equal(a.genuineFourPlayerSource,true);
 assert.deepEqual(a.blockers,["firefox-2","firefox-4"]);
 assert.deepEqual(a.browsers.map(b=>b.actualCentersInsidePage),[4,0,4,0]);
 assert.deepEqual(a.browsers.map(b=>b.rackVisibleFraction),[1,1,1,1]);
 assert.equal(a.fullSilverSilhouetteVisibilityCertified,false);
 assert.equal(a.DOMOcclusionCertified,false);
 assert.equal(a.sourceAssetOrServerMutation,false);
});

test("all four real center projections and original racks visible is center-only GO",()=>{
 const f=fixture();
 for(const p of f.peerViews){
  p.browserPageVisibility.actorCentersInsideBrowser=4;
  p.browserPageVisibility.actors.forEach(a=>a.centerInsideBrowserViewport=true);
 }
 const v=assessOriginalRackBrowserPageEvidence(f);
 assert.equal(v.pass,true);
 assert.equal(v.blockers.length,0);
 assert.equal(v.fullSilverSilhouetteVisibilityCertified,false);
});

test("forged duplicate IDs cannot satisfy four actors visible",()=>{
 const f=fixture(),page=f.peerViews[0].browserPageVisibility;
 page.actors[3].netId=1;
 const v=assessOriginalRackBrowserPageEvidence(f);
 assert.equal(v.pass,false);
 assert.ok(v.browsers[0].failures.includes("invalid-page-actor-projections"));
});

test("missing authentic DOM and server positions fail closed",()=>{
 const f=fixture();
 f.peerViews[0].browserPageVisibility.measuredFromRealDOM=false;
 f.peerViews[1].actualPlayerPositions[0].x="3740";
 const v=assessOriginalRackBrowserPageEvidence(f);
 assert.equal(v.pass,false);
 assert.ok(v.browsers[0].failures.includes("missing-real-DOM-measurement"));
 assert.ok(v.browsers[1].failures.includes("invalid-real-replicated-roster"));
});

test("inconsistent projected center count and partial rack are not acceptance",()=>{
 const f=fixture(),p=f.peerViews[0].browserPageVisibility;
 p.actorCentersInsideBrowser=0;
 p.rackVisibleFraction=0.75;
 p.rackFullyInBrowserViewport=false;
 const v=assessOriginalRackBrowserPageEvidence(f);
 assert.equal(v.pass,false);
 assert.ok(v.browsers[0].failures.includes("inconsistent-real-player-center-count"));
 assert.ok(v.browsers[0].failures.includes("rack-not-fully-in-page"));
});

test("missing or duplicate native browser and fake Rust/source proof fails",()=>{
 const f=fixture();
 f.peerViews[3].browser="chrome-1";
 f.realFourW3cQuicClients=false;
 const v=assessOriginalRackBrowserPageEvidence(f);
 assert.equal(v.pass,false);
 assert.ok(v.blockers.includes("wrong-four-native-browser-roster"));
 assert.ok(v.blockers.includes("missing-real-Rust-four-peer-source"));
});

test("read-only report gate preserves genuine runner source, no gameplay rewrites",()=>{
 const root=new URL("../",import.meta.url);
 const script=readFileSync(new URL("scripts/graphics3b_page_visibility_gate.mjs",root),"utf8");
 const game=readFileSync(new URL("web/online-game.mjs",root),"utf8");
 const runner=readFileSync(new URL("scripts/alpha_p0_four_native_rack_at_approaches.mjs",root),"utf8");
 assert.match(runner,/rack-approaches-report\.json/);
 assert.match(runner,/browserPageVisibility/);
 assert.match(game,/armoryRackReview\?\.measurePage/);
 assert.match(script,/--strict/);
 assert.doesNotMatch(script,/sendTryPickup|window\.scrollTo|scrollIntoView|server\/src|setPlayerPosition/);
});

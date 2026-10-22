import test from "node:test";
import assert from "node:assert/strict";
import {selectAuthenticV3LightCapture as qualify} from "../scripts/graphics3a-v3-light-capture-truth.mjs";
const frame=(f,t=1000)=>({frame:f,direction:2,epochMs:t,sourceFile:"silver_kick_v3_lit.webp"});
const capture=(f,t=1000)=>({png:"data:image/png;base64,iVBORw0KGgoAAAANS",frame:f,direction:2,epochMs:t});
test("kicker still requires ACTUALLY rendered active frame after genuine M153 receipt",()=>{
 const x={browser:"chrome",draws:[frame(1),frame(6,1100)],captures:{windup:capture(1),recovery:capture(6,1100)}};
 assert.throws(()=>qualify(x),/Attacker must capture/);
 x.draws.push(frame(4,1010));x.captures.active=capture(4,1010);
 const proof=qualify(x);
 assert.equal(proof.phase,"active");assert.equal(proof.frame,4);
});
test("true remote renderer can miss 70ms active phase; caption genuine observed recovery honestly",()=>{
 const x={browser:"firefox",draws:[frame(1),frame(6,1100)],captures:{windup:capture(1),recovery:capture(6,1100)}};
 const proof=qualify(x);
 assert.equal(proof.phase,"recovery");
 assert.equal(proof.frame,6);
 x.draws.push(frame(3,1020));x.captures.active=capture(3,1020);
 assert.equal(qualify(x).phase,"active");
});
test("reject fake phase, forged source file/recording, PNG and wrong native identities",()=>{
 const base={browser:"chrome2",draws:[frame(5)],captures:{recovery:capture(5)}};
 assert.equal(qualify(base).phase,"recovery");
 assert.throws(()=>qualify({...base,browser:"synthetic"}),/Unknown/);
 assert.throws(()=>qualify({...base,draws:[{...frame(5),sourceFile:"silver_kick_v3.webp"}]}),/not supported/);
 assert.throws(()=>qualify({...base,captures:{recovery:{...capture(5),frame:3}}}),/invalid/);
 assert.throws(()=>qualify({...base,captures:{recovery:{...capture(5),png:"mock"}}}),/invalid/);
 assert.throws(()=>qualify({...base,captures:{active:capture(4)}}),/not supported/);
 assert.throws(()=>qualify({...base,captures:{}}),/lacks observed/);
});
test("native runner and CI explicitly preserve real M153 and original V2 victim gates",async()=>{
 const {readFileSync}=await import("node:fs");
 const s=readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs",import.meta.url),"utf8");
 assert.match(s,/selectAuthenticV3LightCapture/);
 assert.match(s,/originalSilverVictimKnockdownFlight/);
 assert.match(s,/spartanV3LightNativeFlight/);
 assert.match(s,/realAuthoritativeThreePlayerKickKnockdown/);
 assert.match(s,/capturedSourcePhase/);
 assert.match(s,/activeFrameRequiredFromSpectators:false/);
 assert.match(s,/actualActiveFrameProvenForKicker:true/);
 assert.doesNotMatch(s,/mockAction.*kick/);
});

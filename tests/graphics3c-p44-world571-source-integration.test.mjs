import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {MAP_IDS} from "../src/world/authored-maps.mjs";
import {normalizeWorldBuildingReplacementIds} from "../src/world/building-presentation.mjs";
import {createAuthoredWorldRenderer} from "../src/browser/authored-world-renderer.mjs";
const root=new URL("../",import.meta.url);
const evidence=JSON.parse(readFileSync(new URL(
 "assets/environment/greyhaven/3c-p44-world571-parity/x230i-chromium-native.json",root),"utf8"));
const sha=(bytes)=>createHash("sha256").update(bytes).digest("hex");
const P44_CANDIDATE_SOURCE_PINS=Object.freeze({
  "src/browser/authored-world-renderer.mjs":"9528b5485a2feb86af72b650271c5b8e7886f391372228e41fc7c6d721222961",
  "src/browser/greyhaven-terrain-materials.mjs":"4042774508d331e945ce3e1f62f442580180d5fedd7635baa070d69564903238",
  "src/browser/greyhaven-atmosphere.mjs":"452a11ed33ed842372ea39d11e532083c71177cb18261328b8a14ecf1312622f",
  "src/world/authored-maps.mjs":"d48c495f3a23881154ce6c93452c44cb7587ebd3707f9434098439d1a67d1987",
  "src/world/building-presentation.mjs":"6122ebf28eb9470669e57da9f60251c79fc377a002b59cc67c51203b41934256"
});
function exactLfSource(bytes){
 const utf8=bytes.toString("utf8");
 assert.ok(Buffer.from(utf8,"utf8").equals(bytes),"No invalid UTF-8");
 const lf=utf8.replaceAll("\r\n","\n");
 assert.ok(!lf.includes("\r"),"No mixed/bare CR line endings");
 assert.ok(bytes.equals(Buffer.from(lf)) || bytes.equals(Buffer.from(lf.replaceAll("\n","\r\n"))),
  "No unexpected text line-ending variation");
 return Buffer.from(lf);
}
test("P44 uses exact World canonical facade identity, optional callback cannot grant forbidden buildings",()=>{
 assert.deepEqual(normalizeWorldBuildingReplacementIds(MAP_IDS.overworld,["red-lion"]),["red-lion"]);
 const facade=createAuthoredWorldRenderer({replacedBuildingIds:["red-lion"]});
 assert.deepEqual(facade.replacedBuildingIds,["red-lion"]);
 assert.ok(Object.isFrozen(facade.replacedBuildingIds));
 assert.deepEqual(createAuthoredWorldRenderer().replacedBuildingIds,[]);
 for(const invalid of [["smith"],["red-lion","red-lion"],["RED LION"],[1],"red-lion",null,{}]){
  assert.throws(()=>createAuthoredWorldRenderer({replacedBuildingIds:invalid}),RangeError);
 }
 assert.throws(()=>createAuthoredWorldRenderer({
  replacedBuildingIds:["smith"],worldReplacementValidator:()=>["smith"]}),RangeError);
 const online=readFileSync(new URL("web/online-game.mjs",root),"utf8");
 assert.doesNotMatch(online,/replacedBuildingIds\s*:/);
});
test("P44 original six-case native X230i art proof is honestly single-engine and zero-diff",()=>{
 assert.equal(evidence.originalUnmodified,true);
 assert.equal(evidence.serverAuthoritative,false);
 assert.equal(evidence.players,0);
 assert.equal(evidence.heads.baseline,"ef78df8b065a03399c0047e785587e707852bc07");
 assert.equal(evidence.heads.integrationBase,"9139ce3b4290bd7b1a5efe4b90b3edcc8d15db59");
 assert.equal(evidence.originalWorldMapsMatch,true);
 assert.deepEqual(evidence.enginesRequested,["chrome"]);
 assert.equal(evidence.fullChromeFirefoxMatrix,false);
 assert.equal(evidence.results.length,1);
 const x=evidence.results[0];
 assert.equal(x.engine,"chrome");
 assert.match(x.version,/^Chrome\/152\./);
 assert.deepEqual(x.errors,[]);
 assert.deepEqual(x.cases.map(a=>a.id),[
 "tavern-day","tavern-replaced","tavern-pan","blacksmith","south-city","northern-wilderness"
 ]);
 for(const sample of x.cases){
  assert.equal(sample.changedBytes,0);
  assert.equal(sample.changedPixels,0);
  assert.ok(sample.baselineCached>=3 && sample.baselineCached<=24);
  assert.equal(sample.candidateCached,sample.baselineCached);
  assert.deepEqual(sample.candidateReplacements,sample.baselineReplacements);
 }
});
test("P44 screenshot probe retains immutable historical source pins; only the scoped P1 renderer successor may differ",()=>{
 const script=readFileSync(new URL("tools/art/probe_p44_world571_3c_render_parity.mjs",root),"utf8");
 assert.match(script,/P44_BROWSER_ENGINE/);
 assert.match(script,/ef78df8b065a03399c0047e785587e707852bc07/);
 assert.match(script,/9139ce3b4290bd7b1a5efe4b90b3edcc8d15db59/);
 assert.ok(script.includes("getImageData(0,0,width,height)"));
 assert.doesNotMatch(readFileSync(new URL("web/online-game.mjs",root),"utf8"),/probe_p44_world571_3c_render_parity/);
 const changed=[];
 for(const [route,pin] of Object.entries(evidence.sourceHashes)){
  if(!route.startsWith("/candidate/"))continue;
  const rel=route.slice("/candidate/".length);
  assert.equal(pin,P44_CANDIDATE_SOURCE_PINS[rel],"Historical P44 source pin changed: "+rel);
  const bytes=readFileSync(new URL(rel,root));
  const current=sha(exactLfSource(bytes));
  if(current===pin)continue;
  changed.push(rel);
  const source=bytes.toString("utf8");
  if(rel==="src/browser/authored-world-renderer.mjs"){
   assert.match(source,/greyhavenTimeOfDay/,"P1 renderer successor must remain an explicit time-of-day opt-in");
   assert.match(source,/paintGreyhavenDuskWash/,"P1 renderer successor must retain bounded city-only dusk wash");
  }else if(rel==="src/browser/greyhaven-atmosphere.mjs"){
   assert.match(source,/GREYHAVEN_DAY_DUSK_VERSION/,"P1 atmosphere successor must declare its own version");
   assert.match(source,/export function paintGreyhavenDuskWash/,"P1 atmosphere successor must own the city wash");
  }else{
   assert.fail("Unexpected change to historically pinned P44 source: "+rel);
  }
 }
 assert.deepEqual(changed.sort(),[
  "src/browser/authored-world-renderer.mjs",
  "src/browser/greyhaven-atmosphere.mjs"
 ]);
});

test("P44 original Windows Chrome154+Firefox153 12-case P43 vs P44 viewport pixel parity",()=>{
 const x=JSON.parse(readFileSync(new URL(
  "assets/environment/greyhaven/3c-p44-world571-parity/windows-chrome-firefox-native.json",root),"utf8"));
 assert.equal(x.originalUnmodified,true);
 assert.equal(x.serverAuthoritative,false);
 assert.equal(x.players,0);
 assert.equal(x.originalWorldMapsMatch,true);
 assert.deepEqual(x.enginesRequested,["chrome","firefox"]);
 assert.equal(x.fullChromeFirefoxMatrix,true);
 assert.equal(x.heads.baseline,"ef78df8b065a03399c0047e785587e707852bc07");
 assert.equal(x.heads.integrationBase,"9139ce3b4290bd7b1a5efe4b90b3edcc8d15db59");
 assert.equal(x.heads.integrationCurrent,"729bb11a4933576f99cd416475c4911a06e3fbfd");
 assert.deepEqual(x.results.map(r=>r.engine),["chrome","firefox"]);
 assert.match(x.results[0].version,/^Chrome\/154\./);
 assert.match(x.results[1].version,/^firefox\/153\.4\./);
 for(const result of x.results){
  assert.deepEqual(result.errors,[]);
  assert.equal(result.cases.length,6);
  assert.deepEqual(result.cases.map(a=>a.id),[
   "tavern-day","tavern-replaced","tavern-pan","blacksmith","south-city","northern-wilderness"
  ]);
  for(const sample of result.cases){
   assert.equal(sample.changedBytes,0);
   assert.equal(sample.changedPixels,0);
   assert.deepEqual(sample.candidateReplacements,sample.baselineReplacements);
   assert.equal(sample.candidateCached,sample.baselineCached);
   assert.ok(sample.candidateCached>0&&sample.candidateCached<=24);
  }
 }
});

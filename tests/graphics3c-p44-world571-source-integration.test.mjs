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
test("P44 screenshot probe is pinned to original sources and not imported by the online game",()=>{
 const script=readFileSync(new URL("tools/art/probe_p44_world571_3c_render_parity.mjs",root),"utf8");
 assert.match(script,/P44_BROWSER_ENGINE/);
 assert.match(script,/ef78df8b065a03399c0047e785587e707852bc07/);
 assert.match(script,/9139ce3b4290bd7b1a5efe4b90b3edcc8d15db59/);
 assert.match(script,/getImageData\(0,0,width,height\)/);
 assert.doesNotMatch(readFileSync(new URL("web/online-game.mjs",root),"utf8"),/probe_p44_world571_3c_render_parity/);
 for(const [route,pin] of Object.entries(evidence.sourceHashes)){
  if(!route.startsWith("/candidate/"))continue;
  const rel=route.slice("/candidate/".length);
  const bytes=readFileSync(new URL(rel,root));
  assert.equal(sha(exactLfSource(bytes)),pin,"Source changed after genuine X230i evidence: "+rel);
 }
});

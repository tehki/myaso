import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
const dir="../docs/art/silver-victim-knockdown-360ms/real-native-victim-20261022/";
const get=n=>readFileSync(new URL(dir+n,import.meta.url));
test("three actual original Silver victim native game-canvas PNGs are exact SHA-256 CI artifact bytes",()=>{
 const m=JSON.parse(get("original_silver_victim_native_manifest.json").toString("utf8"));
 assert.equal(m.authenticatedRustThreePlayerKnockdown,true);
 assert.equal(m.realSilverSourceAllBrowsers,true);
 assert.equal(m.screenshotAfterSynchronousCanvasCallback,true);
 assert.equal(m.inGameSoleContactProven,false);
 assert.equal(m.trueImpactMeshCollisionProven,false);
 assert.equal(m.humanArtApproved,false);
 assert.equal(m.preAlphaEnabled,false);
 assert.equal(m.images.length,3);
 assert.deepEqual(m.images.map(x=>x.browser).sort(),["chrome","chrome2","firefox"]);
 assert.deepEqual(m.images.map(x=>x.serverPlayerId).sort(),[1,2,3]);
 const hashes=new Set();
 for(const x of m.images){
  assert.equal(x.originalSourceFrame,3);
  const png=get(x.filename);
  assert.equal(png.length,x.bytes);
  assert.ok(png.length>15000);
  assert.equal(png.subarray(0,8).toString("hex"),"89504e470d0a1a0a");
  assert.equal(png.readUInt32BE(16),960);
  assert.equal(png.readUInt32BE(20),540);
  const sum=createHash("sha256").update(png).digest("hex");
  assert.equal(sum,x.sha256,x.filename);
  assert.ok(!hashes.has(sum),"genuine browser images must be independent");
  hashes.add(sum);
 }
});

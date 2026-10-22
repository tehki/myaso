import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
const root=new URL("../",import.meta.url);
const dir="docs/art/silver-victim-grounded-v2-360ms/real-native-v2-20261022/";
const get=n=>readFileSync(new URL(dir+n,root));
test("exact authenticated original Silver grounded V2 browser PNGs match three distinct Rust-server source artifact SHA-256s",()=>{
 const m=JSON.parse(get("original_silver_victim_native_manifest.json"));
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
  const png=get(x.filename);
  assert.equal(x.originalSourceFrame,3);
  assert.equal(png.length,x.bytes);
  assert.ok(png.length>15000);
  assert.equal(png.subarray(0,8).toString("hex"),"89504e470d0a1a0a");
  assert.equal(png.readUInt32BE(16),960);
  assert.equal(png.readUInt32BE(20),540);
  const sha=createHash("sha256").update(png).digest("hex");
  assert.equal(sha,x.sha256,x.filename);
  assert.ok(!hashes.has(sha));
  hashes.add(sha);
 }
});

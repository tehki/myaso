import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
const base="../docs/art/prealpha-silver-knight-browser-review/real-four-browser-20261022/";
const bytes=(file)=>readFileSync(new URL(base+file,import.meta.url));
test("archived real Rust-server 4-player Chrome/Firefox viewport and arena screenshots match CI SHA-256",()=>{
 const manifest=JSON.parse(bytes("native_browser_evidence.json").toString("utf8"));
 assert.equal(manifest.realServerFourPlayerAccepted,true);
 assert.equal(manifest.notHumanOperated,true);
 assert.equal(manifest.artSourceUnchanged,true);
 assert.equal(manifest.serverHitNotProven,true);
 assert.equal(manifest.screenshots.length,8);
 assert.deepEqual([...new Set(manifest.screenshots.map(x=>x.browser))].sort(),
   ["chrome","chrome2","chrome3","firefox"]);
 assert.deepEqual([...new Set(manifest.screenshots.map(x=>x.originalServerId))].sort(),
   [1,2,3,4]);
 assert.deepEqual([...new Set(manifest.screenshots.map(x=>x.kind))].sort(),
   ["arena","viewport"]);
 const hashes=new Set();
 for(const item of manifest.screenshots){
  assert.ok(["arena","viewport"].includes(item.kind));
  const b=bytes(item.filename);
  assert.equal(b.length,item.bytes);
  assert.ok(b.length>=15000);
  assert.equal(b.subarray(0,8).toString("hex"),"89504e470d0a1a0a");
  assert.ok(b.readUInt32BE(16)>400 && b.readUInt32BE(20)>300);
  const digest=createHash("sha256").update(b).digest("hex");
  assert.equal(digest,item.sha256,item.filename);
  assert.ok(!hashes.has(digest),"screenshots must be independently captured");
  hashes.add(digest);
 }
});

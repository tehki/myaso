import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";

const folder="../docs/art/silver-spartan-contact-recoil-v3/real-connected-contact-20261022/";
const bytes=name=>readFileSync(new URL(folder+name,import.meta.url));

test("both genuine Rust multiplayer Spartan V3 in-game contact PNGs exactly match GitHub CI SHA manifest",()=>{
 const m=JSON.parse(bytes("native_v3_contact_manifest.json").toString("utf8"));
 assert.equal(m.realConnectedSourceAccepted,true);
 assert.equal(m.sourceVersion,"contact-recoil-v3");
 assert.equal(m.actualServerHitReceiptValidated,false);
 assert.equal(m.fullFrameAfterRenderLoopValidated,false);
 assert.equal(m.fourHumanOperators,false);
 assert.equal(m.images.length,2);
 assert.deepEqual(m.images.map(x=>x.browser).sort(),["chrome","firefox"]);
 assert.deepEqual(m.images.map(x=>x.serverPlayerId).sort(),[1,2]);
 const digests=new Set();
 for(const record of m.images) {
  const png=bytes(record.filename);
  assert.ok(png.length>15000);
  assert.equal(png.length,record.bytes);
  assert.equal(png.subarray(0,8).toString("hex"),"89504e470d0a1a0a");
  assert.ok(png.readUInt32BE(16)>=600);
  assert.ok(png.readUInt32BE(20)>=400);
  const digest=createHash("sha256").update(png).digest("hex");
  assert.equal(digest,record.sha256,record.filename);
  assert.ok(!digests.has(digest),"actual two native clients cannot return identical screenshots");
  digests.add(digest);
 }
});

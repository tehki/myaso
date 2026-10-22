import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
const path="../docs/art/silver-spartan-contact-recoil-v3/";
const file=name=>readFileSync(new URL(path+name,import.meta.url));
const digests=new Set();
test("native Chrome and Firefox reviewed all 8×8 original Silver Blender contact and recoil source cells",()=>{
 for(const engine of ["chrome","firefox"]){
  const r=JSON.parse(file("silver_spartan_contact_recoil_v3_"+engine+".json").toString("utf8"));
  assert.equal(r.engine,engine);
  assert.equal(r.checks,64);
  assert.equal(r.frameCount,8);
  assert.equal(r.allFacings,8);
  assert.equal(r.originalFirstPartyWebP,true);
  assert.equal(r.neutralStudioOnly,true);
  assert.equal(r.realGameplay,false);
  assert.equal(r.humanApproved,false);
  assert.deepEqual(r.errors,[]);
  assert.equal(r.screenshots.length,4);
  for(const name of r.screenshots){
   const b=file(name);
   assert.ok(b.byteLength>40000);
   assert.equal(b.subarray(0,8).toString("hex"),"89504e470d0a1a0a");
   assert.ok(b.readUInt32BE(16)>=1200);
   const sha=createHash("sha256").update(b).digest("hex");
   assert.ok(!digests.has(sha),"real browser screenshots must differ per frame and native engine");
   digests.add(sha);
  }
 }
 assert.equal(digests.size,8);
});
test("review loads exact original V2 and editable authored V3 (never gameplay, not a new city)",()=>{
 const viewer=readFileSync(new URL("../web/silver-spartan-contact-recoil-v3-review.mjs",import.meta.url),"utf8");
 const html=readFileSync(new URL("../web/silver-spartan-contact-recoil-v3-review.html",import.meta.url),"utf8");
 assert.match(viewer,/silver_spartan_high_forward_p0\.webp/);
 assert.match(viewer,/silver_spartan_contact_recoil_v3_p0\.webp/);
 assert.match(viewer,/durationMs:380/);
 assert.match(viewer,/sourceOnly:true,realGreyhaven:false/);
 assert.match(viewer,/realCombat:false,humanApproved:false,rollout:false/);
 assert.match(viewer,/drawCloseUp\(\)/);
 assert.match(viewer,/current\*160,facing\*160,160,160/);
 assert.match(html,/SOURCE-ART VISUAL HOLD/);
 assert.match(html,/id="detail"/);
 assert.match(html,/id="facing"/);
});

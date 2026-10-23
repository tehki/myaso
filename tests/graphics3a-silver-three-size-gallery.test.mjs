import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const root = new URL("../", import.meta.url);
const page = readFileSync(new URL("docs/art/silver-knight-motion-review/silver-knight-motion-gallery-game-scale-compare-offline.html", root), "utf8").replace(/\r\n/g, "\n");
const marker = "const CLIPS = ";
const start = page.indexOf(marker), end = page.indexOf(";\nconst SIZE=", start);
assert(start >= 0 && end > start, "fully offline source-embedded gallery is required");
const clips=JSON.parse(page.slice(start + marker.length,end));
const manifest=JSON.parse(readFileSync(new URL("docs/art/silver-locomotion-game-scale-20261023/manifest.source-reviewed.json",root),"utf8"));
const old={
 idle:"828cf05dd873d0c8f35e887f5e46c35af87f084ac321977e358c985e7a2106b4",
 walk:"8fd421ea2d96a38a70afd9e05bec1297e90bffd8fde586a79c6a0907413adbb7",
 sprint:"3ec5b5c2b6a24d8bbad3639984f2020bec0519be08f8021be30d8d20b1e9f271",
 jump:"b73c506ad886fe68e01c834b36bb18ea951edd8327dfb8532c2eb0450dbc2e14"
};
const roll={
 idle:"37e355e5622e983a6150894724fa2d176efe851867ffd860b09508d16761036c",
 walk:"7c414f51c492c2a6ffaeae71db5ef5243a7e66e344b9e242215612a7c268c4a0",
 sprint:"0b1fdd69fe1819d372f80167d5b353dfdb414e22f63c51a2833bc85c4fc5499b",
 jump:"86f4402cc3dc375bc3691cb9701b5520229556df1b998e2c14e2b09c022912fc"
};
const keep={
 roll:"31c774ac930a5cf1060640f1fc2914b02d6d5ddccd7d56591123efd098909426",
 kick:"a6001a61c9cd48aa5b34ff7a7ecccb071bd6a3c6465ec5fd0cabffb4d3d1d747",
 fall:"5b3af4e2124a6b1315d0c14396eaaf3815fcf6af21d0662592d9e448e39f7bc9"
};
function bytes(data,sha){
 assert.match(data,/^data:image\/webp;base64,/);
 const raw=Buffer.from(data.slice("data:image/webp;base64,".length),"base64");
 assert.equal(raw.subarray(0,4).toString(),"RIFF");
 assert.equal(raw.subarray(8,12).toString(),"WEBP");
 assert.equal(createHash("sha256").update(raw).digest("hex"),sha);
 return raw;
}
test("all 15 original owner-source-derived WebPs are independently hash verified",()=>{
 assert.deepEqual(clips.map(c=>c.id),["idle","walk","sprint","jump","roll","kick","fall"]);
 assert.match(page,/15 \/ 15 authentic source atlases embedded/);
 for(const c of clips.slice(0,4)){
  assert.equal(c.legacySha,old[c.id]);
  assert.equal(c.rollSha,roll[c.id]);
  assert.equal(c.sha,manifest.atlas[c.id].sha256);
  assert.notEqual(c.sha,roll[c.id]); assert.notEqual(c.sha,c.legacySha);
  bytes(c.data,c.sha); bytes(c.rollData,c.rollSha); bytes(c.legacyData,c.legacySha);
 }
 for(const c of clips.slice(4)){
  assert.equal(c.sha,keep[c.id]);
  assert.equal(c.rollData,undefined); assert.equal(c.legacyData,undefined);
  bytes(c.data,c.sha);
 }
});
test("game-size artwork is authentic 22-bone Cycles rendering, all 208 independent uncropped source frames",()=>{
 assert.equal(manifest.source.sourceSHA256,"d679fccd00df868d600b4c5e2fcf8a4a46cc062dbd432be5b6a7f533eb30141f");
 assert.equal(manifest.source.originalRigBones,22);
 assert.equal(manifest.source.cameraOrthoScale,1.29);
 assert.equal(manifest.source.sourceAssetChanged,false);
 assert.equal(manifest.source.originalMeshRedistributed,false);
 let count=0;
 for(const [clip,info] of Object.entries(manifest.atlas)){
  assert.equal(info.cells.length,8*info.frames);
  for(const cell of info.cells){
   assert.equal(cell.sourcePNGsha256.length,64);
   const [l,t,r,b]=cell.alphaBBox;
   assert(Math.min(l,t,160-r,160-b)>=4,clip+" direction="+cell.direction+" frame="+cell.frame);
  }
  count+=info.cells.length;
 }
 assert.equal(count,208);
});
test("source selector uses three different original WebP sources with only legacy source rows flipped",()=>{
 for(const variant of ["game","roll","original"])assert(page.includes('value="'+variant+'"'));
 assert(page.includes('oldSource=version==="original";'));
 assert(page.includes('version==="original" ? o.c.legacyData : version==="roll" ? o.c.rollData : o.c.data'));
 assert(page.includes('return oldSource&&["idle","walk","sprint","jump"].includes(obj.c.id) ? (8-face)%8 : face;'));
 assert(page.includes('function atlasRow(obj,face)'));
 assert(!/filter:\s*brightness\(/i.test(page));
});

test("grounded review markers follow per-frame original WebP alpha rather than detached fixed canvas positions",()=>{
 assert(page.includes("function visibleSourceBottom(obj,frame,face)"));
 assert(page.includes("footProbeCtx.getImageData(0,0,SIZE,SIZE).data"));
 assert(page.includes("function groundAlignedCenterY(obj,frame,face,groundY,scale)"));
 assert(page.includes("groundY-(visibleSourceBottom(obj,frame,face)-SIZE/2)*scale-airborneGap"));
 assert(page.includes('drawAtPreviewGround(obj,frame,Number(dir),320,260,1.52)'));
 assert(page.includes("drawAtPreviewGround(obj,frame,i,x,groundY,.73)"));
 assert(page.includes("Jump intentionally"));
 assert(page.includes("not the game's jump trajectory"));
 assert(!page.includes("ctx.ellipse(320,265,77,12"));
 assert(!page.includes("draw(obj,frame,Number(dir),320,146,1.52)"));
});

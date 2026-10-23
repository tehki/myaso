import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { test } from "node:test";

const page = readFileSync(new URL("../docs/art/silver-knight-motion-review/silver-knight-motion-gallery-relit-review-offline.html",import.meta.url),"utf8").replace(/\r\n/g,"\n");
const begin=page.indexOf("const CLIPS = ");
const end=page.indexOf(";\nconst SIZE=",begin);
assert(begin>0 && end>begin);
const clips=JSON.parse(page.slice(begin+"const CLIPS = ".length,end));
const sha={
  idle:"37e355e5622e983a6150894724fa2d176efe851867ffd860b09508d16761036c",
  walk:"7c414f51c492c2a6ffaeae71db5ef5243a7e66e344b9e242215612a7c268c4a0",
  sprint:"0b1fdd69fe1819d372f80167d5b353dfdb414e22f63c51a2833bc85c4fc5499b",
  jump:"86f4402cc3dc375bc3691cb9701b5520229556df1b998e2c14e2b09c022912fc",
  roll:"31c774ac930a5cf1060640f1fc2914b02d6d5ddccd7d56591123efd098909426",
  kick:"a6001a61c9cd48aa5b34ff7a7ecccb071bd6a3c6465ec5fd0cabffb4d3d1d747",
  fall:"5b3af4e2124a6b1315d0c14396eaaf3815fcf6af21d0662592d9e448e39f7bc9",
};
const oldSha={
 idle:"828cf05dd873d0c8f35e887f5e46c35af87f084ac321977e358c985e7a2106b4",
 walk:"8fd421ea2d96a38a70afd9e05bec1297e90bffd8fde586a79c6a0907413adbb7",
 sprint:"3ec5b5c2b6a24d8bbad3639984f2020bec0519be08f8021be30d8d20b1e9f271",
 jump:"b73c506ad886fe68e01c834b36bb18ea951edd8327dfb8532c2eb0450dbc2e14",
};
function verify(data,expected){
 assert.match(data,/^data:image\/webp;base64,/);
 const bytes=Buffer.from(data.slice("data:image/webp;base64,".length),"base64");
 assert.equal(bytes.subarray(0,4).toString(),"RIFF");
 assert.equal(bytes.subarray(8,12).toString(),"WEBP");
 assert.equal(createHash("sha256").update(bytes).digest("hex"),expected);
}

test("all seven original source atlases are self-contained, exact pinned SHA256",()=>{
 assert.deepEqual(clips.map(x=>x.id),["idle","walk","sprint","jump","roll","kick","fall"]);
 for(const c of clips){assert.equal(c.sha,sha[c.id]);verify(c.data,c.sha);}
 assert.match(page,/11 \/ 11 authentic source atlases embedded/);
});
test("four genuine Blender studio relights retain four independent immutable dark originals for comparison",()=>{
 for(const c of clips.slice(0,4)){
  assert.equal(c.group,"Experimental");
  assert.equal(c.legacySha,oldSha[c.id]);
  verify(c.legacyData,c.legacySha);
  assert.notEqual(c.sha,c.legacySha);
 }
 for(const c of clips.slice(4))assert.equal(c.legacyData,undefined);
});
test("original normal-light Kick, not rejected overlit support-light, and clip-only legacy direction toggle",()=>{
 assert.equal(clips.find(x=>x.id==="kick").sha,sha.kick);
 assert(page.includes('const row=oldSource&&["idle","walk","sprint","jump"].includes(obj.c.id) ? (8-face)%8 : face;'));
 assert(page.includes('id="sourceLighting"'));
 assert(!page.includes("function fetch("));
});

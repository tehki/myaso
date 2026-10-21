import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
const at = path=>readFileSync(new URL(path,import.meta.url));
const root="../docs/art/prealpha-silver-knight-browser-review/";
const hashes={
 "silver_idle.webp":"828cf05dd873d0c8f35e887f5e46c35af87f084ac321977e358c985e7a2106b4",
 "silver_walk.webp":"8fd421ea2d96a38a70afd9e05bec1297e90bffd8fde586a79c6a0907413adbb7",
 "silver_sprint.webp":"3ec5b5c2b6a24d8bbad3639984f2020bec0519be08f8021be30d8d20b1e9f271",
 "silver_roll.webp":"31c774ac930a5cf1060640f1fc2914b02d6d5ddccd7d56591123efd098909426",
 "silver_jump.webp":"b73c506ad886fe68e01c834b36bb18ea951edd8327dfb8532c2eb0450dbc2e14"
};
const sha=b=>createHash("sha256").update(b).digest("hex");
test("pre-alpha only five original immutable Silver atlases match actual first-party source manifest",()=>{
 for(const [file,digest] of Object.entries(hashes)){
  const blob=at("../web/assets/knights/"+file);
  assert.equal(sha(blob),digest,file);
  assert.equal(blob.toString("ascii",0,4),"RIFF");
 }
});
test("both native browser reports are source-art only; 40 genuine original sprite-direction crops each",()=>{
 for(const engine of ["chrome","firefox"]){
  const report=JSON.parse(at(root+"prealpha_silver_"+engine+"_native_source.json").toString("utf8"));
  assert.equal(report.engine,engine);
  assert.equal(report.sourceCellChecks,40);
  assert.equal(report.unsupportedFallbackChecks,13);
  assert.equal(report.npcRejected,true);
  assert.equal(report.realGameServer,false);
  assert.equal(report.realMultiplayer,false);
  assert.equal(report.authPlayers,false);
  assert.equal(report.sourceApprovedSpartanKickIncluded,false);
  assert.deepEqual(report.pageErrors,[]);
  assert.equal(report.screenCaptures.length,5);
  assert.deepEqual(report.clips.map(x=>x.clip),["idle","walk","sprint","roll","jump"]);
  for(const shot of report.screenCaptures){
   const bytes=at(root+shot);
   assert.ok(bytes.byteLength>15000,shot+" must contain real browser screenshot bytes");
   assert.equal(bytes.subarray(0,8).toString("hex"),"89504e470d0a1a0a");
  }
 }
});
test("source viewer imports the real Pre-Alpha game renderer, no server or extra sixth clip",()=>{
 const src=at("../web/prealpha-silver-source-review.mjs").toString("utf8");
 const page=at("../web/prealpha-silver-source-review.html").toString("utf8");
 const renderer=at("../web/knight-sprites.mjs").toString("utf8");
 assert.match(src,/import \{createKnightSpriteRenderer,KNIGHT_FRAME_PX\} from "\.\/knight-sprites\.mjs"/);
 assert.match(page,/simulated actor states, NOT real authenticated Rust server PvP/);
 assert.match(src,/trueServer:false/);
 assert.match(src,/authenticatedPlayers:false/);
 assert.match(renderer,/silver_walk: 8, silver_idle: 4, silver_sprint: 8, silver_jump: 6, silver_roll: 8/);
 assert.doesNotMatch(renderer,/silver_kick: /);
});

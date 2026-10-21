import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {
 WORLD_ALPHA_STATIC_ARTIFACT_PATH,buildWorldAlphaStaticArtifact,
 serializeWorldAlphaStaticArtifact,verifyWorldAlphaStaticArtifact
} from "../scripts/verify-world-alpha-solid-artifact.mjs";
import {WORLD_ALPHA_GREYHAVEN_STATIC_SOLIDS} from "../src/world/alpha-solid-geometry.mjs";
const artifactURL=new URL("../assets/world/greyhaven-alpha-solids-v1.json",import.meta.url);
const pinned=readFileSync(artifactURL,"utf8");

test("P0 Core-consumable JSON is canonical and Windows CRLF safe",()=>{
 assert.equal(WORLD_ALPHA_STATIC_ARTIFACT_PATH,"assets/world/greyhaven-alpha-solids-v1.json");
 assert.equal(verifyWorldAlphaStaticArtifact(pinned),true);
 assert.equal(verifyWorldAlphaStaticArtifact(serializeWorldAlphaStaticArtifact()),true);
 assert.equal(verifyWorldAlphaStaticArtifact(serializeWorldAlphaStaticArtifact().replace(/\n/g,"\r\n")),true);
 assert.ok(serializeWorldAlphaStaticArtifact().endsWith("\n"));
 const parsed=JSON.parse(pinned);
 assert.deepEqual(parsed,buildWorldAlphaStaticArtifact());
 assert.equal(parsed.schema_version,1);
 assert.equal(parsed.layout_id,"moonvale-greyhaven-v10-solids-v1");
 assert.equal(parsed.map_id,"moonvale-overworld");
 assert.equal(parsed.city_id,"greyhaven");
 assert.equal(parsed.solids_count,23);
 assert.equal(parsed.solids.length,23);
 assert.ok(Object.isFrozen(buildWorldAlphaStaticArtifact()));
});
test("P0 immutable geometry snapshot and digest match the reviewed 23 World AABBs",()=>{
 const parsed=JSON.parse(pinned);
 assert.deepEqual(parsed.solids,WORLD_ALPHA_GREYHAVEN_STATIC_SOLIDS);
 assert.equal(parsed.solids.filter(r=>r.kind==="building").length,15);
 assert.equal(parsed.solids.filter(r=>r.kind==="city-wall").length,8);
 assert.equal(parsed.solids_sha256,
  "9bb023c95d86821f219113d71b6e480789a72df064f083790e746d79423b3f43");
 assert.equal(parsed.solids_sha256,
  createHash("sha256").update(JSON.stringify(parsed.solids),"utf8").digest("hex"));
 assert.equal(new Set(parsed.solids.map(r=>r.id)).size,23);
 for(const rect of parsed.solids){
  assert.ok(rect.max_x>rect.min_x&&rect.max_y>rect.min_y);
  for(const coordinate of ["min_x","min_y","max_x","max_y"])
   assert.ok(Number.isFinite(rect[coordinate])&&Number.isInteger(rect[coordinate]*2));
 }
});
test("P0 fixture never masquerades as server current epoch, complete window or item grant",()=>{
 const parsed=JSON.parse(pinned);
 assert.equal(parsed.requires_core_fence,true);
 assert.equal(parsed.includes_river_or_dynamic_solids,false);
 const forbidden=["complete","worker_epoch","map_revision","zone_id","player_id",
  "current_server_tick","TryPickup","world_item_id","owner","equipped_item_id"];
 for(const key of forbidden)assert.equal(Object.hasOwn(parsed,key),false,key);
 assert.equal(parsed.solids.some(r=>forbidden.some(k=>Object.hasOwn(r,k))),false);
});
test("P0 rejects data drift, forged fields, reordered solids, whitespace, partial writes and bad EOL",()=>{
 const text=serializeWorldAlphaStaticArtifact();
 const parsed=JSON.parse(text);
 const mutations=[
  text.replace('"solids_count": 23','"solids_count": 22'),
  text.replace('"max_x": 3892','"max_x": 3891'),
  text.replace('"requires_core_fence": true','"requires_core_fence": false'),
  text.replace('"includes_river_or_dynamic_solids": false','"includes_river_or_dynamic_solids": true'),
  text.replace('"solids_sha256": "','"solids_sha256": "0'),
  text.replace(/\n/g,"\n\n"),text.trimEnd(),
  text.replace(/\n/g,"\r"),
 ];
 for(const x of mutations)assert.equal(verifyWorldAlphaStaticArtifact(x),false,x.slice(0,140));
 parsed.complete=true;
 assert.equal(verifyWorldAlphaStaticArtifact(JSON.stringify(parsed,null,2)+"\n"),false);
 const swapped=JSON.parse(text);
 [swapped.solids[0],swapped.solids[1]]=[swapped.solids[1],swapped.solids[0]];
 assert.equal(verifyWorldAlphaStaticArtifact(JSON.stringify(swapped,null,2)+"\n"),false);
 assert.equal(verifyWorldAlphaStaticArtifact(null),false);
});
test("P0 strict CLI validates checked-in geometry on its exact head",()=>{
 const script=fileURLToPath(new URL("../scripts/verify-world-alpha-solid-artifact.mjs",import.meta.url));
 const args=[script];
 const result=spawnSync(process.execPath,args,{encoding:"utf8",timeout:10000});
 assert.equal(result.status,0,result.stderr);
 assert.match(result.stdout,/World P0 pinned solids PASS: 23 AABBs/);
 const print=spawnSync(process.execPath,[script,"--print"],{encoding:"utf8",timeout:10000});
 assert.equal(print.status,0,print.stderr);
 assert.equal(print.stdout,serializeWorldAlphaStaticArtifact());
 const misuse=spawnSync(process.execPath,[script,"--unsafe"],{encoding:"utf8",timeout:10000});
 assert.equal(misuse.status,2);
});
test("P0 artifact importer remains detached from live multiplayer and Rust authority",()=>{
 const js=readFileSync(new URL("../scripts/verify-world-alpha-solid-artifact.mjs",import.meta.url),"utf8");
 assert.doesNotMatch(js,/WebSocket|WebTransport|fetch\(|localStorage|sessionStorage|writeFile|createWriteStream/);
 for(const file of ["../web/online-game.mjs","../server/src/main.rs","../server/src/simulation.rs"]){
  const source=readFileSync(new URL(file,import.meta.url),"utf8");
  assert.doesNotMatch(source,/greyhaven-alpha-solids-v1\.json|buildWorldAlphaStaticArtifact/);
 }
});

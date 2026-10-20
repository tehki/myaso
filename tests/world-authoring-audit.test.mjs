import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {MAP_IDS} from "../src/world/authored-maps.mjs";
import {MOONVALE_LANDMARKS} from "../src/world/landmark-discovery.mjs";
import {MOONVALE_FIELD_SITES} from "../src/world/field-survey.mjs";
import {MOONVALE_ROADSIDE_LORE} from "../src/world/roadside-lore.mjs";
import {MOONVALE_EXPEDITIONS} from "../src/world/local-expeditions.mjs";
import {CERTIFIED_TRAILS} from "../src/world/certified-trails.mjs";
import {MOONVALE_CHRONICLE_THREADS} from "../src/world/chronicle-threads.mjs";
import {WORLD_AUTHORING_AUDIT_VERSION,auditMoonvaleAuthoring} from "../scripts/audit-world-authoring.mjs";

const codes=result=>result.errors.map(e=>e.code);
const includes=(r,code)=>assert.ok(codes(r).includes(code),code+" missing: "+JSON.stringify(r.errors));
const replace=(array,index,item)=>Object.freeze(array.map((x,i)=>i===index?Object.freeze(item):x));

test("D16 canonical authored world is self-consistent and has six bounded related systems",()=>{
  assert.equal(WORLD_AUTHORING_AUDIT_VERSION,1);
  const report=auditMoonvaleAuthoring();
  assert.ok(report.ok,JSON.stringify(report.errors));
  assert.deepEqual(report.errors,[]);
  assert.ok(Object.isFrozen(report)&&Object.isFrozen(report.counts)&&Object.isFrozen(report.errors));
  assert.deepEqual(report.counts,{
    landmarks:4,fields:8,lore:6,routes:3,certifiedLegs:7,threads:2,
  });
  assert.deepEqual(auditMoonvaleAuthoring(),report,"audit is repeatable and deterministic");
});

test("D16 colliding or off-map site and duplicate stable IDs fail closed",()=>{
  const site=MOONVALE_ROADSIDE_LORE[0];
  const invalid=replace(MOONVALE_ROADSIDE_LORE,0,{...site,x:4365,y:4000});
  includes(auditMoonvaleAuthoring({lore:invalid}),"BLOCKED_SITE");
  const duplicate=replace(MOONVALE_ROADSIDE_LORE,0,{
    ...site,id:MOONVALE_FIELD_SITES[0].id,
  });
  includes(auditMoonvaleAuthoring({lore:duplicate}),"DUPLICATE_SITE");
  const offMap=replace(MOONVALE_FIELD_SITES,0,{...MOONVALE_FIELD_SITES[0],x:-1});
  includes(auditMoonvaleAuthoring({fields:offMap}),"BLOCKED_SITE");
});

test("D16 nearest-site arbitration flags unreachable lore/field overlap without false negatives",()=>{
  // D13 chooses a lore site only if strictly CLOSER than nearest field.
  // A newly authored plaque placed exactly on an ore site would be hidden
  // by the old field priority, even though both anchors are walkable.
  const original=MOONVALE_ROADSIDE_LORE[4];
  const ore=MOONVALE_FIELD_SITES[4];
  const lore=replace(MOONVALE_ROADSIDE_LORE,4,{...original,x:ore.x,y:ore.y});
  const report=auditMoonvaleAuthoring({lore});
  includes(report,"SHADOWED_F_INTERACTION");
  assert.ok(report.errors.some(e=>e.detail.startsWith(original.id+" by "+ore.id)));
  assert.ok(auditMoonvaleAuthoring().ok,
    "canonical watchpost ore and plaque must BOTH remain inspectable");
});

test("D16 route step references must remain exact authored IDs and actions",()=>{
  const source=MOONVALE_EXPEDITIONS[0];
  const changed=Object.freeze({...source,steps:Object.freeze([
    source.steps[0],
    Object.freeze({action:"visit",site:source.steps[1].site}),
    source.steps[2],
  ])});
  const routes=replace(MOONVALE_EXPEDITIONS,0,changed);
  includes(auditMoonvaleAuthoring({expeditions:routes}),"BAD_ROUTE_REFERENCE");
  const typo=Object.freeze({...source,steps:Object.freeze([
    source.steps[0],
    Object.freeze({action:"inspect",site:Object.freeze({...source.steps[1].site,id:"missing-field-id"})}),
    source.steps[2],
  ])});
  includes(auditMoonvaleAuthoring({expeditions:replace(MOONVALE_EXPEDITIONS,0,typo)}),"BAD_ROUTE_REFERENCE");
});

test("D16 certified corridor endpoint drift, blocked sample and missing legs are diagnosed",()=>{
  const north=CERTIFIED_TRAILS[5];
  const badPoints=Object.freeze(north.points.map((point,i)=>
    i===1?Object.freeze([4365,4000]):point));
  const bad=replace(CERTIFIED_TRAILS,5,{...north,points:badPoints});
  const errors=auditMoonvaleAuthoring({trails:bad});
  includes(errors,"BLOCKED_WAYPOINT");
  includes(errors,"BLOCKED_TRAIL_SEGMENT");

  const first=CERTIFIED_TRAILS[0];
  const driftPoints=Object.freeze(first.points.map((point,i)=>
    i===0?Object.freeze([4365,4150]):point));
  const shifted=replace(CERTIFIED_TRAILS,0,{...first,points:driftPoints});
  includes(auditMoonvaleAuthoring({trails:shifted}),"TRAIL_ENDPOINT_DRIFT");

  const missing=Object.freeze(CERTIFIED_TRAILS.slice(0,-1));
  includes(auditMoonvaleAuthoring({trails:missing}),"MISSING_TRAIL");
});

test("D16 linked stories must reference every site exactly once without invented credits",()=>{
  const story=MOONVALE_CHRONICLE_THREADS[0];
  const broken=replace(MOONVALE_CHRONICLE_THREADS,0,{...story,
    siteIds:Object.freeze([story.siteIds[0],story.siteIds[0],"unknown-inscription"])});
  const audit=auditMoonvaleAuthoring({threads:broken});
  for(const code of ["DUPLICATE_STORY_SITE","UNKNOWN_STORY_SITE","UNLINKED_LORE"])includes(audit,code);
  assert.ok(!audit.ok);
  assert.equal(Object.hasOwn(audit.counts,"gold"),false);
});

test("D16 CLI is a strict deterministic build gate without writes or online dependencies",()=>{
  const file=new URL("../scripts/audit-world-authoring.mjs",import.meta.url);
  const result=spawnSync(process.execPath,[fileURLToPath(file)],{encoding:"utf8",timeout:10000});
  assert.equal(result.status,0,result.stderr);
  assert.match(result.stdout,/^World authoring audit PASS: 4 landmarks, 8 field sites, 6 lore sites, 3 expeditions, 7 certified legs, 2 story threads\./);
  const source=readFileSync(file,"utf8");
  assert.doesNotMatch(source,/fetch\(|WebSocket|WebTransport|localStorage|sessionStorage|createWriteStream|writeFile|unlink|rename\(/);
  for(const path of ["../web/online-game.mjs","../server/src/main.rs","../server/src/simulation.rs"]){
    assert.doesNotMatch(readFileSync(new URL(path,import.meta.url),"utf8"),
      /audit-world-authoring|auditMoonvaleAuthoring/);
  }
});

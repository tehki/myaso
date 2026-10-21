import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,statSync} from "node:fs";
import {KNIGHT_PRESENTATION_SCALE,knightPresentationRect,
  KNIGHT_ROLL_PRESENTATION_MS} from "../web/knight-sprites.mjs";

const folder=new URL("../web/assets/knights/a211-review/",import.meta.url);
const report=JSON.parse(readFileSync(new URL("a211_chrome_report.json",folder),"utf8"));

test("A2.11 actual Chrome proves approved opt-in 120% and 100% reversible drawing",()=>{
  assert.match(report.browser,/^Chrome\//);
  assert.deepEqual(report.pageErrors,[]);
  assert.equal(report.visualScale,KNIGHT_PRESENTATION_SCALE);
  assert.equal(report.approvedUrlFlag,"knights=1");
  assert.equal(report.baselineRollbackUrlFlag,"knights=1&knightScale=100");
  assert.equal(report.originalKnightWebpsModified,false);
  assert.equal(report.A3RollDurationMs,KNIGHT_ROLL_PRESENTATION_MS);
  assert.equal(report.hitboxesModified,false);
  assert.equal(report.combatOrServerModified,false);
  assert.equal(report.actualMultiplayerFpsMeasured,false);
  assert.equal(report.productionDeployed,false);
  for(const [caseName,sample] of Object.entries({
    idle:report.idle,silver_roll:report.silverRoll,t1_roll:report.t1Roll
  })){
    const rolling=caseName!=="idle";
    assert.deepEqual(sample.baseline,knightPresentationRect(rolling,1));
    assert.deepEqual(sample.approved,knightPresentationRect(rolling));
    assert.equal(sample.loadedAtlases.baseline,9);
    assert.equal(sample.loadedAtlases.approved,9);
    assert.equal(sample.hitboxesChanged,false);
    assert.equal(sample.serverAuthorityChanged,false);
    assert.equal(sample.anatomicalFootPivotVerified,false);
    assert.equal(sample.gameplayAltered,false);
    assert.equal(sample.baseline.x+sample.baseline.width/2,0);
    assert.equal(sample.approved.x+sample.approved.width/2,0);
  }
});

test("A2.11 attaches actual browser PNGs with original artwork, not placeholder diagrams",()=>{
  for(const file of [
    "a211_knight_idle_100_vs_120.png",
    "a211_silver_roll_100_vs_120.png",
    "a211_t1_roll_100_vs_120.png"
  ]){
    const url=new URL(file,folder);
    assert.ok(statSync(url).size>12000,file);
    const bytes=readFileSync(url);
    assert.equal(bytes.subarray(0,8).toString("hex"),"89504e470d0a1a0a");
    assert.equal(bytes.readUInt32BE(16),1180);
    assert.ok(bytes.readUInt32BE(20)>=1030);
  }
});

test("A2.11 main online client keeps knight sprites opt-in with exact 100% rollback",()=>{
  const source=readFileSync(new URL("../web/online-game.mjs",import.meta.url),"utf8");
  assert.match(source,/knightQuery\.get\("knights"\) === "1"/);
  assert.match(source,/knightQuery\.get\("knightScale"\) === "100"/);
  assert.match(source,/KNIGHT_PRESENTATION_SCALE/);
  assert.match(source,/createKnightSpriteRenderer/);
  const preview=readFileSync(new URL("../web/knight-scale-a211-preview.mjs",import.meta.url),"utf8");
  assert.match(preview,/createKnightSpriteRenderer\(\{presentationScale:1\}\)/);
  assert.match(preview,/createKnightSpriteRenderer\(\{presentationScale:KNIGHT_PRESENTATION_SCALE\}\)/);
  assert.match(preview,/COMBAT_ACTION\.dodgeRecovery/);
  assert.doesNotMatch(preview,/new WebSocket|localStorage|POST.*fetch/);
});

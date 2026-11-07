import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const runner=readFileSync(new URL(
  "../client/playcanvas/scripts/main0-chrome-chat-c1-native.mjs",import.meta.url),"utf8");
const workflow=readFileSync(new URL(
  "../.github/workflows/core8a-playcanvas-passive-quic.yml",import.meta.url),"utf8");

test("Source11 PlayCanvas is a separate branded Chrome, same-root three-lives physical trial",()=>{
  assert.match(runner,/MYASO_CHROME_RESPAWN_P0==='1'/);
  assert.match(runner,/assert\.ok\(!\(fourMode&&respawnMode\)/);
  assert.match(runner,/^const loopback = \/\^https:/m);
  assert.match(runner,/MYASO_BIND:'127\.0\.0\.1:0'/);
  assert.match(runner,/MYASO_WORLD9_GREYHAVEN_ALPHA:'1'/);
  assert.match(runner,/MYASO_EXPERIMENTAL_GESTURE_V2:'1'/);
  assert.match(runner,/respawnMode\?'&source11Renewal=1':''/);
  assert.match(runner,/assert\.match\(chromeVersion,\/\^Google Chrome \//);
  assert.match(runner,/physicalThreeSameRootRespawns\(sessions\[0\],sessions\[1\]\)/);
});

test("Source11 three deaths use only physical W3C Light34 and unchanged Rust root actor/HP",()=>{
  assert.match(runner,/for\(let cycle=1;cycle<=3;cycle\+\+\)/);
  assert.match(runner,/for\(let hit=1;hit<=3;hit\+\+\)/);
  assert.match(runner,/const wanted=Math\.max\(0,100-34\*hit\)/);
  assert.match(runner,/await trustedLightClick\(attacker\)/);
  assert.match(runner,/type:'pointerDown',button:0/);
  assert.match(runner,/type:'pointerUp',button:0/);
  assert.match(runner,/v\.actor===b\.actor&&v\.hp===wanted/);
  assert.match(runner,/v\.actor===b\.actor&&v\.hp===0/);
  assert.match(runner,/v\.action===8&&!v\.closed/);
  assert.match(runner,/v\.actor===b\.actor&&v\.hp===100/);
  assert.match(runner,/x\.hits\.map\(h=>h\.hp\)\.join\(','\)==='66,32,0'/);
  assert.match(runner,/localDamageOrRespawnSimulation:false/);
});

test("Source11 requires original bound typed GRANT and new physical source0 after each real respawn",()=>{
  assert.match(runner,/source11Events:p\?\.source11Events\?\?\[\]/);
  assert.match(runner,/x\.stage==='renew-lease-active'/);
  assert.match(runner,/v\.typedGeneration>previousGeneration&&hasRenew/);
  assert.match(runner,/v\.typedRenewalPending===false&&!v\.failed&&!v\.leaseClosed/);
  assert.match(runner,/await trustedLightClick\(victim,\{x:630,holdMs:65\}\)/);
  assert.match(runner,/x\.transportSettled===true/);
  assert.match(runner,/x\.action===1&&x\.source===0/);
  assert.match(runner,/v\.nextSequence>before\.nextSequence&&settled/);
  assert.match(runner,/const ack=await sendChat\(victim,chatText\)/);
  assert.match(runner,/const peer=await secondReceives\(attacker,chatText,b\.actor\)/);
  assert.match(runner,/MAIN0_PLAYCANVAS_CHROME_SOURCE11_THREE_REAL_RESPAWNS_PASS/);
  assert.match(runner,/source11-three-lives-first-red\.json/);
});

test("nonrelease Source11 CI retains passive and four-PlayCanvas jobs with strict exact-head logs",()=>{
  assert.match(workflow,/two-playcanvas-source11-three-respawns:/);
  assert.match(workflow,/four-playcanvas-chrome-stable:/);
  assert.match(workflow,/passive-original-quic:/);
  assert.match(workflow,/MYASO_CHROME_RESPAWN_P0: "1"/);
  assert.match(workflow,/Branded Google Chrome Stable required/);
  assert.match(workflow,/ref: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/);
  assert.match(workflow,/cargo build --locked --manifest-path server\/Cargo\.toml --bin myaso-server/);
  assert.match(workflow,/timeout --signal=TERM --kill-after=5s 420s npm run smoke:chrome-chat-c1/);
  assert.match(workflow,/grep 'MAIN0_PLAYCANVAS_CHROME_SOURCE11_THREE_REAL_RESPAWNS_PASS'/);
  assert.match(workflow,/main0-playcanvas-source11-\$\{\{ github\.event\.pull_request\.head\.sha \}\}/);
});

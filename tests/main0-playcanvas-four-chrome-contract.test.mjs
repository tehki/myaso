import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const runner=readFileSync(new URL(
  "../client/playcanvas/scripts/main0-chrome-chat-c1-native.mjs",import.meta.url),"utf8");
const workflow=readFileSync(new URL(
  "../.github/workflows/core8a-playcanvas-passive-quic.yml",import.meta.url),"utf8");

test("Four actual PlayCanvas Chrome Stable renderers use genuine separate original Rust actor leases",()=>{
  assert.match(runner,/MYASO_CHROME_FOUR_P0/);
  assert.match(runner,/assert\.match\(chromeVersion,\/\^Google Chrome \//);
  assert.match(runner,/anchors=\[\[4110,4160\],\[4206,4160\],\[4110,4256\],\[4206,4256\]\]/);
  assert.match(runner,/i<\(fourMode\?4:2\)/);
  assert.match(runner,/physicalJoin\(session\.sessionId,anchors\[i\]\)/);
  assert.match(runner,/new Set\(owned\.map\(x=>x\.actor\)\)\.size,owned\.length/);
  assert.match(runner,/owned\.every\(x=>x\.renderer==='WebGL2'\)/);
  assert.match(runner,/participants\.every\(x=>x\.typedGranted\)/);
  assert.match(runner,/v\.transport==='webtransport'&&v\.hp===100/);
});

test("Four PlayCanvas real Chat C1 + physical Light34 validates each independent Rust replica",()=>{
  assert.match(runner,/sessions\.slice\(1\)\s*\.map\(s=>secondReceives\(s,text,a\.actor\)\)/);
  assert.match(runner,/send\.ack\.accepted\.includes\(text\)/);
  assert.match(runner,/gameplayTickUnchangedWhileTyping:true/);
  assert.match(runner,/physicalRustCombat\(sessions\[0\],sessions\[1\]\)/);
  assert.match(runner,/combat\.authoritativeWorldDamage,34/);
  assert.match(runner,/v\.observerHp===100\s*&&v\.victimHp===66/);
  assert.match(runner,/participants\.slice\(2\)\.map\(x=>x\.netId\)/);
  assert.match(runner,/MAIN0_PLAYCANVAS_FOUR_CHROME_RUST_CHAT_LIGHT34_PASS/);
  assert.match(runner,/privateHitReceiptClaimed:false,publicActivation:false/);
  assert.match(runner,/four-playcanvas-first-red\.json/);
});

test("Four PlayCanvas CI is a separate nonrelease, pinned, fail-closed branded Chrome Stable job",()=>{
  assert.match(workflow,/four-playcanvas-chrome-stable:/);
  assert.match(workflow,/CHROME_BIN: \/usr\/bin\/google-chrome/);
  assert.match(workflow,/MYASO_CHROME_FOUR_P0: "1"/);
  assert.match(workflow,/ref: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/);
  assert.match(workflow,/Expected branded Google Chrome Stable/);
  assert.match(workflow,/cargo build --locked --manifest-path server\/Cargo\.toml --bin myaso-server/);
  assert.match(workflow,/timeout --signal=TERM --kill-after=5s 420s npm run smoke:chrome-chat-c1/);
  assert.match(workflow,/grep 'MAIN0_PLAYCANVAS_FOUR_CHROME_RUST_CHAT_LIGHT34_PASS'/);
  assert.match(workflow,/name: main0-four-playcanvas-chrome-/);
  assert.match(runner,/MYASO_BIND:'127\.0\.0\.1:0'/);
  assert.match(runner,/MYASO_WORLD9_GREYHAVEN_ALPHA:'1'/);
  assert.match(runner,/MYASO_CHAT_C1_ENABLED:'1'/);
  assert.match(runner,/MYASO_EXPERIMENTAL_GESTURE_V2:'1'/);
  assert.match(runner,/assert\.match\(world\.endpoint,loopback\)/);
  assert.match(runner,/assert\.equal\(dirty,''/);
});

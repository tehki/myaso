// M156 original v1 short-click observability: source policy only.
// Genuine browser + World acceptance runs in the separate focused native job.
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {appendM144InputSample} from "../src/browser/m144-input-sample-observer.mjs";

const browser=readFileSync(new URL("../web/online-game.mjs",import.meta.url),"utf8");
const runner=readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs",import.meta.url),"utf8");

test("M156 observes real pointer release and onLight latch, no fabricated input edge",()=>{
  assert.match(browser,/function observeM156OriginalInput\(phase, values = \{\}\)/);
  assert.match(browser,/if \(acceptanceScenario !== "uirollknockdownffahit"\) return;/);
  assert.match(browser,/onLight\(\) \{\s*attackRequested = true;\s*observeM156OriginalInput\("onLight"/);
  assert.match(browser,/const committed = leftButtonCharge\.release\(event\.pointerId\);/);
  assert.match(browser,/leftButtonCharge\.release\(event\.pointerId\);\s*leftButtonPressMovement = null;/,
    "M156 observer must not split protected R1 real release/capture cleanup");
  assert.match(browser,/observeM156OriginalInput\("pointerup", \{/);
  assert.match(browser,/pointerId:event\.pointerId, button:event\.button/);
  assert.match(browser,/committed:committed \?\? null, attackRequested/);
  assert.match(browser,/observeM156OriginalInput\("pointercancel"/);
  assert.match(browser,/observeM156OriginalInput\("lostpointercapture"/);
  assert.match(browser,/observeM156OriginalInput\("window-blur"/);
});

test("M156 samples exactly the existing v1 30Hz sender, preserving M144 and M145 policy",()=>{
  assert.match(browser,/if \(acceptanceScenario === "uimultirecoveryspatial" \|\| acceptanceScenario === "uimultirecoveryffa" \|\|\s*acceptanceScenario === "uirollknockdownffahit"\) \{/);
  assert.match(browser,/else if \(acceptanceScenario === "uirollknockdownffahit"\) \{\s*debug\.inputSubmissions \?\?= \[\];\s*appendM144InputSample/);
  assert.match(browser,/observeM156OriginalInput\("sampled-send", \{/);
  assert.match(browser,/attackLatchedBeforeReset:Boolean\(attackRequested\)/);
  assert.match(browser,/if \(actionSample \|\| Date\.now\(\) - m156LastPointerEpochMs <= 160\)/);
  assert.match(browser,/if \(acceptanceScenario === "uimultirecoveryffa"\) \{/);
  assert.match(browser,/\/\/ M145 existing action-only original trace remains unchanged/);
  const actualSend='networkClient.sendInput({ tick: outgoingTick, ...currentInput });';
  assert.equal(browser.split(actualSend).length-1,1,"one unchanged original sender");
  const sendIndex=browser.indexOf(actualSend);
  assert.ok(browser.indexOf('observeM156OriginalInput("sampled-send"')<sendIndex);
  assert.ok(browser.indexOf('attackRequested = false;',sendIndex)>sendIndex);
});

test("M156 coalesced ACK has current connection actor ID, bounded independent receipt",()=>{
  assert.match(browser,/onAck\(ack\) \{[\s\S]{0,350}acceptanceScenario === "uirollknockdownffahit"/);
  assert.match(browser,/processedClientTick: networkClient\?\.processedClientTick \?\? null/);
  assert.match(browser,/serverTick: networkClient\?\.latestServerTick \?\? null/);
  assert.match(browser,/actorNetId:networkClient\?\.playerNetId \?\? null/);
  assert.match(browser,/if \(debug\.inputAckReceipts\.length > 32\) debug\.inputAckReceipts\.shift\(\)/);
  assert.match(browser,/if \(debug\.m156InputTrace\.length > 32\) debug\.m156InputTrace\.shift\(\)/);
});

test("native M156 still expects one real 34 HP third-party hit, with no scenario timing changes",()=>{
  assert.match(runner,/runOnlineUiRollKnockdownFfaHitFlight\(entries\)/);
  assert.match(runner,/did not land exactly one 34 HP third-party light/);
  assert.match(runner,/MYASO_ACCEPTANCE_STATE__\.scenario === "uirollknockdownffahit"/);
  assert.match(runner,/m156InputTrace:\(window\.__MYASO_ACCEPTANCE_STATE__\.m156InputTrace \?\? \[\]\)/);
  assert.match(runner,/inputSubmissions: \(window\.__MYASO_ACCEPTANCE_STATE__\.inputSubmissions \?\? \[\]\)\.slice\(-32\)/);
  assert.match(runner,/inputAckReceipts: \(window\.__MYASO_ACCEPTANCE_STATE__\.inputAckReceipts \?\? \[\]\)\.slice\(-32\)/);
});

test("actual M156 6ms light and surrounding idle samples retained by pure bounded observer",()=>{
  const history=[];
  for(let tick=1;tick<=80;tick++)appendM144InputSample(history,{
    clientTick:tick,epochMs:tick*33,attack:false,heavyAttack:false,jump:false,
  });
  assert.deepEqual(history.map(e=>e.clientTick),[79,80]);
  appendM144InputSample(history,{clientTick:81,epochMs:2673,attack:true,jump:false,heavyAttack:false});
  for(let tick=82;tick<=450;tick++)appendM144InputSample(history,{
    clientTick:tick,epochMs:tick*33,attack:false,jump:false,heavyAttack:false,
  });
  assert.deepEqual(history.map(e=>e.clientTick),[79,80,81,82,83]);
  assert.equal(history.find(x=>x.clientTick===81).attack,true);
  assert.ok(history.length<=32);
});

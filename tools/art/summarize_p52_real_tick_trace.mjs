#!/usr/bin/env node
// P52 diagnostic: evidence aggregation of ACTUAL non-simulated Rust sends
// against ACTUAL WebTransport client accepted ticks and original clock.
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
const root=resolve(fileURLToPath(new URL("../../",import.meta.url)));
const base="10183d131ea10f3f21a2647120f19a72debbf5b2";
execFileSync("git",["-C",root,"merge-base","--is-ancestor",base,"HEAD"]);
const protectedPaths=["server","web/online-game.mjs","web/authoritative-client.mjs",
 "web/network-transport.mjs","src/browser/smooth-motion.mjs",
 "src/browser/render-gap-telemetry.mjs","src/browser/authored-world-renderer.mjs"];
assert.equal(execFileSync("git",["-C",root,"diff","--name-only",base,"HEAD","--",...protectedPaths],
 {encoding:"utf8"}).trim(),"","No runtime code changes permitted for P52 evidence child");
assert.ok(process.argv.length>=5,"Usage: node script.mjs output.json <raw trial 1> <raw trial 2> ...");
const output=resolve(process.argv[2]),inputs=process.argv.slice(3);
const results={type:"P52 native original Rust send and WebTransport accepted snapshot anomaly triage",
 qaOnly:true,realPacketsNotSynthetic:true,productionSourceChanged:false,
 sourceParent:base,stagedServerIsInstrumented:true,browserResponseInstrumented:true,
 serverAndBrowsersOnePhysicalHost:true,noGpuPresentTiming:true,
 runs:[]};
function countSteps(events){
 const out={};
 for(let i=1;i<events.length;i++){
  const delta=(events[i].tick-events[i-1].tick)>>>0;
  out[String(delta)]=(out[String(delta)]||0)+1;
 }
 return out;
}
function maxGap(events){
 return events.length<2?0:Math.max(...events.slice(1).map((e,i)=>e.epochMs-events[i].epochMs));
}
function q(list,p){
 const a=list.filter(Number.isFinite).sort((x,y)=>x-y);
 return a.length?+(a[Math.min(a.length-1,Math.max(0,Math.ceil(a.length*p)-1))]).toFixed(3):null;
}
for(let trial=0;trial<inputs.length;trial++){
 const raw=JSON.parse(await readFile(resolve(inputs[trial]),"utf8"));
 assert.equal(raw.sourceHead,"05f577b7fb8d97ef33c6ddcf9699a3d6432db909");
 assert.equal(raw.host,"127.0.0.1");assert.equal(raw.serverAuthoritative,true);
 assert.equal(raw.clientsRequested,4);assert.equal(raw.results.length,4);
 assert.equal(raw.errors.length,0);
 assert.equal(raw.serverSimulation.length>300,true);
 assert.equal(raw.serverTransmit.length>800,true);
 assert.deepEqual(raw.serverSummary.admittedPlayerIds,[1,2,3,4]);
 const run={name:"independent-live-four-client-"+(trial+1),
  measuredMs:raw.measureMs,serverSimulationRefreshTicks:raw.serverSimulation.length,
  simulationRefreshStepHistogram:countSteps(raw.serverSimulation),clients:[]};
 for(let index=1;index<=4;index++){
  const browser=raw.results[index-1];
  assert.equal(browser.index,index);assert.deepEqual(browser.errors,[]);
  const m=browser.measurement,accepted=m.acceptedTimeline.filter(x=>x.kind==="realtime");
  assert.ok(accepted.length>=250);
  assert.equal(m.acceptedRealtimeCount,accepted.length);
  assert.equal(m.acceptedReliableCount,0);
  const fullTx=raw.serverTransmit.filter(x=>x.player===index);
  const alignedTx=fullTx.filter(x=>
   x.epochMs>=accepted[0].epochMs-100&&x.epochMs<=accepted.at(-1).epochMs+100);
  const byTick=new Map();
  for(const tx of fullTx){
   const arr=byTick.get(tx.tick)||[];
   arr.push(tx.epochMs);
   byTick.set(tx.tick,arr);
  }
  const delays=[],jumpEvents=[];
  let unmatched=0,extraTxForJump=0;
  for(let i=0;i<accepted.length;i++){
   const curr=accepted[i];
   const candidates=byTick.get(curr.tick)||[];
   const matching=candidates.filter(t=>t<=curr.epochMs+2).sort((a,b)=>b-a)[0];
   if(matching===undefined)unmatched++;
   else delays.push(curr.epochMs-matching);
   if(i===0)continue;
   const before=accepted[i-1];
   const tickStep=(curr.tick-before.tick)>>>0;
   if(tickStep===3)continue;
   const missing=[];
   if(tickStep>3&&tickStep<30)
    for(let mid=before.tick+3;mid<curr.tick;mid+=3)
     if(fullTx.some(z=>z.tick===mid&&z.epochMs>=before.epochMs-150&&z.epochMs<=curr.epochMs+100))
      missing.push(mid);
   if(missing.length)extraTxForJump++;
   const serverWindow=fullTx.filter(z=>z.epochMs>=before.epochMs-110
     &&z.epochMs<=curr.epochMs+35).map(z=>({
      tick:z.tick,msBeforeCurrentAccepted:+(z.epochMs-curr.epochMs).toFixed(3)}));
   const exactPrevious=fullTx.some(z=>z.tick===before.tick&&
     z.epochMs<=before.epochMs+2&&z.epochMs>=before.epochMs-110);
   const exactCurrent=fullTx.some(z=>z.tick===curr.tick&&
     z.epochMs<=curr.epochMs+2&&z.epochMs>=curr.epochMs-110);
   const transmittedSameTick=fullTx.filter(z=>z.tick===curr.tick
     &&z.epochMs>=before.epochMs-110&&z.epochMs<=curr.epochMs+2).length>=2;
   jumpEvents.push({
    fromTick:before.tick,toTick:curr.tick,step:tickStep,
    rxIntervalMs:+(curr.epochMs-before.epochMs).toFixed(3),
    intermediateSuccessfulServerSends:missing,
    actualServerTransmissionsAroundEvent:serverWindow,
    bothReceivedTicksMatchSuccessfulServerTx:exactPrevious&&exactCurrent,
    classification:tickStep===0&&transmittedSameTick?
      "repeated-tick-was-transmitted-by-server":
      tickStep===0?"repeat-accepted-tick-with-unresolved-tx-cadence":
      missing.length?"server-sent-intermediate-not-accepted":
      tickStep===6&&exactPrevious&&exactCurrent?
       "six-tick-jump-was-transmitted-by-server":
       tickStep>3?"server-output-jump-or-out-of-window":"other-tick-step"
   });
  }
  const receiptIntervals=accepted.slice(1).map((e,i)=>e.epochMs-accepted[i].epochMs);
  const snapshotDebt=m.sampledClockDebtMaxMs;
  const row={player:index,authPlayerId:index,
   received:accepted.length,serverSentAll:fullTx.length,serverSentInAlignedWindow:alignedTx.length,
   matchedAcceptedToServerSends:accepted.length-unmatched,unmatchedAccepted:unmatched,
   serverTransmitTickStepHistogram:countSteps(alignedTx),
   clientAcceptedTickStepHistogram:countSteps(accepted),
   totalOffCadenceClientTransitions:jumpEvents.length,
   actualTickJumpEvents:jumpEvents.slice(0,40),
   maxServerSendGapMs:+maxGap(alignedTx).toFixed(3),
   maxClientReceiptGapMs:+maxGap(accepted).toFixed(3),
   receiptGapP95Ms:q(receiptIntervals,.95),
   serverOutputToClientObservedDeltaP95Ms:q(delays,.95),
   serverOutputToClientObservedDeltaMaxMs:q(delays,1),
   sampledOriginalClockDebtP95Ms:m.sampledClockDebtP95Ms,
   sampledOriginalClockDebtMaxMs:snapshotDebt,
   originalGameFrameCallbackP95Ms:m.actualGameFrameP95Ms,
   callbackGapOver33:m.actualGameFrameGapOver33,
   longTasks:m.observedLongTaskCount,
   originalHudSnapshot:m.diagnostics.match(/Extra render lag p50 [^|]*/)?.[0]||"",
   originalAuthStatus:m.status,
   recordedPlayerInputs:true};
  assert.equal(unmatched,0,"Cannot claim all received packets matched");
  assert.ok(extraTxForJump<=jumpEvents.length);
  run.clients.push(row);
 }
 results.runs.push(run);
}
await mkdir(dirname(output),{recursive:true});
await writeFile(output,JSON.stringify(results,null,2)+"\n");
console.log(JSON.stringify({realRuns:results.runs.map(r=>({
 name:r.name,sessions:r.clients.length,offCadence:r.clients.map(c=>c.totalOffCadenceClientTransitions),
 clockDebtMax:r.clients.map(c=>c.sampledOriginalClockDebtMaxMs),
 receiptGapMax:r.clients.map(c=>c.maxClientReceiptGapMs),
 serverGapMax:r.clients.map(c=>c.maxServerSendGapMs)
}))}));

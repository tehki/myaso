#!/usr/bin/env node
// Genuine same-host QA: actual Rust frame selection, simulation refresh,
// successful QUIC send, genuine accepted tick and actual visual-clock debt.
// This does not create synthetic arrivals or patch shipping source.
import assert from "node:assert/strict";
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {execFileSync} from "node:child_process";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
const root=resolve(fileURLToPath(new URL("../../",import.meta.url)));
const parent="e8cb752ee31407534b4c2a0a32305b020a98c70d";
execFileSync("git",["-C",root,"merge-base","--is-ancestor",parent,"HEAD"]);
const protectedPaths=["server","web","src/browser/smooth-motion.mjs","src/browser/render-gap-telemetry.mjs","src/network"];
assert.equal(execFileSync("git",["-C",root,"diff","--name-only",parent,"HEAD","--",...protectedPaths],{encoding:"utf8"}).trim(),"");
const output=resolve(process.argv[2]||"");
const inputs=process.argv.slice(3);assert.ok(inputs.length>=1);
const result={type:"P53 true Rust replication frame READ time relative to SIM refresh",
 parent,realWebTransport:true,realServerAuthority:true,stagedOnlyOutsideRepo:true,
 noProductionSourceEdited:true,serverInstrumentedStdoutOnly:true,
 clientHTTPPassiveInstrumentation:true,loopbackOnly:true,
 samePhysicalHost:true,noSyntheticLoss:true,notGPUPresentedFrameTiming:true,
 runs:[]};
function histogram(list){const h={};for(let i=1;i<list.length;i++){const k=String((list[i].tick-list[i-1].tick)>>>0);h[k]=(h[k]||0)+1;}return h}
function round(x){return Math.round(x*1000)/1000}
for(let t=0;t<inputs.length;t++){
 const x=JSON.parse(await readFile(resolve(inputs[t]),"utf8"));
 assert.equal(x.sourceHead,parent);assert.equal(x.clientsRequested,4);
 assert.equal(x.measureMs,15000);assert.deepEqual(x.errors,[]);
 assert.deepEqual(x.serverSummary.admittedPlayerIds,[1,2,3,4]);
 assert.ok(x.serverSimulation.length>300);
 assert.ok(x.serverRead.length>800);
 assert.ok(x.serverTransmit.length>800);
 const trial={trial:t+1,clients:[],simRefreshes:x.serverSimulation.length,
 simRefreshTickSteps:histogram(x.serverSimulation)};
 for(const browser of x.results){
  assert.deepEqual(browser.errors,[]);
  const id=browser.index;
  const rx=browser.measurement.acceptedTimeline.filter(y=>y.kind==="realtime");
  const tx=x.serverTransmit.filter(y=>y.player===id);
  const rd=x.serverRead.filter(y=>y.player===id);
  const getReadForTx=(txEvent)=>{
   const nearest=rd.filter(r=>r.tick===txEvent.tick&&r.epochMs<=txEvent.epochMs&&r.epochMs>=txEvent.epochMs-15);
   return nearest.at(-1)||null;
  };
  const inWindow=tx.filter(z=>z.epochMs>=rx[0].epochMs-100&&z.epochMs<=rx.at(-1).epochMs+100);
  const actualMatched=rx.every(z=>tx.some(e=>e.tick===z.tick&&e.epochMs<=z.epochMs+2&&e.epochMs>=z.epochMs-100));
  assert.ok(actualMatched,"Original accepted snapshots must be matched to successful Rust transmit");
  let readMatches=0;for(const e of inWindow)if(getReadForTx(e))readMatches++;
  const events=[];
  for(let i=1;i<rx.length;i++){
   const a=rx[i],b=rx[i-1],step=(a.tick-b.tick)>>>0;
   if(step===3)continue;
   const oldTx=tx.filter(e=>e.tick===b.tick&&e.epochMs>=b.epochMs-120&&e.epochMs<=b.epochMs+2).at(-1);
   const newTx=tx.filter(e=>e.tick===a.tick&&e.epochMs>=a.epochMs-120&&e.epochMs<=a.epochMs+2).at(-1);
   assert.ok(oldTx&&newTx);
   const oldRead=getReadForTx(oldTx),newRead=getReadForTx(newTx);
   assert.ok(oldRead&&newRead,"Actual frame cached at tick must have been directly observed in Rust");
   const prevSim=x.serverSimulation.filter(v=>v.epochMs<=newRead.epochMs).at(-1);
   const nextSim=x.serverSimulation.find(v=>v.epochMs>newRead.epochMs);
   events.push({
    fromTick:b.tick,toTick:a.tick,step,receiveGapMs:round(a.epochMs-b.epochMs),
    rustSelectedOriginalTick:b.tick,rustSelectedNextTick:a.tick,
    oldFrameReadEpochMs:oldRead.epochMs,nextFrameReadEpochMs:newRead.epochMs,
    rustTransmitGapMs:round(newTx.epochMs-oldTx.epochMs),
    frameReadGapMs:round(newRead.epochMs-oldRead.epochMs),
    mostRecentSimulationRefreshTick:prevSim?.tick??null,
    nextSimulationRefreshTick:nextSim?.tick??null,
    msAfterLatestRefresh:prevSim?round(newRead.epochMs-prevSim.epochMs):null,
    msUntilNextRefresh:nextSim?round(nextSim.epochMs-newRead.epochMs):null
   });
  }
  trial.clients.push({
   player:id,rxCount:rx.length,txWindowCount:inWindow.length,
   successfulTxWithMatchedFrameRead:readMatches,
   originalReceivedTickSteps:histogram(rx),
   actualRustFrameReadTickSteps:histogram(inWindow.map(z=>getReadForTx(z)).filter(Boolean)),
   originalSuccessfulSendTickSteps:histogram(inWindow),
   acceptedAllMatchSuccessfulRustTx:actualMatched,
   eventCount:events.length,
   repeatedAndJumpEvents:events,
   actualClockDebtPeakMs:browser.measurement.sampledClockDebtMaxMs,
   originalRAFCallbackGapOver33:browser.measurement.actualGameFrameGapOver33,
   originalFrameP95Ms:browser.measurement.actualGameFrameP95Ms
  });
 }
 result.runs.push(trial);
}
await mkdir(dirname(output),{recursive:true});
await writeFile(output,JSON.stringify(result,null,2)+"\n");
console.log(JSON.stringify({runs:result.runs.map(t=>({trial:t.trial,events:t.clients.map(c=>c.eventCount),
 debt:t.clients.map(c=>c.actualClockDebtPeakMs),
 readMatch:t.clients.map(c=>[c.successfulTxWithMatchedFrameRead,c.txWindowCount])}))}));

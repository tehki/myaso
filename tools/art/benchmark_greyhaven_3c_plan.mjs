// Standalone deterministic Greyhaven 3C planner benchmark.
// Optional GREYHAVEN_PREVIOUS_MODULE absolute path: pinned previous PR head.
// No browser, random seed, server state or gameplay subsystem is involved.
import {performance} from "node:perf_hooks";
import {writeFile} from "node:fs/promises";
import {pathToFileURL} from "node:url";
import {resolve} from "node:path";
import {createGreyhavenTerrainPlan as candidate} from "../../src/browser/greyhaven-terrain-materials.mjs";
import {AUTHORED_MAPS, MAP_IDS} from "../../src/world/authored-maps.mjs";
const map=AUTHORED_MAPS[MAP_IDS.overworld];
const tiles=[
  {x:3584,y:3584,width:512,height:512},
  {x:4096,y:3584,width:512,height:512},
  {x:3584,y:4096,width:512,height:512},
  {x:4096,y:4096,width:512,height:512}
];
const previousPath=process.env.GREYHAVEN_PREVIOUS_MODULE;
const previous=previousPath
  ? (await import(pathToFileURL(resolve(previousPath)).href)).createGreyhavenTerrainPlan
  : null;
const iterations=200;
function run(planner) {
  let total=0,checksum=0;
  for(let i=0;i<iterations;i++)for(const t of tiles){
    const plan=planner(map,t);
    checksum+=plan.pavers.length+plan.soil.length+plan.grass.length;
    total++;
  }
  return {total,checksum};
}
const median=values=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];
// Warm both implementations before comparing short intervals.
for(let i=0;i<3;i++){run(candidate);if(previous)run(previous);}
const samples={candidate:[],previous:[]};
const counts={candidate:null,previous:null};
for(let round=0;round<9;round++){
  for(const [name,fn] of (round%2===0
    ? [["candidate",candidate],["previous",previous]]
    : [["previous",previous],["candidate",candidate]])){
    if(!fn)continue;
    const start=performance.now();
    const result=run(fn);
    samples[name].push(+(performance.now()-start).toFixed(3));
    if(counts[name] && result.checksum!==counts[name].checksum)
      throw new Error("Planner returned inconsistent feature counts");
    counts[name]=result;
  }
}
if(previous && counts.candidate.checksum!==counts.previous.checksum)
  throw new Error("Optimization unexpectedly changes generated feature counts");
const report={
  node:process.version,platform:process.platform,arch:process.arch,
  scenario:"4 real Greyhaven chunks, 200 iterations each (800 planner calls / sample); sequential alternating A/B rounds",
  previousRevision:previous?(process.env.GREYHAVEN_PREVIOUS_SHA||'external comparison module'):null,
  samples,
  medianMs:{candidate:median(samples.candidate),previous:previous?median(samples.previous):null},
  featureCounts:counts,
  scope:"Node CPU-only planner benchmark. Not Chrome Canvas, frame duration, memory, multiplayer or GPU FPS."
};
if(process.env.GREYHAVEN_BENCH_REPORT)
  await writeFile(resolve(process.env.GREYHAVEN_BENCH_REPORT),JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify(report,null,2));

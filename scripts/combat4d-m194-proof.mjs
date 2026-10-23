// QA-only historical M194 witness verification: live original World BLOCK then
// legal PARRY, so native M194 block-only acceptance is HOLD, never PASS.
// JSON cannot independently authenticate original GitHub/physical events.
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";

function parseWorld(line) {
  let m=/^M201_AUTH_ACTION tick=(\d+) fighter=(\d+) from=(\d+) to=(\d+)$/.exec(line);
  if (m) return {kind:"ACTION",tick:+m[1],actor:+m[2],from:+m[3],to:+m[4]};
  m=/^M201_AUTH_(BLOCK|PARRY) tick=(\d+) attacker=(\d+) target=(\d+)$/.exec(line);
  if (m) return {kind:m[1],tick:+m[2],attacker:+m[3],target:+m[4]};
  throw Error("Unrecognized original Rust World trace");
}
const only=(rows,message)=>{
  if (rows.length!==1) throw Error(message);
  return rows[0];
};

export function assessM194Witness(w) {
  if(!/^[a-f0-9]{40}$/.test(w?.candidate_sha??"")
    || !/^https:\/\/github\.com\/tehki\/myaso\/actions\/runs\/[1-9]\d*$/.test(w?.source_run_url??"")
    || !Number.isSafeInteger(w?.source_job_id)
    || w?.source_step!=="Validate M194 repeated real guard-break block-only pressure"
    || w?.source_outcome!=="failure"
    || w?.nested_failure!=="M193 guard-break exchange 2 resolved as parry instead of -38 guard"
    || w?.qa_disposition!=="HOLD")throw Error("Missing original exact-head M194 failure provenance");
  if(w.world_hz!==60 || w.parry_window_ms!==125 || w.expected_single_guard_damage!==38)
    throw Error("Original 60Hz World parry/block constants altered");
  if(!Array.isArray(w.world_exchanges)||w.world_exchanges.length!==2
    || !Array.isArray(w.original_w3c_ingress)||w.original_w3c_ingress.length!==2)
    throw Error("Required two original native exchanges");
  const n=w.native_browser;
  if(n?.chrome?.id!==1||n?.firefox?.id!==2
    || n.chrome.hp!==100||n.firefox.hp!==100
    || n.chrome.guard!==100||n.firefox.guard!==62
    || JSON.stringify(n.chrome.feedback)!==JSON.stringify(["block-confirm","parried"])
    || JSON.stringify(n.firefox.feedback)!==JSON.stringify(["guard-pressure","parry-success"]))
    throw Error("Real browser HP/guard/block/parry feedback contradicted");
  const clicks=n.chrome.physical_w3c_clicks;
  if(!Array.isArray(clicks)||clicks.length!==4)throw Error("Four genuine original Chrome W3C LMB edges required");
  for(let j=0;j<4;j+=2) {
    if(clicks[j]?.type!=="pointerdown"||clicks[j+1]?.type!=="pointerup"
      || clicks[j].button!==0 || clicks[j+1].button!==0
      || !(clicks[j+1].epochMs>clicks[j].epochMs))
      throw Error("Original W3C Chrome pointer lifetime tampered");
  }
  const result=[];
  for(let k=0;k<2;k++){
    const ex=w.world_exchanges[k], ing=w.original_w3c_ingress[k];
    if(ex?.attempt!==k+1||ex.attackerNetId!==1||ex.defenderNetId!==2
      || !Array.isArray(ex.tickLines)||ing?.attempt!==k+1)
      throw Error("Attempt ownership/actor order mismatch");
    const es=ex.tickLines.map(parseWorld);
    for(let j=1;j<es.length;j++)if(es[j].tick<es[j-1].tick)throw Error("World ticks reordered");
    const guard=only(es.filter(e=>e.kind==="ACTION"&&e.actor===2&&e.from===0&&e.to===6),
      "Authentic defender Block6 missing");
    const impact=only(es.filter(e=>e.kind==="BLOCK"||e.kind==="PARRY"),
      "Must retain single real World BLOCK or PARRY result");
    if(impact.attacker!==1||impact.target!==2||impact.tick<guard.tick)
      throw Error("Real World hit actor or chronology mismatch");
    const active=(impact.kind==="BLOCK")?2:7;
    const change=only(es.filter(e=>e.kind==="ACTION"&&e.actor===1&&e.to===active
      &&e.tick===impact.tick),"Original server attack/ParryStun edge missing");
    if(change.tick!==impact.tick)throw Error("World action mismatch");
    const delta=impact.tick-guard.tick;
    const expectedResult=delta*1000/w.world_hz < w.parry_window_ms ? "PARRY" : "BLOCK";
    if(expectedResult!==impact.kind)throw Error("Changed World parry-age correctness");
    const requiredResult=k===0?"BLOCK":"PARRY";
    const requiredTicks=k===0?7:6;
    if(impact.kind!==requiredResult||delta!==requiredTicks)
      throw Error("Not the exact original M194 first-BLOCK then second-PARRY source failure");
    if(ing.trustedWheelBeforeRelease!==true||ing.harnessW3c?.wheelHeadStartMs!==0
      ||ing.chrome?.feedback!==(k===0?"block-confirm":"parried")
      ||ing.firefox?.hp!==100||ing.firefox?.guard!==(k===0?62:62)
      ||!(ing.wheelEventEpochMs<ing.chromeReleaseEpochMs)
      || clicks[k*2+1].epochMs!==ing.chromeReleaseEpochMs
      || !Number.isFinite(ing.firefox.wheelToImpactOrParryMs))
      throw Error("Original trusted wheel and Chrome release provenance missing");
    result.push({exchange:k+1,result:impact.kind,block_tick:guard.tick,
      contact_tick:impact.tick,block_age_ticks:delta,guard_damage:k===0?38:0});
  }
  return {classification:"HOLD",does_not_certify_gameplay:true,
    source_run:w.source_run_url,world_results:result,
    reason:"Protected M194 second block-only exchange legitimately PARRIED 6 ticks/100ms after Block6, so second -38 guard pressure is false",
    offline_json_authenticates_github:false};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    if(!process.argv[2])throw Error("Usage: node scripts/combat4d-m194-proof.mjs <evidence.json>");
    const output=assessM194Witness(JSON.parse(readFileSync(resolve(process.argv[2]),"utf8")));
    console.log(JSON.stringify(output,null,2));
    process.exitCode=output.classification==="HOLD"?0:1;
  }catch(e){console.error(e.message);process.exitCode=2;}
}

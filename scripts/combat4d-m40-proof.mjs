// Historical native M40/M193 witness consistency checker. Intentionally HOLD:
// a successful forensic check is not gameplay PASS or authenticated GitHub evidence.
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";

export function assessM40Witness(w) {
  if (!/^[a-f0-9]{40}$/.test(w?.candidate_sha??"")
    || !/^https:\/\/github\.com\/tehki\/myaso\/actions\/runs\/[1-9]\d*$/.test(w?.source_run_url??"")
    || !Number.isSafeInteger(w?.source_job_id)
    || w?.source_step!=="Validate M40 spatial FFA guard-break tell"
    || w?.source_outcome!=="failure"
    || w?.qa_disposition!=="HOLD"
    || w?.inner_error!=="M193 guard-break exchange 1 resolved as parry instead of -38 guard")
    throw Error("Original exact-head protected M40 failure identity absent");
  const t=w.original_world_trace, a=w.original_m212_ingress,b=w.original_browser_evidence;
  if(t?.attempt!==1||t.attackerNetId!==1||t.defenderNetId!==2||!Array.isArray(t.tickLines)
    || t.tickLines.length!==5 || a?.attempt!==1
    || b?.attacker_browser!=="chrome"||b?.defender_browser!=="firefox")
    throw Error("Original independent actor/first-exchange witness missing");
  const expected=[
    "M201_AUTH_ACTION tick=210 fighter=1 from=0 to=9",
    "M201_AUTH_ACTION tick=211 fighter=1 from=9 to=1",
    "M201_AUTH_ACTION tick=213 fighter=2 from=0 to=6",
    "M201_AUTH_ACTION tick=219 fighter=1 from=1 to=7",
    "M201_AUTH_PARRY tick=219 attacker=1 target=2"
  ];
  if(JSON.stringify(t.tickLines)!==JSON.stringify(expected))
    throw Error("Real World action order/Block6/ParryStun7 chronology changed");
  const ticks=219-213,parryMs=ticks*1000/60;
  if(ticks!==6||!(parryMs<125))
    throw Error("Original 60Hz/125ms World legal parry violated");
  if(a.trustedWheelBeforeRelease!==true
    || a.harnessW3c?.wheelHeadStartMs!==0
    || a.firefox?.wheelToBlockCueMs!==83
    || a.firefox?.wheelToImpactOrParryMs!==166
    || a.firefox?.hp!==100||a.firefox?.guard!==100
    || a.chrome?.feedback!=="parried"
    || !(a.wheelEventEpochMs<a.chromeReleaseEpochMs))
    throw Error("Original trusted Firefox wheel/native chronology missing");
  if(b.attacker_hp!==100||b.attacker_guard!==100
    || b.defender_hp!==100||b.defender_guard!==100
    || !b.attacker_feedback?.includes("parried")
    || !b.defender_feedback?.includes("parry-success"))
    throw Error("Native genuine parry/zero guard damage outcome altered");
  const ptr=b.attacker_pointer_events;
  if(!Array.isArray(ptr)||ptr.length!==2
    ||ptr[0]?.type!=="pointerdown"||ptr[1]?.type!=="pointerup"
    ||ptr[0]?.button!==0||ptr[1]?.button!==0
    ||ptr[0]?.epochMs!==1792755079099||ptr[1]?.epochMs!==1792755079109
    ||ptr[1].epochMs!==a.chromeReleaseEpochMs)
    throw Error("Genuine original Chrome pointerDOWN/UP provenance changed");
  return {
    classification:"HOLD", does_not_certify_gameplay:true,
    source_run:w.source_run_url,
    real_world_defender_block_tick:213,
    real_world_parry_tick:219,
    original_parry_age_ms:parryMs,
    real_hp_damage:0, real_guard_damage:0,
    failed_requirement:"M40 M193 exchange 1 must be a true -38 guard BLOCK, but original World legally PARRIED",
    provenance_verified_by_offline_json:false
  };
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    if(!process.argv[2]) throw Error("Usage: node scripts/combat4d-m40-proof.mjs <witness.json>");
    const result=assessM40Witness(JSON.parse(readFileSync(resolve(process.argv[2]),"utf8")));
    console.log(JSON.stringify(result,null,2));
    process.exitCode=result.classification==="HOLD"?0:1;
  }catch(e){console.error(e.message);process.exitCode=2;}
}

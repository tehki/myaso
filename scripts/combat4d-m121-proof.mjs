// Offline classification of one failed native M121 event. Never certify gameplay
// from a self-attested fixture: actual GitHub-run provenance must be audited.
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";

const marker="Error: M121 left-sweep readability was incomplete: ";
const own=(obj,key)=>Object.prototype.hasOwnProperty.call(obj,key);
export function assessM121Witness(evidence){
  const id=evidence?.source_run_url?.match(/^https:\/\/github\.com\/tehki\/myaso\/actions\/runs\/(\d+)$/);
  if(!id || !/^[0-9a-f]{40}$/.test(evidence.candidate_sha??"")
    || evidence.source_outcome!=="failure"
    || evidence.source_step!=="Validate M121 real directional light"
    || !Number.isSafeInteger(evidence.source_job_id)
    || !evidence.original_native_firefox_log_error?.startsWith(marker))
    throw Error("Failed exact-head protected M121 source reference missing");
  let raw;
  try{raw=JSON.parse(evidence.original_native_firefox_log_error.slice(marker.length));}
  catch{throw Error("Original native error payload is not valid JSON");}
  const f=evidence.original_firefox_snapshot??{};
  if(raw.browser!=="firefox"||raw.playerNetId!==2
    || f.browser!==raw.browser||f.player_net_id!==raw.playerNetId
    || raw.playerHp!==66||f.player_hp!==raw.playerHp
    || raw.playerGuard!==100||f.player_guard!==raw.playerGuard
    || !raw.events?.includes("Hit taken - 34 HP.")
    || JSON.stringify(raw.events)!==JSON.stringify(f.events)
    || JSON.stringify(raw.threatTransitions)!==JSON.stringify(f.threat_transitions)
    || JSON.stringify(raw.recoveryTransitions)!==JSON.stringify(f.recovery_transitions)
    || JSON.stringify(raw.focusTransitions)!==JSON.stringify(f.focus_transitions))
    throw Error("Native Firefox error and transcribed evidence differ");
  const contract=evidence.readability_contract??{};
  if(contract.required_damage_hp!==34
    || JSON.stringify(contract.required_directional_phase)!==JSON.stringify(["LEFT WINDUP","LEFT SWEEP"])
    || contract.required_recovery_state!=="directional-attack-recovery"
    || contract.required_recovery_detail!=="Sweep recovery"
    || contract.actual_hit_success!==true
    || contract.gameplay_status!=="HOLD")
    throw Error("Directional light protected acceptance invariants were changed");
  const visible=raw.threatTransitions?.filter(x=>x.visible)??[];
  const recoveries=raw.recoveryTransitions?.filter(x=>x.visible)??[];
  if(!visible.some(x=>x.phase==="WINDUP")
    || !visible.some(x=>x.phase==="STRIKE")
    || visible.some(x=>["LEFT WINDUP","LEFT SWEEP"].includes(x.phase))
    || !recoveries.some(x=>x.state==="attack-recovery")
    || recoveries.some(x=>x.state==="directional-attack-recovery")
    || !recoveries.every(x=>x.detail!=="Sweep recovery"))
    throw Error("This fixture is not the specific original generic-light regression");
  return {
    status:"HOLD",native_browser:"firefox",source_run:evidence.source_run_url,
    defender_hp:raw.playerHp,real_hit_damage:34,
    observed_visible_phases:visible.map(x=>x.phase),
    observed_visible_recovery:recoveries.map(x=>x.state),
    left_sweep_proven:false,
    reason:"Genuine 34HP hit with FROM LEFT bearing, but no LEFT WINDUP/LEFT SWEEP or Sweep recovery: protected M121 FAIL. This fixture cannot authenticate origin by itself."
  };
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    if(!process.argv[2])throw Error("Usage: node scripts/combat4d-m121-proof.mjs <witness.json>");
    const result=assessM121Witness(JSON.parse(readFileSync(resolve(process.argv[2]),"utf8")));
    console.log(JSON.stringify(result,null,2));
    process.exitCode=result.status==="HOLD"?0:1; // Evidence classification success != game PASS.
  }catch(e){console.error(e.message);process.exitCode=2;}
}

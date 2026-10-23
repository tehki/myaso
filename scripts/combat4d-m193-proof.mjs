// Independent QA-only classifier of an immutable M205/M193 native failure witness.
// An integrity test PASS does NOT reverse the genuine protected gameplay HOLD.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const validRun = /^https:\/\/github\.com\/tehki\/myaso\/actions\/runs\/\d+$/;
function parseLine(line) {
  let m = /^M201_AUTH_ACTION tick=(\d+) fighter=(\d+) from=(\d+) to=(\d+)$/.exec(line);
  if (m) return { kind: "action", tick:+m[1], actor:+m[2], from:+m[3], to:+m[4] };
  m = /^M201_AUTH_(BLOCK|PARRY) tick=(\d+) attacker=(\d+) target=(\d+)$/.exec(line);
  if (m) return { kind:m[1],tick:+m[2],attacker:+m[3],target:+m[4] };
  throw new Error("Unknown original World trace line: " + line);
}
function single(xs, reason) {
  if (xs.length !== 1) throw new Error(reason);
  return xs[0];
}

export function assessM193Witness(witness) {
  if (!/^[0-9a-f]{40}$/i.test(witness?.candidate_sha)
    || !validRun.test(witness?.source_run_url)
    || witness?.source_step !== "Validate M205 repeated M201 server-tick FFA punish proof"
    || witness?.source_outcome !== "failure")
    throw new Error("Missing exact-head protected failure identity");

  const { attacker, defender, observer } = witness.actors ?? {};
  if (![attacker,defender,observer].every(n => Number.isSafeInteger(n) && n > 0)
    || new Set([attacker,defender,observer]).size !== 3)
    throw new Error("Three genuine distinct actor identities required");
  if (witness.world_hz !== 60 || witness.parry_window_ms !== 125
    || witness.expected_guard_pressure !== 38)
    throw new Error("Original World clock/parry/guard constants changed");
  if (!Array.isArray(witness.exchanges) || witness.exchanges.length !== 2)
    throw new Error("Two original real-native exchanges required");

  const rows=witness.exchanges.map((exchange,index)=>{
    if (exchange.attempt !== index+1
      || !Array.isArray(exchange.authoritative_lines)
      || exchange.authoritative_lines.length < 4)
      throw new Error("Missing original authoritative exchange");
    const events=exchange.authoritative_lines.map(parseLine);
    for(let j=1;j<events.length;j++){
      if(events[j].tick<events[j-1].tick)throw new Error("Reordered World ticks");
    }
    const block=single(events.filter(e=>e.kind==="action"&&e.actor===defender&&e.from===0&&e.to===6),
      "Missing one original defender Block6");
    const resolution=single(events.filter(e=>["BLOCK","PARRY"].includes(e.kind)),
      "Must preserve exact original Block or Parry outcome");
    if(resolution.attacker!==attacker||resolution.target!==defender||resolution.tick<block.tick)
      throw new Error("Uncorrelated attacker/defender server resolution");
    const elapsedTicks=resolution.tick-block.tick;
    const elapsedMs=elapsedTicks*1000/witness.world_hz;
    const expectedOutcome=elapsedMs<witness.parry_window_ms?"PARRY":"BLOCK";
    if(expectedOutcome!==resolution.kind || exchange.outcome!==resolution.kind
      || exchange.defender_hp!==100)
      throw new Error("World result/HP contradicts original parry age");

    const initialGuard=100-index*witness.expected_guard_pressure;
    const expectedGuard=resolution.kind==="BLOCK"?initialGuard-witness.expected_guard_pressure:initialGuard;
    if(exchange.defender_guard!==expectedGuard)
      throw new Error("False claimed -38 guard or parry guard");
    return {attempt:index+1,block_tick:block.tick,resolution_tick:resolution.tick,
      elapsed_ticks:elapsedTicks,elapsed_ms:Math.round(elapsedMs*10)/10,
      result:resolution.kind,guard:exchange.defender_guard,hp:exchange.defender_hp};
  });
  const [first,second]=rows;
  if(first.result!=="BLOCK"||second.result!=="PARRY"
    || first.elapsed_ticks!==8 || second.elapsed_ticks!==6)
    throw new Error("Not the original protected first BLOCK / second PARRY failure");
  const native=witness.exchanges[1].native_browser_witness??{};
  if(!Number.isFinite(native.chrome_pointerdown_epoch_ms)
    || !(native.chrome_pointerup_epoch_ms>native.chrome_pointerdown_epoch_ms)
    || !Number.isFinite(native.firefox_wheel_event_epoch_ms)
    || native.trusted_firefox_wheel_before_chrome_release!==true
    || native.wheel_head_start_ms!==0
    || native.firefox_wheel_to_impact_or_parry_ms!==221)
    throw new Error("Incomplete original native W3C/Firefox wheel provenance");

  return {status:"HOLD",reason:"M205 guard-break prerequisite fails: second M193 exchange is a legally true 125ms parry, not the required -38 guard block",
    attempts:rows,original_run:witness.source_run_url,does_not_certify_gameplay:true};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    if(!process.argv[2]) throw Error("Usage: node scripts/combat4d-m193-proof.mjs <evidence.json>");
    const evidence=JSON.parse(readFileSync(resolve(process.argv[2]),"utf8"));
    const report=assessM193Witness(evidence);
    console.log(JSON.stringify(report,null,2));
    process.exitCode=report.status==="HOLD"?0:1; // Successful forensic classification != gameplay PASS.
  }catch(e){console.error(e.message);process.exitCode=2;}
}

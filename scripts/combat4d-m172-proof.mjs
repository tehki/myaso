// QA-only strict transcription checker for a historically RED M172 native run.
// It cannot independently authenticate GitHub provenance and NEVER declares game PASS.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const originalStep = "Validate M173 confirmed jump-attack chord denial";
export function assessM172Witness(e) {
  if (!/^[a-f0-9]{40}$/.test(e?.candidate_sha ?? "")
    || !/^https:\/\/github\.com\/tehki\/myaso\/actions\/runs\/[1-9]\d*$/.test(e?.source_run_url ?? "")
    || !Number.isSafeInteger(e?.source_job_id)
    || e?.source_outcome !== "failure"
    || e?.source_step !== originalStep
    || e?.nested_failure !== "M172 confirmed airborne jump-attack denial"
    || !e?.original_runner_error?.startsWith("Error: M172 confirmed airborne jump-attack denial timed out")
    || e.qa_disposition !== "HOLD") {
    throw Error("Exact-head native protected failure identity is missing");
  }
  const w = e.reported_original_client ?? {};
  if (w.browser !== "chrome" || w.player_net_id !== 1
    || w.final_authoritative_stamina !== 28
    || !Number.isSafeInteger(w.final_server_tick)) {
    throw Error("Original Chrome actor World witness is not intact");
  }
  const d = w.denial_transitions;
  if (!Array.isArray(d) || d.length !== 3
    || d[0].stage !== "queued" || d[1].stage !== "submitted"
    || d[2].stage !== "confirmed-not-stamina"
    || d.some(x => x.action !== "jump-attack")
    || d[0].baselineStamina !== 10
    || d[2].authoritativeStamina !== 12
    || d[2].authoritativeAction !== 0
    || !Number.isSafeInteger(d[1].clientTick)
    || !Number.isSafeInteger(d[2].processedClientTick)
    || d[2].processedClientTick < d[1].clientTick
    || !(d[0].epochMs < d[1].epochMs && d[1].epochMs < d[2].epochMs)
    || d.some(x => ["shown", "confirmed-rejected"].includes(x.stage))) {
    throw Error("Original queued/submitted/stamina-regenerated ACK stages were altered");
  }
  const trace = w.stamina_trace;
  const jumps = w.action_transitions;
  if (!Array.isArray(trace) || !trace.some(x => x.serverTick === 570 && x.stamina === 10)
    || !trace.some(x => x.serverTick === 594 && x.stamina === 12)
    || !Array.isArray(jumps) || !jumps.some(x => x.action === 15 && x.serverTick === 570)
    || !jumps.some(x => x.action === 0 && x.serverTick === 594)) {
    throw Error("Original real World ordinary Jump and regenerating authoritative stamina missing");
  }
  const ptr = w.pointer_transitions;
  const down = ptr?.find(x=>x.type === "pointerdown" && x.button === 0 && x.epochMs === d[0].epochMs);
  const up = ptr?.find(x=>x.type === "pointerup" && x.button === 0 && x.epochMs > d[0].epochMs);
  if (!down || !up || !w.key_transitions?.some(x => x.code === "Space" && x.type === "keydown")) {
    throw Error("Original genuine W3C input presence is not transcribed");
  }
  if (!Array.isArray(w.events) || !Array.isArray(w.feedback)
    || w.events.includes(e.required_denial_feedback)
    || w.feedback.includes("stamina-denied")
    || e.required_denial_feedback !== "Low stamina — jump attack needs 12."
    || e.expected_confirmation !== "confirmed-rejected") {
    throw Error("Original failure must not be silently relabeled as successful stamina denial");
  }
  return {
    status:"HOLD", does_not_certify_gameplay:true,
    world_jump_tick:570, world_stamina_at_jump:10,
    confirmed_snapshot_tick:594, world_stamina_at_confirmation:12,
    queued_client_tick:d[1].clientTick, acknowledged_processed_client_tick:d[2].processedClientTick,
    denial_stage:d[2].stage,
    reason:"The original authoritative confirmation observed 12 stamina and was not a low-stamina rejection; required confirmed-rejected+shown native milestone failed. This checker only proves consistency of a historical RED transcription."
  };
}

if(process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (!process.argv[2]) throw Error("Usage: node scripts/combat4d-m172-proof.mjs <evidence.json>");
    const result = assessM172Witness(JSON.parse(readFileSync(resolve(process.argv[2]),"utf8")));
    console.log(JSON.stringify(result,null,2));
    process.exitCode = result.status === "HOLD" ? 0 : 1; // forensic check green != combat green
  } catch(e) { console.error(e.message); process.exitCode=2; }
}

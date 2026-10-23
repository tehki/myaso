// Independent QA verification of one real M107 heavy/dodge witness.
// Does not replace native W3C testing or authorize any release.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const shaPattern = /^[0-9a-f]{40}$/i;
function parseServerLine(raw) {
  const action = /^M201_AUTH_ACTION tick=(\d+) fighter=(\d+) from=(\d+) to=(\d+)$/.exec(raw);
  if (action) return { kind: "action", tick: Number(action[1]), actor: Number(action[2]), from: Number(action[3]), to: Number(action[4]) };
  const hit = /^M201_AUTH_HIT tick=(\d+) attacker=(\d+) target=(\d+) damage=(\d+) hp=(\d+)$/.exec(raw);
  if (hit) return { kind: "hit", tick: Number(hit[1]), attacker: Number(hit[2]), target: Number(hit[3]), damage: Number(hit[4]), hp: Number(hit[5]) };
  throw new Error("Unrecognized authoritative trace line: " + raw);
}

export function assessM107Witness(witness) {
  if (!shaPattern.test(witness?.candidate_sha)
    || !/^https:\/\/github\.com\/tehki\/myaso\/actions\/runs\/\d+$/.test(witness?.run_url)
    || witness.job_step !== "Validate M107 real heavy counterplay")
    throw new Error("Missing exact-head run identity");
  const { attacker, defender } = witness.actor_ids ?? {};
  if (!Number.isSafeInteger(attacker) || !Number.isSafeInteger(defender) || attacker === defender)
    throw new Error("Attacker/defender actor identities invalid");
  if (!Array.isArray(witness.authoritative_server_events) || witness.authoritative_server_events.length === 0)
    throw new Error("No authoritative World chronology");
  const parsed = witness.authoritative_server_events.map(event => {
    const { source, ...declared } = event;
    const fromLog = parseServerLine(source);
    if (JSON.stringify(declared) !== JSON.stringify(fromLog)) {
      throw new Error("Derived event does not match its exact log line");
    }
    return fromLog;
  });
  for (let i = 1; i < parsed.length; i++) {
    if (parsed[i].tick < parsed[i - 1].tick) throw new Error("Nonmonotonic server event chronology");
  }
  const heavy = parsed.find(event => event.kind === "action" && event.actor === attacker && event.to === 10);
  const hit = parsed.find(event => event.kind === "hit" && event.attacker === attacker
    && event.target === defender && event.damage === 46);
  const dodge = parsed.find(event => event.kind === "action" && event.actor === defender && event.to === 4);
  if (!heavy || !hit || !dodge || heavy.tick !== hit.tick)
    throw new Error("M107 witness missing linked HeavyActive/46HP Hit/Dodge events");
  const ui = witness.native_browser_observation ?? {};
  if (ui.defender_actor !== defender || ui.browser !== "chrome"
    || ui.trusted_wheel_back_recorded !== true
    || !Array.isArray(ui.chronological_feedback))
    throw new Error("Genuine defender browser evidence missing");
  const damageFeedback = ui.chronological_feedback.findIndex(v => v === "Hit taken - 46 HP.");
  const successFeedback = ui.chronological_feedback.findIndex(v => v === "Dodge! Strike avoided.");
  const gotHitBeforeDodge = hit.tick < dodge.tick;
  const falseSuccessFeedback = gotHitBeforeDodge && damageFeedback >= 0 && successFeedback > damageFeedback;
  if (gotHitBeforeDodge && ui.player_hp === hit.hp) return {
    status: "HOLD",
    reason: falseSuccessFeedback
      ? "Real 46HP server hit precedes Dodge and client later claims successful dodge"
      : "Real 46HP server hit precedes Dodge; protected M107 evade requirement failed",
    hit_tick: hit.tick,
    dodge_tick: dodge.tick,
    damage: hit.damage,
    hp: hit.hp,
    false_success_feedback: falseSuccessFeedback,
    source: witness.run_url
  };
  return {
    status: "NOT QUALIFIED",
    reason: "Witness does not independently prove a valid evasion; fresh native acceptance required",
    source: witness.run_url
  };
}

const executedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (executedPath === fileURLToPath(import.meta.url)) {
  try {
    const pathname = process.argv[2];
    if (!pathname) throw new Error("Usage: node scripts/combat4d-m107-proof.mjs <witness.json>");
    const report = assessM107Witness(JSON.parse(readFileSync(resolve(pathname), "utf8")));
    console.log(JSON.stringify(report, null, 2));
    // Verification of a known failing source report succeeds as an integrity check.
    // The printed HOLD is a gameplay QA failure, never a positive gameplay result.
    process.exitCode = report.status === "HOLD" ? 0 : 1;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
}

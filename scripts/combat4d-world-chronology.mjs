// Combat 4D read-only QA: classify one original Rust World M111 exchange.
// Input is the complete, chronologically ordered M201_AUTH_* output of ONE run.
// Never classify absent or incomplete evidence as a successful punish.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export function classifyGuardBreakPunishWorld(log) {
  if (typeof log !== "string") return { status: "INDETERMINATE", reason: "non-text log" };
  const events = [];
  for (const line of log.split(/\r?\n/)) {
    // Reject embedded copied lines (e.g. M320 JSON trace), which are not
    // additional World transitions and would double-count genuine events.
    const raw = line.match(/(?:^|\s)(M201_AUTH_(?:ACTION|BREAK|HIT)\b[^\r\n]*)$/)?.[1];
    if (!raw) continue;
    let match = raw.match(/^M201_AUTH_BREAK tick=(\d+) attacker=(\d+) target=(\d+)$/);
    if (match) {
      events.push({ type: "break", tick: Number(match[1]), attacker: Number(match[2]), target: Number(match[3]) });
      continue;
    }
    match = raw.match(/^M201_AUTH_HIT tick=(\d+) attacker=(\d+) target=(\d+) damage=(\d+) hp=(\d+)$/);
    if (match) {
      events.push({ type: "hit", tick: Number(match[1]), attacker: Number(match[2]), target: Number(match[3]), damage: Number(match[4]), hp: Number(match[5]) });
      continue;
    }
    match = raw.match(/^M201_AUTH_ACTION tick=(\d+) fighter=(\d+) from=(\d+) to=(\d+)$/);
    if (match) events.push({ type: "action", tick: Number(match[1]), fighter: Number(match[2]), from: Number(match[3]), to: Number(match[4]) });
  }
  const unknown = (reason) => ({ status: "INDETERMINATE", reason });
  if (!events.length) return unknown("no authoritative World chronology");
  if (events.some((event, i) => i > 0 && event.tick < events[i - 1].tick)) return unknown("out-of-order World ticks");
  const breaks = events.filter((event) => event.type === "break");
  const hits = events.filter((event) => event.type === "hit");
  if (breaks.length !== 1 || hits.length !== 1) return unknown("requires exactly one break and one hit in a single-run trace");
  const broken = breaks[0], hit = hits[0];
  if (broken.attacker !== hit.attacker || broken.target !== hit.target
    || hit.tick < broken.tick || hit.damage !== 34 || hit.hp !== 66) {
    return unknown("mismatched actor, ordering, or exact M111 damage");
  }
  // Original Rust wire codes: Block=6, Stunned=7, Idle=0.
  const enters = events.filter((event) => event.type === "action"
    && event.fighter === broken.target && event.from === 6 && event.to === 7
    && event.tick === broken.tick);
  const exits = events.filter((event) => event.type === "action"
    && event.fighter === broken.target && event.from === 7 && event.to === 0
    && event.tick >= broken.tick);
  if (enters.length !== 1 || exits.length !== 1) return unknown("missing or duplicated server stun transitions");
  const enter = enters[0], exit = exits[0];
  const enterIndex = events.indexOf(enter), exitIndex = events.indexOf(exit);
  const hitIndex = events.indexOf(hit);
  if (enterIndex > hitIndex || exitIndex < enterIndex) return unknown("contradictory server stun chronology");
  const after = exitIndex < hitIndex;
  return {
    status: after ? "AFTER_STUN" : "WITHIN_STUN",
    reason: after ? "authoritative target exited STUNNED before 34HP HIT" : "authoritative 34HP HIT preceded exit from STUNNED",
    attacker: hit.attacker, target: hit.target, breakTick: broken.tick,
    stunnedEnterTick: enter.tick, stunnedExitTick: exit.tick,
    hitTick: hit.tick, exitToHitTicks: hit.tick - exit.tick,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const path = process.argv[2];
  if (!path) {
    console.error("Usage: node scripts/combat4d-world-chronology.mjs <one-run-world-log.txt>");
    process.exitCode = 2;
  } else {
    const result = classifyGuardBreakPunishWorld(readFileSync(path, "utf8"));
    console.log(JSON.stringify(result, null, 2));
    if (result.status !== "WITHIN_STUN") process.exitCode = 1;
  }
}

// Combat4 read-only analyzer for ORIGINAL real browser M320 traces.
// Server-derived World ticks/Block/Parry/GuardBreak are evidence. This tool
// never changes an input, retries an exchange, or asserts gameplay success.
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const PREFIX = "M320_GUARD_BREAK_AUTH_TRACE ";
const ACTION = /^M201_AUTH_ACTION tick=(\d+) fighter=(\d+) from=(\d+) to=(\d+)$/;
const IMPACT = /^M201_AUTH_(BLOCK|PARRY|BREAK) tick=(\d+) attacker=(\d+) target=(\d+)$/;

export function auditGuardTrace(entry) {
  if (!entry || !Number.isSafeInteger(entry.attempt) || entry.attempt < 1
    || !Number.isSafeInteger(entry.attackerNetId) || entry.attackerNetId < 1
    || !Number.isSafeInteger(entry.defenderNetId) || entry.defenderNetId < 1
    || entry.attackerNetId === entry.defenderNetId || !Array.isArray(entry.tickLines)
    || entry.tickLines.length > 64 || entry.tickLines.some(x => typeof x !== "string")) {
    throw new TypeError("M320 requires bounded real actor/tick lines");
  }
  const actions = [];
  const impacts = [];
  for (const line of entry.tickLines) {
    const a = ACTION.exec(line);
    if (a) {
      actions.push({ tick: Number(a[1]), fighter: Number(a[2]), from: Number(a[3]), to: Number(a[4]) });
      continue;
    }
    const e = IMPACT.exec(line);
    if (e) {
      impacts.push({ kind: e[1], tick: Number(e[2]), attacker: Number(e[3]), target: Number(e[4]) });
      continue;
    }
    throw new TypeError("Unexpected or unauthenticated-looking M201 trace line");
  }
  const actor = entry.attackerNetId, defender = entry.defenderNetId;
  const blockStarts = actions.filter(a => a.fighter === defender && a.to === 6);
  const attackStarts = actions.filter(a => a.fighter === actor && (a.to === 1 || a.to === 9));
  const results = impacts.filter(i => i.attacker === actor && i.target === defender).map(i => {
    const block = blockStarts.filter(a => a.tick <= i.tick).at(-1);
    const press = attackStarts.filter(a => a.tick <= i.tick).at(-1);
    const delta = block ? i.tick - block.tick : null;
    return {
      authoritativeResult: i.kind,
      hitServerTick: i.tick,
      blockStartServerTick: block?.tick ?? null,
      attackerWindupServerTick: press?.tick ?? null,
      serverTickIndexGap: delta,
      // True World.action_elapsed_ms is not logged here; do NOT infer its
      // exact value from tick indices, JS clocks or WebDriver action ACKs.
      boundaryContext: delta === null ? "MISSING_BLOCK_EDGE"
        : delta <= 6 ? "SHORT_GAP_COMPATIBLE_WITH_PARRY"
        : delta >= 8 && delta <= 14 ? "GAP_COMPATIBLE_WITH_GUARDED_CONTACT"
        : "AMBIGUOUS_NEEDS_AUTHORITY_ELAPSED_MS",
    };
  });
  return {
    attempt: entry.attempt, attackerNetId: actor, defenderNetId: defender,
    results,
    evidenceComplete: results.length > 0 && results.every(x =>
      x.blockStartServerTick !== null && x.attackerWindupServerTick !== null),
    fullNativeAcceptanceProven: false,
  };
}

export function auditM320Log(log) {
  if (typeof log !== "string") throw new TypeError("log text required");
  const records = [];
  for (const line of log.split(/\r?\n/)) {
    const pos = line.indexOf(PREFIX);
    if (pos < 0) continue;
    const source = line.slice(pos + PREFIX.length).trim();
    records.push(auditGuardTrace(JSON.parse(source)));
  }
  return records;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const findings = auditM320Log(readFileSync(0, "utf8"));
    if (!findings.length) throw Error("no genuine M320 guarded-exchange traces provided");
    process.stdout.write(JSON.stringify({ attempts: findings, previewOnly: true }, null, 2) + "\n");
  } catch (error) {
    console.error("COMBAT4_M320_AUDIT_FAILED", String(error));
    process.exitCode = 1;
  }
}

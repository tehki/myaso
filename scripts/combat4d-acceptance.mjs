// Combat 4D -- independent, fail-closed P0 acceptance inventory and evidence gate.
// This checker validates claimed evidence structure, NOT independent provenance; it does NOT simulate player inputs,
// substitute for the real Rust World, or grant deployment authority.
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
export const MATRIX_PATH = resolve(ROOT, "qa/combat4d-prealpha-acceptance.json");
export const SHA_PATTERN = /^[0-9a-f]{40}$/i;
const KINDS = new Set(["native", "world", "network", "multiplayer", "human", "ci"]);

export function loadMatrix(path = MATRIX_PATH) {
  const matrix = JSON.parse(readFileSync(path, "utf8"));
  if (matrix.schemaVersion !== 1 || !SHA_PATTERN.test(matrix.baseline?.sha)) {
    throw new Error("Invalid Combat 4D matrix schema or baseline SHA");
  }
  if (!Array.isArray(matrix.rows) || matrix.rows.length === 0) throw new Error("Empty acceptance matrix");
  const ids = new Set();
  for (const row of matrix.rows) {
    if (typeof row.id !== "string" || !/^P0-[A-Z0-9-]+$/.test(row.id)
      || ids.has(row.id) || !KINDS.has(row.evidence_kind)
      || !row.scenario || !row.owner || !row.reference) {
      throw new Error("Invalid or duplicate Combat 4D row: " + JSON.stringify(row));
    }
    ids.add(row.id);
  }
  return matrix;
}

const nonempty = value => typeof value === "string" && value.trim().length > 0;
const hasEvidenceUrl = value => /^https:\/\/\S+/.test(value);
const validTick = event => Number.isSafeInteger(event?.tick)
  && event.tick >= 0 && nonempty(event?.actor_id) && nonempty(event?.event);
const distinct = values => new Set(values).size === values.length;

export function assessRow(row, report, candidateSha, baselineSha) {
  if (!SHA_PATTERN.test(candidateSha)) throw new Error("Candidate must be exact 40-hex commit SHA");
  // A current-main source-proven failure cannot be erased by submitting a green report.
  if (candidateSha === baselineSha && row.baseline === "FAIL")
    return { status: "FAIL", reason: row.reason || "Known failing baseline" };
  if (!report) return {
    status: candidateSha === baselineSha && row.baseline === "BLOCKED" ? "BLOCKED" : "NOT TESTED",
    reason: "No independent exact-head evidence submitted"
  };
  if (report.candidate_sha !== candidateSha)
    return { status: "BLOCKED", reason: "Evidence commit does not match exact candidate SHA" };
  if (report.outcome === "FAIL")
    return { status: "FAIL", reason: report.failure || "Reported failure without explanation" };
  if (report.outcome === "BLOCKED")
    return { status: "BLOCKED", reason: report.failure || "Blocked by dependency" };
  if (report.outcome !== "PASS")
    return { status: "NOT TESTED", reason: "No explicit PASS outcome" };
  const fails = [];
  if (!nonempty(report.qa_reviewer)) fails.push("independent QA reviewer");
  if (!nonempty(report.verified_at)) fails.push("verification time");
  if (!hasEvidenceUrl(report.run_url)) fails.push("exact-head run URL");
  if (!Array.isArray(report.artifact_urls) || !report.artifact_urls.some(hasEvidenceUrl))
    fails.push("immutable trace/artifact URL");
  if (!Array.isArray(report.assertions) || report.assertions.length === 0
    || report.assertions.some(a => !nonempty(a?.name) || a.passed !== true
      || !nonempty(a?.evidence))) fails.push("individually evidenced passing assertions");
  if (["native", "world", "network", "multiplayer"].includes(row.evidence_kind)
    && (!Array.isArray(report.server_ticks) || !report.server_ticks.some(validTick)))
    fails.push("authoritative server-tick/actor trace");
  if (["native", "multiplayer"].includes(row.evidence_kind)
    && (!Array.isArray(report.w3c_events)
      || !report.w3c_events.some(e => e?.trusted === true
        && e.origin === "W3C" && nonempty(e.actor_id))))
    fails.push("genuine W3C browser input");
  if (row.evidence_kind === "multiplayer") {
    const minimum = row.id === "P0-FOUR-BROWSERS" ? 4
      : row.id === "P0-THREE-BROWSERS" ? 3 : 2;
    const players = report.browser_sessions;
    if (!Array.isArray(players) || players.length < minimum
      || !players.every(p => nonempty(p.actor_id) && nonempty(p.session_id)
        && nonempty(p.browser)) || !distinct(players.map(p => p.session_id))
      || !distinct(players.map(p => p.actor_id))
      || !nonempty(report.world_id)) fails.push(minimum + " distinct admitted same-World browser sessions");
  }
  if (row.evidence_kind === "human"
    && (!Array.isArray(report.human_operators) || report.human_operators.length < 2
      || !distinct(report.human_operators))) fails.push("two independent human operators");
  if (row.id === "P0-REMOTE-HOST" && report.independent_host_verified !== true)
    fails.push("separate host reachability proof");
  if (row.evidence_kind === "ci"
    && (report.full_protected !== true || report.conclusion !== "success"))
    fails.push("successful protected exact-head CI");
  // JSON supplied by the claimant is not proof that a GitHub workflow ran at
  // this SHA, that its artifacts are authentic, or that two humans played.
  // This script has NO independent verifier. Never issue a release-facing
  // PASS from syntactically plausible but unaudited evidence.
  return fails.length ? { status: "BLOCKED", reason: "Missing/invalid: " + fails.join(", ") }
    : { status: "REVIEW REQUIRED",
      reason: "Manifest is structurally complete; independently verify exact-head run, immutable artifacts, W3C and World traces, humans/hosts and QA sign-off" };
}

export function qualify(matrix, candidateSha, evidence = {}) {
  if (!SHA_PATTERN.test(candidateSha)) throw new Error("Provide full 40-hex candidate SHA");
  const records = evidence.records ?? {};
  const unknown = Object.keys(records).filter(id => !matrix.rows.some(row => row.id === id));
  if (unknown.length) throw new Error("Unknown evidence keys: " + unknown.join(", "));
  const rows = matrix.rows.map(row => ({
    id: row.id, owner: row.owner, group: row.group,
    ...assessRow(row, records[row.id], candidateSha, matrix.baseline.sha)
  }));
  const counts = rows.reduce((n, row) => (n[row.status] = (n[row.status] ?? 0) + 1, n), {});
  // This offline preflight does not connect to GitHub or verify human/host
  // attestations. A collection of 45 self-declared PASS records cannot
  // upgrade release status. Independent QA/Main handles verified acceptance.
  return { candidateSha, classification: rows.some(row =>
    ["FAIL", "BLOCKED", "REVIEW REQUIRED"].includes(row.status))
    ? "HOLD" : "NOT QUALIFIED", counts, rows,
    deploymentAuthorized: false };
}

function localSmoke() {
  // Deterministic tests are useful evidence, but a success is NOT Combat QA PASS.
  const commands = [
    ["node", ["--test", "tests/combat-model.test.mjs", "tests/networking.test.mjs",
      "tests/combat4d-acceptance.test.mjs", "tests/combat4d-m107-proof.test.mjs",
      "tests/combat4d-m155-proof.test.mjs", "tests/combat4d-m193-proof.test.mjs",
      "tests/combat4d-m121-proof.test.mjs"]],
    ["cargo", ["test", "--manifest-path", "server/Cargo.toml"]]
  ];
  let failed = false;
  for (const [bin, args] of commands) {
    console.log("$ " + [bin, ...args].join(" "));
    const run = spawnSync(bin, args, { cwd: ROOT, stdio: "inherit", shell: false });
    if (run.error || run.status !== 0) {
      console.error("Combat 4D local smoke FAILED:", run.error?.message ?? run.status);
      failed = true;
    }
  }
  if (!failed) console.log("Local deterministic smoke passed; native multiplayer and release NOT certified.");
  return failed ? 1 : 0;
}

function main(args) {
  const matrix = loadMatrix();
  const command = args[0] ?? "--inventory";
  if (command === "--smoke") return localSmoke();
  if (command === "--inventory") {
    console.log("Combat 4D matrix; baseline " + matrix.baseline.sha);
    for (const row of matrix.rows)
      console.log([row.id, row.owner, row.evidence_kind, row.baseline, row.scenario].join("\t"));
    console.log("Inventory only. No Combat 4D QA PASS issued.");
    return 0;
  }
  if (command === "--gate" && args.length === 3) {
    const candidate = args[1];
    const evidence = JSON.parse(readFileSync(resolve(args[2]), "utf8"));
    const report = qualify(matrix, candidate, evidence);
    console.log(JSON.stringify(report, null, 2));
    return report.classification === "PASS" ? 0 : 1;
  }
  console.error("Usage:\n  node scripts/combat4d-acceptance.mjs --inventory\n"
    + "  node scripts/combat4d-acceptance.mjs --smoke\n"
    + "  node scripts/combat4d-acceptance.mjs --gate <40-char-sha> <evidence.json>");
  return 2;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = main(process.argv.slice(2)); }
  catch (error) { console.error(error.message); process.exitCode = 2; }
}

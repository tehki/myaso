import test from "node:test";
import assert from "node:assert/strict";
import { loadMatrix, assessRow, qualify } from "../scripts/combat4d-acceptance.mjs";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const matrix = loadMatrix();
const baselineSha = matrix.baseline.sha;
const candidateSha = "a".repeat(40);
const row = id => matrix.rows.find(entry => entry.id === id);
const trusted = {
  candidate_sha: candidateSha,
  outcome: "PASS",
  qa_reviewer: "independent-qa-example",
  verified_at: "2026-10-23T10:00:00Z",
  run_url: "https://github.com/tehki/myaso/actions/runs/1",
  artifact_urls: ["https://github.com/tehki/myaso/actions/runs/1/artifacts/1"],
  assertions: [{ name: "authoritative hit", passed: true, evidence: "server World tick record" }],
  server_ticks: [{ tick: 155, actor_id: "player1", event: "admit-attack" }],
  w3c_events: [{ origin: "W3C", trusted: true, actor_id: "player1" }]
};

test("4D matrix is nonempty, unique, traceable and has explicit independent owners", () => {
  assert.equal(matrix.rows.length, 45);
  assert.equal(new Set(matrix.rows.map(r => r.id)).size, matrix.rows.length);
  for (const r of matrix.rows) {
    assert.ok(r.scenario && r.reference && r.owner);
    assert.notEqual(r.baseline, "PASS");
  }
});
test("current main is a source-proven FAIL for immediate LMB light", () => {
  const result = assessRow(row("P0-LMB-DOWN"), trusted, baselineSha, baselineSha);
  assert.equal(result.status, "FAIL");
});
test("no missing evidence can be promoted to PASS", () => {
  assert.equal(assessRow(row("P0-PARRY-125"), null, candidateSha, baselineSha).status, "NOT TESTED");
  assert.equal(assessRow(row("P0-LMB-KEYE"), null, baselineSha, baselineSha).status, "BLOCKED");
});
test("evidence must match full candidate SHA, and not be ACK-only", () => {
  assert.equal(assessRow(row("P0-LIGHT-34"), { ...trusted, candidate_sha: baselineSha }, candidateSha, baselineSha).status, "BLOCKED");
  assert.equal(assessRow(row("P0-HEAVY-RELEASE"), { ...trusted, server_ticks: [] }, candidateSha, baselineSha).status, "BLOCKED");
  assert.equal(assessRow(row("P0-HEAVY-RELEASE"), { ...trusted, w3c_events: [{ origin: "script", trusted: false, actor_id: "player1" }] }, candidateSha, baselineSha).status, "BLOCKED");
});
test("syntactically plausible native evidence never self-authorizes PASS", () => {
  const result = assessRow(row("P0-HEAVY-RELEASE"), trusted, candidateSha, baselineSha);
  assert.equal(result.status, "REVIEW REQUIRED");
  assert.match(result.reason, /independently verify/i);
});
test("four-player evidence rejects reused sessions and actors", () => {
  const browsers = ["chrome", "firefox", "chrome2", "firefox2"].map((browser, i) => ({
    browser, actor_id: "player" + (i + 1), session_id: "session" + (i + 1)
  }));
  const proof = { ...trusted, browser_sessions: browsers, world_id: "world-1" };
  assert.equal(assessRow(row("P0-FOUR-BROWSERS"), proof, candidateSha, baselineSha).status, "REVIEW REQUIRED");
  assert.equal(assessRow(row("P0-FOUR-BROWSERS"), {
    ...proof, browser_sessions: [...browsers.slice(0, 3), { ...browsers[3], session_id: "session1" }]
  }, candidateSha, baselineSha).status, "BLOCKED");
});
test("human-only and remote-host gates cannot be satisfied by automated clients", () => {
  assert.equal(assessRow(row("P0-HUMAN-HUMAN"), trusted, candidateSha, baselineSha).status, "BLOCKED");
  assert.equal(assessRow(row("P0-REMOTE-HOST"), { ...trusted, human_operators: ["humanA", "humanB"] }, candidateSha, baselineSha).status, "BLOCKED");
});
test("CI passes require exact-head protected success", () => {
  assert.equal(assessRow(row("P0-EXACT-HEAD-CI"), trusted, candidateSha, baselineSha).status, "BLOCKED");
  assert.equal(assessRow(row("P0-EXACT-HEAD-CI"), {
    ...trusted, full_protected: true, conclusion: "success"
  }, candidateSha, baselineSha).status, "REVIEW REQUIRED");
});
test("45 fabricated but structurally complete PASS reports remain HOLD", () => {
  // This is an ATTACK against the offline gate, not evidence of gameplay.
  const players = ["chrome", "firefox", "chrome2", "firefox2"].map((browser, i) => ({
    browser, actor_id: "player" + (i + 1), session_id: "session" + (i + 1)
  }));
  const forged = Object.fromEntries(matrix.rows.map(r => [r.id, {
    ...trusted,
    browser_sessions: players,
    world_id: "world-fabricated",
    human_operators: ["humanA", "humanB"],
    independent_host_verified: true,
    full_protected: true,
    conclusion: "success"
  }]));
  const classification = qualify(matrix, candidateSha, { records: forged });
  assert.equal(classification.classification, "HOLD");
  assert.equal(classification.counts["REVIEW REQUIRED"], matrix.rows.length);
  assert.equal(classification.deploymentAuthorized, false);
  // Acceptance must also fail at the actual CLI boundary, not just helper API.
  const directory = mkdtempSync(join(tmpdir(), "combat4d-unverified-"));
  try {
    const evidencePath = join(directory, "unverified-evidence.json");
    writeFileSync(evidencePath, JSON.stringify({ records: forged }));
    const script = fileURLToPath(new URL("../scripts/combat4d-acceptance.mjs", import.meta.url));
    const run = spawnSync(process.execPath, [script, "--gate", candidateSha, evidencePath], {
      encoding: "utf8", timeout: 15000
    });
    assert.equal(run.status, 1, run.stderr || run.stdout);
    const cliReport = JSON.parse(run.stdout);
    assert.equal(cliReport.classification, "HOLD");
    assert.equal(cliReport.counts["REVIEW REQUIRED"], matrix.rows.length);
    assert.equal(cliReport.deploymentAuthorized, false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
test("overall release remains HOLD/NOT QUALIFIED until independent acceptance", () => {
  const missing = qualify(matrix, candidateSha);
  assert.equal(missing.classification, "NOT QUALIFIED");
  assert.equal(missing.deploymentAuthorized, false);
  const failing = qualify(matrix, candidateSha, {
    records: { "P0-LMB-DOWN": { ...trusted, outcome: "FAIL", failure: "No server action" } }
  });
  assert.equal(failing.classification, "HOLD");
  assert.equal(failing.deploymentAuthorized, false);
});

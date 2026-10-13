import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");
const runner = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
const proof = readFileSync(new URL("../scripts/m201-authoritative-phase-proof.mjs", import.meta.url), "utf8");
const gate = workflow.slice(workflow.indexOf("      - name: Validate M205 repeated M201"),
  workflow.indexOf("      - name: Validate M153 kick knockdown"));

test("M205 requires three complete fresh server and browser FFA punish trials", () => {
  assert.match(gate, /for attempt in 1 2 3; do/);
  assert.match(gate, /node scripts\/pvp_browser_flight_runner\.mjs/);
  assert.match(gate, /MYASO_PVP_SCENARIO: "uiguardbreakpunishffahit"/);
  assert.match(gate, /node --test tests\/m201-authoritative-phase-proof\.test\.mjs/);
  assert.ok(!gate.includes("|| true"));
});

test("M205 cannot silently replace real input or server phase proof", () => {
  const section = runner.slice(runner.indexOf("async function runOnlineUiGuardBreakPunishFfaFocusFlight"),
    runner.indexOf("async function runOnlineUiGuardBreakFlight"));
  assert.ok(section.includes("verifyM201ServerPunishProof(m201ServerOutput()"));
  assert.ok(section.includes("punishDowns.length !== 1"));
  assert.ok(section.includes("punishUps.length !== 1"));
  assert.ok(section.includes("punishAimValid"));
  assert.ok(section.includes("performArenaAttackHold(attacker, attackerElementId, attackOffset, 60)"));
  assert.ok(proof.includes("r.from === 1 && r.to === 2"));
  assert.ok(proof.includes("hits.length !== 1"));
  assert.ok(proof.includes("hits[0].damage !== 34"));
});

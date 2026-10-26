import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const runner = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
const server = readFileSync(new URL("../server/src/main.rs", import.meta.url), "utf8");

test("M320 enables read-only authoritative action proof only for genuine loopback guard-break flights", () => {
  const env = runner.slice(runner.indexOf("async function startGameServer()"),
    runner.indexOf("async function startBrowser("));
  assert.match(env, /MYASO_BIND: "127\.0\.0\.1:0"/);
  assert.match(env, /MYASO_FLIGHT_ACTION_PROOF: \(scenario === "uiguardbreakpunishffahit"/);
  assert.match(env, /\|\| scenario === "uiguardbreak"/);
  const serverGuard = server.slice(server.indexOf("let flight_action_proof ="),
    server.indexOf("tokio::spawn(run_authoritative_clock("));
  assert.match(serverGuard, /if flight_action_proof && !bind\.ip\(\)\.is_loopback\(\)/);
  assert.match(serverGuard, /authoritative flight action proof is permitted only on loopback binds/);
});

test("M320 emits ticked genuine server block, parry and guard-break events", () => {
  const proof = server.slice(server.indexOf("fn m201_flight_proof_lines("),
    server.indexOf("\nfn ", server.indexOf("fn m201_flight_proof_lines(") + 5));
  assert.match(proof, /M201_AUTH_ACTION tick=\{tick\} fighter=/);
  assert.match(proof, /CombatEvent::Block \{ attacker, target \}/);
  assert.match(proof, /M201_AUTH_BLOCK tick=\{tick\}/);
  assert.match(proof, /CombatEvent::Parry \{ attacker, target \}/);
  assert.match(proof, /M201_AUTH_PARRY tick=\{tick\}/);
  assert.match(proof, /M201_AUTH_BREAK tick=\{tick\}/);
});

test("M320 reports bounded server evidence before unchanged fatal M194 parry/damage gates", () => {
  const flight = runner.slice(runner.indexOf("async function runOnlineUiGuardBreakFlight("),
    runner.indexOf("async function runOnlineUiGuardBreakTellFlight("));
  const start = flight.indexOf("const m320ServerOutputStart = m201ServerOutput().length;");
  const write = flight.indexOf('console.log("M320_GUARD_BREAK_AUTH_TRACE "');
  const rejectParry = flight.indexOf("M193 guard-break exchange");
  const rejectHit = flight.indexOf("M34 guard-break staging allowed an unblocked strike");
  assert.ok(start > 0 && start < write && write < rejectParry && rejectParry < rejectHit);
  assert.match(flight, /\.slice\(m320ServerOutputStart\)/);
  assert.match(flight, /\.slice\(-16\)/, "diagnostics remain bounded per exchange");
  assert.match(flight, /attackerNetId: attackerReady\.playerNetId/);
  assert.match(flight, /defenderNetId: defenderReady\.playerNetId/);
  const r2 = readFileSync(new URL("../scripts/r2-release-led-short-block.mjs", import.meta.url), "utf8");
  assert.match(flight, /dispatchR2ReleaseLedShortBlock\(\{/);
  assert.match(r2, /wheelHeadStartMs: 0/);
  assert.match(r2, /receiptGraceMs = 100/);
  assert.match(r2, /postTrustedWheelMs = 0/, "all established W3C scenarios retain zero extra post-wheel wait by default");
  assert.ok(flight.includes("postTrustedWheelMs: (m151ReleaseAnchoredGuardOnly || m194ReleaseAnchoredGuardOnly) ? 25 : 0"),
    "only authentic M151/M194 release-anchored staging opts into the bounded release window");
  assert.match(flight, /awaitTrustedWheel: \(\) => challenge\.wait\(\)/);
  assert.match(flight, /defenderState\?\.playerHp !== 100/);
  assert.match(flight, /defenderResult\.playerGuard !== 0/);
  assert.match(flight, /defenderResult\.playerHp !== 100/);
  assert.match(flight, /feedbackTransitions\.includes\("parry-success"\)/);
});

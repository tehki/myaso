import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";

test("M156 real Chrome2 short click starts after actual Firefox knockdown, not wheel driver ACK", () => {
  const source = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
  const begin = source.indexOf("async function runOnlineUiRollKnockdownFfaHitFlight(");
  const end = source.indexOf("\nasync function ", begin + 25);
  const flight = source.slice(begin, end);
  assert.ok(begin > 0 && end > begin);
  const armed = flight.indexOf("const knockdownWatcher = waitForDefenderKnockdown(");
  const wheel = flight.indexOf("const rollCompletion = scrollArenaWheel(", armed);
  const watched = flight.indexOf("const knockdownTransition = await knockdownWatcher", wheel);
  const click = flight.indexOf("await performArenaM221GuardBreakClick(punisher, 5)", watched);
  const ack = flight.indexOf("const rollResult = await rollCompletion", click);
  assert.ok(armed >= 0 && wheel > armed && watched > wheel && click > watched && ack > click);
  assert.ok(flight.includes(".then(() => ({ ok: true }), (error) => ({ ok: false, error }))"));
  assert.ok(flight.includes("if (!rollResult.ok) throw rollResult.error"));
  assert.ok(!flight.includes("await setArenaAttackButton(punisher, true)"));
  assert.ok(!flight.includes("await setArenaAttackButton(punisher, false)"));
  assert.ok(flight.includes("punishDowns.length !== 1 || punishUps.length !== 1"));
  assert.ok(flight.includes("punishUp.epochMs - punishDown.epochMs >= 320"));
  assert.ok(flight.includes("punishDown.epochMs < conversion.knockdownTransition.epochMs"));
  assert.ok(flight.includes("punishActive.epochMs >= knockdownEndEpochMs || !attackPrecedesRecovery"));
  assert.ok(flight.includes('defenderState.events.includes("Hit taken - 34 HP.")'));
  assert.ok(flight.includes("defenderState?.playerHp === 66 && defenderState?.playerGuard === 100"));
  assert.ok(flight.includes("punisherState?.playerHp === 100 && punisherState?.playerGuard === 100"));
});

test("M156 actual 30Hz legacy held, release and neutral packets do not change under QA evidence", () => {
  const game = readFileSync(new URL("../web/online-game.mjs", import.meta.url), "utf8");
  const begin = game.indexOf("function simulatePrediction(stepMs) {");
  const end = game.indexOf("\nfunction predictMovement(", begin);
  assert.ok(begin >= 0 && end > begin);
  const packets = [], debug = { inputSubmissions: [] };
  const state = { attack: true, heavyAttack: true, jump: false };
  const charge = { held: true };
  const ctx = {
    sampleInput() {}, matchOver: false,
    local: { initialized: false },
    predictionStep: 1, clientTick: 330,
    networkClient: { sendInput(packet) { packets.push({ ...packet }); } },
    markStaminaDenialSubmitted() {}, currentInput: state,
    acceptanceScenario: "uirollknockdownffahit", reviewedGestureLab: false,
    window: { __MYASO_ACCEPTANCE_STATE__: debug },
    leftButtonDown: true,
    leftButtonCharge: { isCharging: () => charge.held },
    attackRequested: false, runningAttackRequested: false,
    committedLightMove: null, heavyAttackRequested: false,
    rollRequested: false, kickRequested: false,
    jumpRequested: false, dashRequested: false, dashMove: null,
    Date: { now: () => 1792772096455 },
  };
  runInNewContext(game.slice(begin, end), ctx);
  // Actual original sender samples dual attack/heavy while physically held.
  ctx.simulatePrediction(1000 / 60);
  assert.equal(packets.length, 1);
  assert.equal(debug.inputSubmissions[0].lmbPressed, true);
  assert.equal(debug.inputSubmissions[0].lmbCharging, true);
  assert.equal(packets[0].attack, true);
  assert.equal(packets[0].heavyAttack, true);

  // Physical pointerUP is processed independently and may await the next
  // ordinary 30Hz send: the tracer cannot send an extra attack packet.
  ctx.leftButtonDown = false;
  charge.held = false;
  state.attack = true; state.heavyAttack = false;
  ctx.attackRequested = true;
  ctx.simulatePrediction(1000 / 60);
  assert.equal(packets.length, 1);
  ctx.simulatePrediction(1000 / 60);
  assert.equal(packets.length, 2);
  assert.equal(packets[1].heavyAttack, false);
  assert.equal(debug.inputSubmissions[1].pendingLight, true);
  assert.equal(debug.inputSubmissions[1].lmbPressed, false);

  // Neutral post-release original network input must also be visible, so
  // missing outgoing RELEASE cannot be inferred merely from an old HUD cue.
  state.attack = false;
  ctx.attackRequested = false;
  ctx.simulatePrediction(1000 / 60);
  ctx.simulatePrediction(1000 / 60);
  assert.equal(packets.length, 3);
  assert.deepEqual(packets.map(x => x.tick), [330, 331, 332]);
  assert.deepEqual(debug.inputSubmissions.map(x => [x.attack, x.heavyAttack]),
    [[true, true], [true, false], [false, false]]);
  assert.equal(debug.inputSubmissions[2].pendingLight, false);

  // In the separate negotiated source0/KeyE1 gesture laboratory the v1
  // legacy sender witness must stay dormant, not confuse two owners.
  ctx.reviewedGestureLab = true;
  const before = debug.inputSubmissions.length;
  state.attack = true; state.heavyAttack = true;
  ctx.simulatePrediction(1000 / 60);
  ctx.simulatePrediction(1000 / 60);
  assert.equal(debug.inputSubmissions.length, before);
  assert.equal(packets.length, 4, "existing v1 movement send cadence is unchanged");
});

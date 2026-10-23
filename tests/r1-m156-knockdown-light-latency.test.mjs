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

test("M156 actual sampled HOLD, light RELEASE and neutral transmit unchanged while bounded QA observes all", () => {
  // Execute the REAL production simulatePrediction function in an isolated
  // deterministic harness, including its genuine sendInput boundary.
  const source = readFileSync(new URL("../web/online-game.mjs", import.meta.url), "utf8");
  const start = source.indexOf("function simulatePrediction(stepMs) {");
  const stop = source.indexOf("\nfunction predictMovement(", start);
  assert.ok(start > 0 && stop > start);
  const fn = source.slice(start, stop);
  const actualPackets = [];
  const debug = { inputSubmissions: [] };
  const input = { attack: true, heavyAttack: true, jump: false };
  const charge = { held: true };
  const ctx = {
    sampleInput() {},
    matchOver: false,
    local: { initialized: false },
    predictionStep: 1,
    clientTick: 346,
    networkClient: {
      sendInput(packet) { actualPackets.push({ ...packet }); },
    },
    markStaminaDenialSubmitted() {},
    currentInput: input,
    acceptanceScenario: "uirollknockdownffahit",
    window: { __MYASO_ACCEPTANCE_STATE__: debug },
    leftButtonDown: true,
    leftButtonCharge: { isCharging: () => charge.held },
    attackRequested: false,
    runningAttackRequested: false,
    committedLightMove: null,
    heavyAttackRequested: false,
    rollRequested: false,
    kickRequested: false,
    jumpRequested: false,
    dashRequested: false,
    dashMove: null,
    Date: { now: () => 1792754242365 },
  };
  runInNewContext(fn, ctx);
  ctx.simulatePrediction(1000 / 60); // real 30Hz send of initial held dual-bit charge
  assert.equal(actualPackets.length, 1);
  assert.equal(actualPackets[0].attack, true);
  assert.equal(actualPackets[0].heavyAttack, true);
  assert.equal(debug.inputSubmissions[0].lmbPressed, true);
  assert.equal(debug.inputSubmissions[0].lmbCharging, true);

  // Genuine pointerUP's onLight queued an attack-only release pulse. No
  // synthetic send or clock advance is needed; only the original sender
  // is allowed to issue a packet on every second prediction step.
  input.attack = true;
  input.heavyAttack = false;
  ctx.leftButtonDown = false;
  charge.held = false;
  ctx.attackRequested = true;
  ctx.simulatePrediction(1000 / 60); // off tick: zero extra packets
  assert.equal(actualPackets.length, 1);
  ctx.simulatePrediction(1000 / 60); // genuine next sender tick
  assert.equal(actualPackets.length, 2);
  assert.equal(actualPackets[1].attack, true);
  assert.equal(actualPackets[1].heavyAttack, false);
  assert.equal(debug.inputSubmissions[1].pendingLight, true);
  assert.equal(debug.inputSubmissions[1].lmbPressed, false);

  // A later quiet packet is explicitly retained for this QA scenario.
  input.attack = false;
  input.heavyAttack = false;
  ctx.simulatePrediction(1000 / 60);
  ctx.simulatePrediction(1000 / 60);
  assert.equal(actualPackets.length, 3);
  assert.equal(actualPackets[2].attack, false);
  assert.equal(actualPackets[2].heavyAttack, false);
  assert.deepEqual(debug.inputSubmissions.map(x => [x.attack, x.heavyAttack]),
    [[true, true], [true, false], [false, false]]);
  assert.deepEqual(actualPackets.map(x => x.tick), [346, 347, 348]);
  assert.deepEqual(debug.inputSubmissions.map(x => x.clientTick), [346, 347, 348]);
});

test("M205 genuine wheel block native sender records the original Block bits and remaining interval without changing packets", () => {
  const source = readFileSync(new URL("../web/online-game.mjs", import.meta.url), "utf8");
  const begin = source.indexOf("function simulatePrediction(stepMs) {");
  const end = source.indexOf("\nfunction predictMovement(", begin);
  assert.ok(begin >= 0 && end > begin);
  const packets = [];
  const debug = { inputSubmissions: [] };
  const input = { attack: false, heavyAttack: false, block: false, jump: false };
  let elapsed = 1000;
  const ctx = {
    sampleInput() {},
    matchOver: false,
    local: { initialized: false },
    predictionStep: 1,
    clientTick: 380,
    networkClient: { sendInput: data => packets.push({ ...data }) },
    markStaminaDenialSubmitted() {},
    currentInput: input,
    acceptanceScenario: "uiguardbreakpunishffahit",
    window: { __MYASO_ACCEPTANCE_STATE__: debug },
    leftButtonDown: false,
    leftButtonCharge: { isCharging: () => false },
    attackRequested: false,
    runningAttackRequested: false,
    committedLightMove: null,
    heavyAttackRequested: false,
    rollRequested: false,
    kickRequested: false,
    jumpRequested: false,
    dashRequested: false,
    dashMove: null,
    shortBlockUntil: 0,
    Date: { now: () => 1792768052000 + elapsed },
    performance: { now: () => elapsed },
  };
  runInNewContext(source.slice(begin, end), ctx);

  // Existing genuine 30Hz idle send; the observer cannot create another.
  ctx.simulatePrediction(1000 / 60);
  assert.equal(packets.length, 1);
  assert.equal(debug.inputSubmissions[0].block, false);
  // A real Firefox wheel-back has changed currentInput at the subsequent
  // sampling boundary; this harness doesn't create a synthetic DOM wheel.
  input.block = true;
  ctx.shortBlockUntil = elapsed + 240;
  elapsed += 33;
  ctx.simulatePrediction(1000 / 60); // unsent prediction half-step
  assert.equal(packets.length, 1);
  ctx.simulatePrediction(1000 / 60);
  assert.equal(packets.length, 2);
  assert.equal(packets[1].block, true);
  assert.equal(debug.inputSubmissions[1].block, true);
  assert.equal(debug.inputSubmissions[1].wheelBlockRemainingMs, 207);
  // Real Wheel temporary 240ms protection elapsed; send the unchanged
  // neutral state and prove the trace cannot extend the original Block.
  elapsed += 241;
  input.block = false;
  ctx.simulatePrediction(1000 / 60);
  ctx.simulatePrediction(1000 / 60);
  assert.equal(packets.length, 3);
  assert.equal(packets[2].block, false);
  assert.equal(debug.inputSubmissions[2].wheelBlockRemainingMs, 0);
  assert.deepEqual(packets.map(x => x.tick), [380, 381, 382]);
  assert.deepEqual(debug.inputSubmissions.map(x => x.clientTick), [380, 381, 382]);
  assert.deepEqual(debug.inputSubmissions.map(x => x.block), [false, true, false]);
});

test("M205 wheel/block trace stays disabled for the ordinary production page", () => {
  const game = readFileSync(new URL("../web/online-game.mjs", import.meta.url), "utf8");
  const begin = game.indexOf("function simulatePrediction(stepMs) {");
  const end = game.indexOf("\nfunction predictMovement(", begin);
  const packets = [];
  const debug = { inputSubmissions: [] };
  const ctx = {
    sampleInput() {},
    matchOver: false,
    local: { initialized: false },
    predictionStep: 1, clientTick: 7,
    networkClient: { sendInput: data => packets.push({ ...data }) },
    markStaminaDenialSubmitted() {},
    currentInput: { block: true, attack: false, heavyAttack: false, jump: false },
    acceptanceScenario: "",
    window: { __MYASO_ACCEPTANCE_STATE__: debug },
    attackRequested: false, runningAttackRequested: false,
    committedLightMove: null, heavyAttackRequested: false,
    rollRequested: false, kickRequested: false,
    jumpRequested: false, dashRequested: false, dashMove: null,
  };
  runInNewContext(game.slice(begin, end), ctx);
  ctx.simulatePrediction(1000 / 60);
  assert.equal(packets.length, 1);
  assert.equal(packets[0].block, true);
  assert.deepEqual(debug.inputSubmissions, []);
});

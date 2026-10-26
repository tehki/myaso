import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { COMBAT } from "../src/combat/model.mjs";
import { awaitM223HeavyWindup, planM223WheelDelay } from "../scripts/m223-server-heavy-windup.mjs";

test("M223 accepts only fresh native server windup of intended fighter", async () => {
  let now=0;
  const history="M201_AUTH_ACTION tick=111 fighter=1 from=0 to=9\n";
  let output=history;
  const result=await awaitM223HeavyWindup({
    afterOffset:history.length, fighterId:1,
    readOutput:()=>output, now:()=>now,
    sleep:ms=>{
      now+=ms;
      output+=now<8?"M201_AUTH_ACTION tick=222 fighter=2 from=0 to=9\n":
        "M201_AUTH_ACTION tick=333 fighter=1 from=0 to=9\n";
    },
  });
  assert.deepEqual(result,{serverTick:333,observedAfterMs:8});
});

test("M223 missing authoritative proof fails closed", async () => {
  let now=0;
  await assert.rejects(()=>awaitM223HeavyWindup({
    afterOffset:0,fighterId:1,readOutput:()=>"",
    now:()=>now,timeoutMs:12,sleep:ms=>{now+=ms;},
  }),/did not observe genuine authoritative heavy windup/);
});

test("M223 rejects truncated stream, partial line and invalid fighter", async () => {
  let now=0;
  await assert.rejects(()=>awaitM223HeavyWindup({
    afterOffset:1,fighterId:1,readOutput:()=>"",
    now:()=>now,sleep:ms=>{now+=ms;},
  }),/stream unavailable/);
  await assert.rejects(()=>awaitM223HeavyWindup({
    afterOffset:0,fighterId:0,readOutput:()=>"",
    sleep:()=>{},
  }),TypeError);
  await assert.rejects(()=>awaitM223HeavyWindup({
    afterOffset:0,fighterId:1,
    readOutput:()=>"M201_AUTH_ACTION tick=100 fighter=1 from=0 to=9",
    now:()=>now,timeoutMs:8,sleep:ms=>{now+=ms;},
  }),/did not observe/);
});

test("M223 preserves one genuine held-LMB release and one wheel plus strict combat outcomes",()=>{
  const source=readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs",import.meta.url),"utf8");
  const code=source.slice(source.indexOf("async function performHeavyCounterplayWindowWheel("),
    source.indexOf("async function runOnlineUiHeavyBlockFlight("));
  assert.ok(code.includes("awaitM223HeavyWindup({"));
  assert.ok(code.includes('performM110NativeHeldLmb(attacker, attackerElementId, attackOffset)'));
  assert.ok(!code.includes('pulseMovementKey(attacker, "e", heavyKeyPulseMs)'));
  assert.ok(code.includes("scrollArenaWheel(defender, defenderElementId, 120, m223WheelDelayMs)"));
  assert.ok(code.includes("M192_REAL_INGRESS_OUTCOME"));
  assert.ok(code.includes("M223_SERVER_WINDUP_PLAN"));
  assert.ok(source.includes('scenario === "uiheavyblock" || scenario === "uiheavyparry"'));
  assert.ok(source.includes('Opponent blocked - guard -64.'));
  assert.ok(source.includes('feedbackTransitions.includes("parried")'));
});

test("M223.1 clamps slow wheel samples without changing server combat windows", () => {
  assert.deepEqual(planM223WheelDelay({
    targetAfterWindupMs:155, sampledWheelIngressMs:103,
  }), {boundedWheelIngressMs:85,wheelDelayMs:70});
  assert.deepEqual(planM223WheelDelay({
    targetAfterWindupMs:155, sampledWheelIngressMs:70,
  }), {boundedWheelIngressMs:70,wheelDelayMs:85});
  assert.deepEqual(planM223WheelDelay({
    targetAfterWindupMs:155, sampledWheelIngressMs:39,
  }), {boundedWheelIngressMs:65,wheelDelayMs:90});
  assert.deepEqual(planM223WheelDelay({
    targetAfterWindupMs:255, sampledWheelIngressMs:31,
  }), {boundedWheelIngressMs:65,wheelDelayMs:190});
  assert.deepEqual(planM223WheelDelay({
    targetAfterWindupMs:255, sampledWheelIngressMs:103,
  }), {boundedWheelIngressMs:85,wheelDelayMs:170});
  assert.deepEqual(planM223WheelDelay({
    targetAfterWindupMs:285, sampledWheelIngressMs:103,
  }), {boundedWheelIngressMs:85,wheelDelayMs:200});
  assert.deepEqual(planM223WheelDelay({
    targetAfterWindupMs:285, sampledWheelIngressMs:39,
  }), {boundedWheelIngressMs:65,wheelDelayMs:220});
  assert.deepEqual(planM223WheelDelay({
    targetAfterWindupMs:395, sampledWheelIngressMs:73,
  }), {boundedWheelIngressMs:73,wheelDelayMs:322});
  assert.deepEqual(planM223WheelDelay({
    targetAfterWindupMs:395, sampledWheelIngressMs:103,
  }), {boundedWheelIngressMs:85,wheelDelayMs:310});
});

test("M223.1 refuses invalid or unqualified sampled ingress", () => {
  for (const sample of [-1,NaN,Infinity,751]) {
    assert.throws(()=>planM223WheelDelay({
      targetAfterWindupMs:155, sampledWheelIngressMs:sample,
    }),TypeError);
  }
  assert.throws(()=>planM223WheelDelay({
    targetAfterWindupMs:240,sampledWheelIngressMs:70,
  }),TypeError);
});

test("Combat4B M188 physical held-LMB parry preserves one bounded wheel and strict defense predicates", () => {
  const source = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
  const helper = source.slice(source.indexOf("async function performHeavyCounterplayWindowWheel("),
    source.indexOf("async function runOnlineUiHeavyBlockFlight("));
  // A real original World event trace at 1fa6f494 proved 405ms native parry
  // resulted in BLOCK (64 guard), not PARRY. The World timers stay unchanged;
  // qualify the +110ms physically-delayed wheel on exact-head native CI.
  assert.match(helper, /m188HeldLmbParryOffsetMs = scenario === "uiheavyparry" \? 110 : 0/);
  assert.match(helper, /m223WheelDelayMs = m223Plan\.wheelDelayMs \+ m188HeldLmbParryOffsetMs/);
  assert.match(helper, /m223WheelDelayMs < 0 \|\| m223WheelDelayMs > 450/);
  // 405ms planner plus parry-only wheel retiming must preserve <=450ms bound.
  assert.equal(planM223WheelDelay({targetAfterWindupMs:405,sampledWheelIngressMs:65}).wheelDelayMs+110,450);
  assert.equal(planM223WheelDelay({targetAfterWindupMs:405,sampledWheelIngressMs:85}).wheelDelayMs+110,430);
  assert.match(helper, /performM110NativeHeldLmb\(attacker, attackerElementId, attackOffset\)/);
  assert.match(helper, /scrollArenaWheel\(defender, defenderElementId, 120, m223WheelDelayMs\)/);
  const block = source.slice(source.indexOf("async function runOnlineUiHeavyBlockFlight("),
    source.indexOf("async function runOnlineUiHeavyParryFlight("));
  const parry = source.slice(source.indexOf("async function runOnlineUiHeavyParryFlight("),
    source.indexOf("async function runOnlineUi", source.indexOf("async function runOnlineUiHeavyParryFlight(") + 20));
  assert.match(block, /attackOffset, blockOffset, 395,/);
  assert.match(block, /defenderResult\.playerHp === 100/);
  assert.match(block, /defenderGuardInWindow/);
  assert.match(parry, /attackOffset, blockOffset, 405,/);
  assert.match(parry, /defenderResult\.playerHp === 100/);
  assert.match(parry, /defenderResult\.playerGuard === 100/);
  assert.match(parry, /feedbackTransitions\.includes\("parried"\)/);
  assert.match(parry, /feedbackTransitions\.includes\("parry-success"\)/);
});

test("M226 uses later genuine parry wheel only, preserving M188 and M107 strict outcome checks", () => {
  const source=readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs",import.meta.url),"utf8");
  const block=source.slice(source.indexOf("async function runOnlineUiHeavyBlockFlight("),
    source.indexOf("async function runOnlineUiHeavyParryFlight("));
  const parry=source.slice(source.indexOf("async function runOnlineUiHeavyParryFlight("),
    source.indexOf("async function runOnlineUi",source.indexOf("async function runOnlineUiHeavyParryFlight(")+20));
  // Exact original World failure at 94797f19: block start704 / expiry719 /
  // heavy HIT724. A 110ms later physical wheel targets guard-only, not parry,
  // without altering either server timer or World damage assertions.
  const worldTickMs = 1000 / 60;
  const oldLeadMs = (724 - 704) * worldTickMs;
  const predictedBlockTick = 704 + Math.round((395 - 255) / worldTickMs);
  const newLeadMs = (724 - predictedBlockTick) * worldTickMs;
  assert.ok(oldLeadMs > COMBAT.block.shortBlockMs);
  assert.ok(newLeadMs > COMBAT.block.parryWindowMs);
  assert.ok(newLeadMs < COMBAT.block.shortBlockMs);
  assert.ok(block.includes("attackOffset, blockOffset, 395,"));
  assert.ok(!block.includes("attackOffset, blockOffset, 155,"));
  // Short-reach active lunge: authoritative block tick 605, hit tick 615
  // proves 285ms is ~167ms before contact; aim genuine parry wheel later.
  assert.ok(parry.includes("attackOffset, blockOffset, 405,"));
  assert.ok(source.includes('feedbackTransitions.includes("parried")'));
  assert.ok(source.includes("defenderResult.playerGuard !== 100"));
  assert.ok(source.includes("defenderResult.playerHp !== 100"));
  assert.deepEqual(planM223WheelDelay({targetAfterWindupMs:405,sampledWheelIngressMs:69}),
    {boundedWheelIngressMs:69,wheelDelayMs:336});
  assert.deepEqual(planM223WheelDelay({targetAfterWindupMs:285,sampledWheelIngressMs:82}),
    {boundedWheelIngressMs:82,wheelDelayMs:203});
  assert.throws(()=>planM223WheelDelay({targetAfterWindupMs:265,sampledWheelIngressMs:82}),TypeError);
});

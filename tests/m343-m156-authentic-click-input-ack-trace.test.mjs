import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";

const source = readFileSync(new URL("../web/online-game.mjs", import.meta.url), "utf8");
const runner = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
const collector = source.slice(source.indexOf("function recordM156NativeInputTrace(entry) {"),
  source.indexOf("\nfunction recordM144OriginalInputTrace(", source.indexOf("function recordM156NativeInputTrace(entry) {")));
function observe(scenario = "uirollknockdownffahit") {
  const window = { __MYASO_ACCEPTANCE_STATE__: {} };
  const fn = runInNewContext(collector + "\nrecordM156NativeInputTrace", { window, acceptanceScenario: scenario });
  return { fn, evidence: window.__MYASO_ACCEPTANCE_STATE__ };
}
const send = (tick, attack = false, heavyAttack = false) =>
  ({ kind: "send", clientTick: tick, epochMs: 1792698000000 + tick, attack, heavyAttack, jump: false });

test("M343 is a runtime no-op outside original M156 browser acceptance", () => {
  const { fn, evidence } = observe("uimultirecoveryffa");
  fn({kind: "pointer-down", clientTick: 22, trusted: true});
  fn(send(23,true,false));
  assert.deepEqual(Object.keys(evidence), []);
});

test("M343 saves real pre-click idle and true pointer/commit/30Hz send/ACK in original order", () => {
  const {fn,evidence} = observe();
  for (let t = 1; t <= 30; t += 1) fn(send(t));
  assert.deepEqual(Array.from(evidence.inputSubmissions, e => e.clientTick), [28,29,30]);
  fn({kind: "pointer-down",epochMs:1,pointerId:7,trusted:true,clientTick:31});
  fn({kind: "light-commit",epochMs:2,clientTick:31,attackRequested:true});
  fn({kind: "pointer-up",epochMs:3,pointerId:7,trusted:true,clientTick:31,classification:"light"});
  fn(send(31,true,false));
  fn({kind:"processed-ack",epochMs:4,playerNetId:3,processedClientTick:31,serverTick:333});
  const observed = Array.from(evidence.inputSubmissions, x=>({...x}));
  assert.deepEqual(observed.map(x=>x.kind), [
    "send","send","send","pointer-down","light-commit","pointer-up","send","processed-ack"]);
  assert.equal(observed[6].attack,true);
  assert.equal(observed[6].heavyAttack,false);
  assert.equal(observed[7].processedClientTick,31);
  assert.equal(observed[7].playerNetId,3);
});

test("M343 preserves 5ms light classification even when 30Hz sender misses the one-shot", () => {
  const {fn,evidence} = observe();
  fn({kind:"pointer-down",epochMs:100,pointerId:6,trusted:true,clientTick:92});
  fn({kind:"light-commit",epochMs:105,attackRequested:true,clientTick:92});
  fn({kind:"pointer-up",epochMs:105,pointerId:6,trusted:true,classification:"light",clientTick:92});
  for (let i=93; i<125; i++) fn(send(i,false,false));
  const recorded=Array.from(evidence.inputSubmissions, x=>({...x}));
  assert.ok(recorded.some(x=>x.kind==="light-commit"));
  assert.ok(recorded.filter(x=>x.kind==="send").every(x=>!x.attack));
  assert.equal(recorded.filter(x=>x.kind==="send").length,12);
  assert.equal(evidence.m156RemainingSends,0);
  assert.ok(recorded.length<=32);
});

test("M343 newest authentic click re-arms and discards old commitment without inventing input", () => {
  const {fn,evidence} = observe();
  fn({kind:"pointer-down",pointerId:5,clientTick:10,trusted:true});
  fn({kind:"pointer-up",pointerId:5,classification:null,clientTick:10,trusted:true});
  for(let i=11;i<=28;i++)fn(send(i));
  fn({kind:"pointer-down",pointerId:8,clientTick:29,trusted:true});
  fn({kind:"pointer-up",pointerId:8,classification:"light",clientTick:29,trusted:true});
  const records=Array.from(evidence.inputSubmissions, x=>({...x}));
  assert.equal(records.filter(x=>x.kind==="pointer-down").length,1);
  assert.equal(records.at(-1).pointerId,8);
  assert.ok(records.length<=32);
});

test("M343 hooks only original production callbacks/sender and preserves strict native M156 W3C/34HP gate", () => {
  assert.ok(source.includes('kind: "pointer-down"'));
  assert.ok(source.includes('kind: "pointer-up"'));
  assert.ok(source.includes('kind: "light-commit"'));
  assert.ok(source.includes('kind: "processed-ack"'));
  assert.ok(source.includes('if (acceptanceScenario === "uirollknockdownffahit")'));
  assert.ok(source.includes('networkClient.sendInput({ tick: outgoingTick, ...currentInput });'));
  assert.equal(source.match(/networkClient\.sendInput\(\{ tick: outgoingTick, \.\.\.currentInput \}\);/g)?.length,1);
  assert.ok(runner.includes('await performArenaM221GuardBreakClick(punisher, 5);'));
  assert.ok(runner.includes('const milestone = "M156 actionable third-party roll knockdown punish"'));
  assert.ok(runner.includes('did not land exactly one 34 HP third-party light'));
  assert.doesNotMatch(collector,/\.sendInput\(|dispatchEvent\(|\.click\(|\.setInput\(/);
});

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createM227TrustedLightRegistry } from "../scripts/m227-trusted-light-pointer.mjs";

test("M227 accepts exactly one real trusted left-button down, no stale/forged receipts",async()=>{
  const registry=createM227TrustedLightRegistry();
  const c=registry.issue();
  assert.equal(registry.receive({token:c.token,trusted:false,type:"pointerdown",button:0}),false);
  assert.equal(registry.receive({token:c.token,trusted:true,type:"pointerup",button:0}),false);
  assert.equal(registry.receive({token:c.token,trusted:true,type:"pointerdown",button:2}),false);
  assert.equal(registry.receive({token:"stale",trusted:true,type:"pointerdown",button:0}),false);
  const waiting=c.wait();
  assert.equal(registry.receive({token:c.token,trusted:true,type:"pointerdown",button:0}),true);
  assert.deepEqual(await waiting,{trusted:true,type:"pointerdown",button:0});
  assert.equal(registry.receive({token:c.token,trusted:true,type:"pointerdown",button:0}),false);
  c.close();
});

test("M227 fails closed on missing receipt and enforces bounded timeout",async()=>{
  for (const bad of [-1,0,1501,Infinity,NaN]) {
    assert.throws(()=>createM227TrustedLightRegistry({timeoutMs:bad}),TypeError);
  }
  const c=createM227TrustedLightRegistry({timeoutMs:5}).issue();
  await assert.rejects(c.wait(),/not observed/);
  c.close();
});

test("M227 ties genuine M144 pointerdown receipt to the one W3C jump chord without weakening strict M144/M145",()=>{
  const s=readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs",import.meta.url),"utf8");
  const fn=s.slice(s.indexOf("async function runOnlineUiMultiRecoveryFfaFocusFlight("),
    s.indexOf("async function runOnlineUiMultiRecoveryPunishFlight("));
  assert.ok(s.includes('window.__MYASO_M227_LIGHT_TOKEN__'));
  assert.ok(s.includes('event.isTrusted === true && event.button === 0'));
  assert.ok(s.includes('m227Registry.receive(packet)'));
  assert.ok(fn.includes('m227Registry.issue({ type: spatial ? "pointerdown" : "pointerup" })'));
  assert.ok(fn.includes('lightChallenge.wait()'));
  assert.ok(fn.includes('performArenaAttackHold(lightAttacker, lightArena, 200, 45)'));
  assert.ok(fn.includes('performArenaPreAimedJumpAttackChord(jumpAttacker, 180)'));
  assert.ok(fn.includes('const jumpInputDelayMs = spatial ? 80 : 70;'));
  assert.ok(fn.includes('const minLeadMs = spatial ? 70 : 60;'));
  assert.ok(fn.includes('const maxLeadMs = spatial ? 150 : 200;'));
  assert.ok(fn.includes('jumpAttackDowns[0].epochMs - lightUps[0].epochMs'));
  assert.ok(fn.includes('observerState.recoveryVisible'));
  assert.ok(fn.includes('evidence.some((entry) => entry.playerHp !== 100 || entry.playerGuard !== 100)'));
});

test("M227 release receipt is authentic, single-use and independently type-scoped", async () => {
  const registry = createM227TrustedLightRegistry();
  const challenge = registry.issue({ type: "pointerup" });
  assert.equal(registry.receive({token:challenge.token,trusted:true,type:"pointerdown",button:0}),false);
  assert.equal(registry.receive({token:challenge.token,trusted:false,type:"pointerup",button:0}),false);
  assert.equal(registry.receive({token:challenge.token,trusted:true,type:"pointerup",button:2}),false);
  const pending=challenge.wait();
  assert.equal(registry.receive({token:challenge.token,trusted:true,type:"pointerup",button:0}),true);
  assert.deepEqual(await pending,{trusted:true,type:"pointerup",button:0});
  assert.equal(registry.receive({token:challenge.token,trusted:true,type:"pointerup",button:0}),false);
  assert.throws(()=>registry.issue({type:"pointermove"}),TypeError);
  challenge.close();
});

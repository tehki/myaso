import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { createM147RecoveryCueReceipt, dispatchM147CuePunish,
  planM147OrdinaryFocusRetreat, M147_BROWSER_CUE_OBSERVER } from "../scripts/m147-recovery-cue-receipt.mjs";

function fixture() {
  let time = 1000, serial = 0;
  const timers = new Map();
  const channel = createM147RecoveryCueReceipt({ now: () => time,
    makeToken: () => `actual-cue-test-token-${++serial}`,
    schedule: fn => { const id = ++serial; timers.set(id, fn); return id; },
    cancel: id => timers.delete(id) });
  const lease = channel.arm({ observerId: 2, targetId: 1, ids: [1, 2, 3] });
  time = 1050;
  const packet = { token: lease.token, playerNetId: 2, targetNetId: 1, serverTick: 861,
    observedEpochMs: 1040,
    cue: { visible: true, state: "jump-attack-recovery", label: "PUNISH", detail: "Jump attack recovery", epochMs: 1020 },
    fighters: [{ netId: 1, x: 92, y: 42, action: 18, hp: 100, guard: 100 },
      { netId: 2, x: 136, y: 42, action: 0, hp: 100, guard: 100 },
      { netId: 3, x: 172, y: 42, action: 0, hp: 100, guard: 100 }] };
  return { channel, lease, packet, timers, setTime: value => { time = value; },
    expire() { for (const fn of [...timers.values()]) fn(); } };
}

test("M147 accepts one correlated real-shaped pristine cue, copies evidence and refuses replay", async () => {
  const f = fixture();
  assert.equal(f.timers.size, 0); // Driver arming is outside the response budget.
  const wait = f.lease.wait();
  assert.equal(f.timers.size, 1);
  assert.equal(f.channel.receive(f.packet), true);
  f.packet.fighters[0].hp = 0;
  const received = await wait;
  assert.equal(received.fighters[0].hp, 100);
  assert.equal(received.receivedEpochMs, 1050);
  assert.equal(f.timers.size, 0);
  assert.equal(f.channel.receive(f.packet), false);
});

test("M147 rejects wrong nonce, role, target, stale/future cue, missing phase and non-pristine roster", async () => {
  const f = fixture();
  const variations = [
    p => { p.token = "wrong-token"; }, p => { p.playerNetId = 3; }, p => { p.targetNetId = 3; },
    p => { p.serverTick = NaN; }, p => { p.cue.epochMs = 900; },
    p => { p.observedEpochMs = 1100; }, p => { p.cue.state = ""; },
    p => { p.cue.visible = false; }, p => { p.fighters[0].action = 0; },
    p => { p.fighters[1].hp = 66; }, p => { p.fighters[2].guard = 62; },
    p => { p.fighters[2].netId = 2; }, p => { p.fighters[2].x = NaN; },
  ];
  for (const change of variations) {
    const packet = structuredClone(f.packet); change(packet);
    assert.equal(f.channel.receive(packet), false);
  }
  f.setTime(1400);
  assert.equal(f.channel.receive(f.packet), false);
  f.channel.dispose();
  assert.equal(await f.lease.wait(), null);
});

test("M147 timeout/cancellation drain the waiter, fence late posts and allow a fresh nonce", async () => {
  const f = fixture();
  assert.throws(() => f.channel.arm({ observerId: 2, targetId: 1, ids: [1, 2, 3] }), /already armed/);
  const wait = f.lease.wait(); f.expire();
  assert.equal(await wait, null);
  assert.equal(f.channel.receive(f.packet), false);
  const next = f.channel.arm({ observerId: 2, targetId: 1, ids: [1, 2, 3] });
  assert.notEqual(next.token, f.lease.token);
  assert.equal(f.channel.receive(f.packet), false);
  next.cancel(); assert.equal(await next.wait(), null);
  assert.equal(f.timers.size, 0);
});

test("M147 actual cue dispatches punish before unrelated jump ACK, still awaits that ACK", async () => {
  const f = fixture();
  let acknowledge, acknowledged = false, punished = false;
  const observed = await dispatchM147CuePunish({ lease: f.lease, armBrowser: async () => true,
    performJump() {
      f.channel.receive(f.packet);
      return new Promise(resolve => { acknowledge = () => { acknowledged = true; resolve(); }; });
    },
    async performPunish() { assert.equal(acknowledged, false); punished = true; acknowledge(); } });
  assert.equal(observed.targetNetId, 1);
  assert.equal(punished, true); assert.equal(acknowledged, true);
  assert.equal(f.timers.size, 0);
});

test("M147 never hides a failed native jump or acts after failed observer arming", async () => {
  const f = fixture();
  const task = dispatchM147CuePunish({ lease: f.lease, armBrowser: async () => true,
    performJump: async () => { throw new Error("native jump rejected"); },
    performPunish: async () => assert.fail("no cue, no punish") });
  await new Promise(setImmediate); f.expire();
  await assert.rejects(task, /native jump rejected/);
  const g = fixture();
  await assert.rejects(dispatchM147CuePunish({ lease: g.lease, armBrowser: async () => false,
    performJump: async () => assert.fail("not armed"), performPunish: async () => assert.fail("not armed") }), /did not arm/);
  assert.equal(await g.lease.wait(), null);
});

test("M147 retreats the left rival from the captured36/36 collision tie instead of pushing the right rival", () => {
  const actors = [74, 110, 146].map((x, i) => ({ netId: i + 1, x, y: 42, action: 0 }));
  const roles = { jumpId: 1, observerId: 2, closerId: 3 };
  const plan = planM147OrdinaryFocusRetreat(actors, roles);
  assert.equal(plan.key, "a"); assert.equal(plan.holdMs, 56);
  assert.equal(plan.jumpDistance, 36); assert.equal(plan.closerDistance, 36);
  assert.equal(planM147OrdinaryFocusRetreat([{ ...actors[0], x: 56 }, ...actors.slice(1)], roles), null);
  assert.throws(() => planM147OrdinaryFocusRetreat([{ ...actors[0], action: 30 }, ...actors.slice(1)], roles), /idle/);
  assert.throws(() => planM147OrdinaryFocusRetreat([actors[1], actors[1], actors[2]], roles));
  assert.throws(() => planM147OrdinaryFocusRetreat([{ ...actors[0], x: 10 }, ...actors.slice(1)], roles), /reach/);
});

test("M147 page observer arms before the attack and only reports current rendered cue plus actual replica phase", async () => {
  const f = fixture();
  let check, armed, cleared = false;
  const posts = [];
  let socket;
  class ObservedSocket {
    static OPEN = 1;
    constructor() { socket = this; this.readyState = 0; }
    send(body) { posts.push(JSON.parse(body)); }
    close() { this.readyState = 3; this.onclose?.(); }
  }
  const recovery = { hidden: true, dataset: { state: "jump-attack-recovery" } };
  const focus = { textContent: "PUNISH TARGET #1" };
  const acceptance = { playerNetId: 2, focusNetId: 1, serverTick: 861, fighters: f.packet.fighters };
  vm.runInNewContext(`(function(){${M147_BROWSER_CUE_OBSERVER}}).apply(null,args)`, {
    args: [f.lease.token, 1, 0, value => { armed = value; }],
    window: { __MYASO_ACCEPTANCE_STATE__: acceptance,
      __MYASO_M30_UI__: { recoveryTransitions: [f.packet.cue] } },
    document: { querySelector: selector => selector === "#opponent-recovery" ? recovery : focus },
    performance: { now: () => 0 }, Date: { now: () => 1040 },
    setInterval: callback => { check = callback; return 1; }, clearInterval: () => { cleared = true; },
    WebSocket: ObservedSocket, location: { host: "127.0.0.1:4174" },
  });
  assert.equal(armed, undefined);
  socket.readyState = 1; socket.onopen();
  assert.equal(armed, true); assert.equal(posts.length, 0);
  check(); assert.equal(posts.length, 0); // Historical cue while current DOM is hidden.
  recovery.hidden = false; acceptance.fighters[0].action = 0;
  check(); assert.equal(posts.length, 0); // Visible cue but no current target recovery.
  acceptance.fighters[0].action = 18; focus.textContent = "NEAREST #3";
  check(); assert.equal(posts.length, 0);
  focus.textContent = "PUNISH TARGET #1"; check();
  assert.equal(posts.length, 1); assert.equal(cleared, true);
  assert.equal(f.channel.receive(posts[0]), true);
  assert.equal((await f.lease.wait()).targetNetId, 1);
});

test("M147 observer expires a connection that never opens and reports arming failure only once", () => {
  let time = 0, check, socket, closed = 0;
  const reports = [];
  class NeverOpened {
    static OPEN = 1;
    constructor() { socket = this; this.readyState = 0; }
    close() { closed++; this.onclose?.(); }
  }
  vm.runInNewContext(`(function(){${M147_BROWSER_CUE_OBSERVER}}).apply(null,args)`, {
    args: ["actual-cue-test-token", 1, 0, result => reports.push(result)],
    WebSocket: NeverOpened, location: { host: "127.0.0.1:4174" },
    performance: { now: () => time },
    setInterval: callback => { check = callback; return 1; }, clearInterval() {},
    window: {}, document: { querySelector: () => assert.fail("unopened socket must not read cue") },
  });
  time = 3001; check();
  assert.equal(closed, 1); assert.deepEqual(reports, [false]);
  socket.onerror(); assert.deepEqual(reports, [false]);
});

test("M147 failed native punish still drains the attacker's real pending ACK", async () => {
  const f = fixture();
  let acknowledge, drained = false, settled = false;
  const task = dispatchM147CuePunish({ lease: f.lease, armBrowser: async () => true,
    performJump() {
      f.channel.receive(f.packet);
      return new Promise(resolve => { acknowledge = () => { drained = true; resolve(); }; });
    },
    performPunish: async () => { throw new Error("native punish rejected"); },
  });
  task.then(() => { settled = true; }, () => { settled = true; });
  await new Promise(setImmediate);
  assert.equal(settled, false); assert.equal(drained, false);
  acknowledge(); await assert.rejects(task, /native punish rejected/);
  assert.equal(drained, true); assert.equal(f.timers.size, 0);
});

test("M155 kick observation requires an idle punisher and actual knockdown, retaining the 360ms deadline", async () => {
  let time=1050;
  const channel=createM147RecoveryCueReceipt({mode:"kick",now:()=>time,makeToken:()=>"actual-kick-test-token"});
  const lease=channel.arm({observerId:3,targetId:2,ids:[1,2,3]});
  const packet={token:lease.token,playerNetId:3,targetNetId:2,serverTick:346,observedEpochMs:1050,
    cue:{visible:true,state:"knockdown",label:"PUNISH",detail:"Knockdown recovery",epochMs:1050},
    fighters:[{netId:1,x:132,y:42,action:13,hp:100,guard:100},
      {netId:2,x:186,y:42,action:19,hp:100,guard:100},{netId:3,x:302,y:42,action:0,hp:100,guard:100}]};
  for(const change of [p=>{p.fighters[2].action=19;},p=>{p.fighters[1].action=0;},p=>{p.cue.state="jump-attack-recovery";}]) {
    const bad=structuredClone(packet);change(bad);assert.equal(channel.receive(bad),false);
  }
  time=1410;assert.equal(channel.receive(packet),false);
  time=1050;assert.equal(channel.receive(packet),true);
  assert.equal((await lease.wait()).targetNetId,2);
  assert.throws(()=>createM147RecoveryCueReceipt({mode:"unknown"}),RangeError);
});

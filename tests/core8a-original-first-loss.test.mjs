import assert from "node:assert/strict";
import test from "node:test";
import { createInputRedundancy } from "../src/network/input-redundancy.mjs";
import { encodeInputPacket, decodeInputPacket, inputPacketBytes } from "../src/network/input-codec.mjs";
import { InputIngressWindow } from "../src/network/input-ingress.mjs";

function flight(samples) {
  const sender = createInputRedundancy();
  return samples.map((sample, sequence) => decodeInputPacket(encodeInputPacket({
    sequence, clientTick: sample.tick, samples: sender.push(sample),
  })));
}

function stream(first = 66, last = 74, actionTick = 68) {
  return Array.from({ length: last - first + 1 }, (_, i) => {
    const tick = first + i;
    return { tick, attack: tick >= actionTick, heavyAttack: tick >= actionTick,
      moveX: tick === 71 ? 1 : 0, block: tick === 71, facing: 0.3 };
  });
}

test("Core8A M230: original heavy tick68 survives dropped packet69 and missing packet70", () => {
  const packets = flight(stream());
  const dropped = packets.find(packet => packet.clientTick === 69);
  assert.deepEqual(dropped.samples.map(s => s.tick), [69, 68, 67]);
  assert.equal(dropped.samples.find(s => s.tick === 68).heavyAttack, true);
  const firstAdmitted = packets.find(packet => packet.clientTick === 71);
  assert.deepEqual(firstAdmitted.samples.map(s => s.tick), [71, 70, 68]);
  assert.equal(firstAdmitted.samples.find(s => s.tick === 68).heavyAttack, true);
  assert.equal(firstAdmitted.samples[0].block, true);
  assert.equal(firstAdmitted.samples[0].moveX, 1);
  assert.equal(encodeInputPacket({ sequence: 1, clientTick: 71, samples: firstAdmitted.samples }).byteLength, inputPacketBytes());
  const ingress = new InputIngressWindow();
  // Tick68 was never admitted before the impaired carrying packet69.
  for (const packet of packets.filter(p => p.clientTick < 68)) ingress.ingest(encodeInputPacket(packet));
  // The impairment really drops packet69; packet70 is absent from ingress.
  const replay = ingress.ingest(encodeInputPacket(firstAdmitted));
  assert.equal(replay.accepted.filter(s => s.tick === 68 && s.attack && s.heavyAttack).length, 1);
  for (const packet of packets.filter(p => p.clientTick > 71)) {
    assert.equal(ingress.ingest(encodeInputPacket(packet)).accepted.filter(s => s.tick === 68).length, 0,
      "original heavy action may enter one World only once");
  }
  assert.equal(ingress.ingest(encodeInputPacket(firstAdmitted)).accepted.length, 0);
});

test("Core8A M230 negatives: later held heavy and earlier light do not substitute the action tick", () => {
  const samples = stream(66, 74).map(s => s.tick === 67 ? { ...s, attack: true, heavyAttack: false } : s);
  const packets = flight(samples);
  const next = packets.find(p => p.clientTick === 71);
  assert.ok(next.samples.some(s => s.tick === 68 && s.heavyAttack));
  assert.ok(!next.samples.some(s => s.tick === 67 && s.heavyAttack));
  assert.notEqual(next.samples.find(s => s.tick === 70).tick, 68);
});

test("Core8A short release and reconnect do not replay stale heavy", () => {
  const packets = flight([
    {tick: 67}, {tick: 68, attack: true, heavyAttack: true},
    {tick: 69, attack: true, heavyAttack: true},
    {tick: 70, attack: false, heavyAttack: false},
    {tick: 71, attack: false, heavyAttack: false},
    {tick: 72, attack: false, heavyAttack: false},
  ]);
  assert.deepEqual(packets.at(-1).samples.map(s => s.tick), [72, 71, 70]);
  assert.ok(packets.at(-1).samples.every(s => !s.heavyAttack));
  const anotherLease = createInputRedundancy();
  assert.deepEqual(anotherLease.push({tick:1,attack:false}).map(s=>s.tick),[1]);
});

test("Core8A pinned heavy expires after bounded age and never crosses tick resets", () => {
  const redundancy = createInputRedundancy();
  const ticks = [];
  for (let tick = 67; tick <= 74; tick++) {
    ticks.push(redundancy.push({tick,attack:tick>=68,heavyAttack:tick>=68}).map(s=>s.tick));
  }
  assert.deepEqual(ticks[4], [71,70,68]);
  assert.deepEqual(ticks[5], [72,71,68]);
  assert.deepEqual(ticks[6], [73,72,71]);
  assert.deepEqual(redundancy.push({tick:1}).map(s=>s.tick), [1]);
});

test("Core8A latest source0 jump, kick, roll, move, facing and block are not displaced", () => {
  const sender = createInputRedundancy();
  for (let tick=66;tick<71;tick++) sender.push({tick,attack:tick>=68,heavyAttack:tick>=68});
  const freshest = {tick:71,attack:true,heavyAttack:true,moveX:1,moveY:-1,
    facing:1.2,block:true,kick:true,jump:true,dodge:true};
  const carried = sender.push(freshest);
  assert.equal(carried[0],freshest, "current source0 owns the first sample");
  assert.equal(carried[1].tick,70, "latest previous control owns the second sample");
  assert.ok(carried[0].jump && carried[0].kick && carried[0].dodge && carried[0].block);
  assert.equal(carried[0].moveX,1);
  assert.equal(carried[0].facing,1.2);
  assert.equal(carried.length,3);
});

test("Core8A release cancels pinned heavy before aged replay and never carries it to reconnect", () => {
  const s = createInputRedundancy();
  for(let tick=67;tick<=69;tick++) s.push({tick,attack:tick>=68,heavyAttack:tick>=68});
  s.push({tick:70,attack:false,heavyAttack:false});
  const after = s.push({tick:71,attack:false,heavyAttack:false});
  assert.deepEqual(after.map(x=>x.tick),[71,70,69],"only ordinary bounded history after release");
  assert.ok(!after.some(x=>x.tick===68),"cancelled pinned held action cannot return");
  const rejoined = createInputRedundancy();
  assert.deepEqual(rejoined.push({tick:68,attack:false,heavyAttack:false}).map(x=>x.tick),[68],
    "a same-numeric-tick new lease cannot inherit the old connection sample");
});

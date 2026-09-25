import test from "node:test";
import assert from "node:assert/strict";
import { NETWORK } from "../src/network/constants.mjs";
import { encodeInputPacket, decodeInputPacket, inputPacketBytes } from "../src/network/input-codec.mjs";
import { SpatialInterestGrid } from "../src/network/interest-grid.mjs";
import { InputIngressWindow } from "../src/network/input-ingress.mjs";
import { planReplication } from "../src/network/replication-planner.mjs";
import {
  applySnapshotRecords,
  buildEntityDelta,
  buildSnapshotDelta,
  buildWireStateMap,
  decodeSnapshot,
  dequantizeEntity,
  encodeSnapshot,
  quantizeEntity,
  SNAPSHOT_ENCODINGS,
  SNAPSHOT_FIELDS,
} from "../src/network/snapshot-codec.mjs";
import { isSequenceNewer16, sequenceDistance16 } from "../src/network/sequence.mjs";
import { applySnapshotPacketInPlace } from "../src/browser/snapshot-store.mjs";

function entity(netId, x, y, extra = {}) {
  return { netId, x, y, facing: 0, hp: 100, guard: 100, action: "idle", ...extra };
}

test("16-bit sequence comparison survives wraparound", () => {
  assert.equal(isSequenceNewer16(2, 65534), true);
  assert.equal(isSequenceNewer16(65534, 2), false);
  assert.equal(sequenceDistance16(2, 65534), 4);
});

test("input packet keeps three redundant samples in 34 self-contained bytes", () => {
  const packet = encodeInputPacket({
    sequence: 41,
    ackSnapshotSequence: 39,
    clientTick: 900,
    ackServerTick: 777,
    samples: [
      { tick: 900, moveX: 1, moveY: 0, facing: Math.PI / 2, attack: true },
      { tick: 899, moveX: 0.5, moveY: -0.5, facing: Math.PI / 2, block: true },
      { tick: 898, moveX: 0, moveY: 0, facing: 0, dodge: true },
    ],
  });
  assert.equal(packet.byteLength, 34);
  assert.equal(inputPacketBytes(), 34);
  const decoded = decodeInputPacket(packet);
  assert.equal(decoded.sequence, 41);
  assert.equal(decoded.ackSnapshotSequence, 39);
  assert.equal(decoded.clientTick, 900);
  assert.equal(decoded.ackServerTick, 777);
  assert.equal(decoded.samples.length, 3);
  assert.equal(decoded.samples[0].attack, true);
  assert.equal(decoded.samples[1].block, true);
  assert.equal(decoded.samples[2].dodge, true);
  assert.ok(Math.abs(decoded.samples[1].moveX - 0.5) < 0.01);
});

test("heavy attack uses a spare input bit without expanding the packet", () => {
  const packet = encodeInputPacket({
    sequence: 42,
    clientTick: 903,
    samples: [
      { tick: 903, facing: 0.75, heavyAttack: true },
      { tick: 902, facing: 0.75 },
      { tick: 901, facing: 0.75 },
    ],
  });
  assert.equal(packet.byteLength, 34);
  const decoded = decodeInputPacket(packet);
  assert.equal(decoded.samples[0].attack, false);
  assert.equal(decoded.samples[0].heavyAttack, true);
  assert.equal(decoded.samples[0].dodge, false);
  assert.equal(decoded.samples[0].block, false);
  assert.equal(decoded.samples[1].heavyAttack, false);
});


test("Wilds kick run and jump fit the existing one-byte input button field", () => {
  const packet = encodeInputPacket({
    sequence: 12,
    clientTick: 90,
    samples: [{
      tick: 90,
      moveX: 0.25,
      moveY: -0.5,
      facing: 1.2,
      attack: false,
      heavyAttack: false,
      dodge: false,
      block: false,
      kick: true,
      run: true,
      jump: true,
    }],
  });
  assert.equal(packet.byteLength, inputPacketBytes(1));
  const decoded = decodeInputPacket(packet).samples[0];
  assert.equal(decoded.kick, true);
  assert.equal(decoded.run, true);
  assert.equal(decoded.jump, true);
  assert.equal(decoded.attack, false);
  assert.equal(decoded.dodge, false);
  assert.equal(decoded.block, false);
});

test("thrust action phases survive snapshot encoding", () => {
  for (const [action, expected] of [
    ["thrust_windup", 20],
    ["thrust_active", 21],
    ["thrust_recovery", 22],
  ]) {
    const entityState = quantizeEntity({
      netId: expected,
      x: 100,
      y: 120,
      facing: 0,
      hp: 100,
      guard: 100,
      action,
    });
    assert.equal(entityState.action, expected);
    const packet = encodeSnapshot({
      sequence: expected,
      serverTick: expected,
      records: [{ ...entityState, mask: 0x0f }],
      full: true,
    });
    assert.equal(decodeSnapshot(packet).records[0].action, expected);
  }
});

test("knockdown action survives snapshot encoding as a distinct state", () => {
  const entity = quantizeEntity({
    netId: 7,
    x: 120,
    y: 140,
    facing: 0.5,
    hp: 100,
    guard: 100,
    action: "knockdown",
  });
  assert.equal(entity.action, 19);
  const packet = encodeSnapshot({
    sequence: 22,
    serverTick: 44,
    records: [{ ...entity, mask: 0x0f }],
    full: true,
  });
  const decoded = decodeSnapshot(packet);
  assert.equal(decoded.records[0].action, 19);
});

test("heavy strike action states remain compact snapshot values", () => {
  const names = [
    ["heavy_attack_windup", 9],
    ["heavy_attack_active", 10],
    ["heavy_attack_recovery", 11],
  ];
  for (const [action, expectedCode] of names) {
    const state = quantizeEntity(entity(77, 400, 400, { action }));
    assert.equal(state.action, expectedCode);
    const packet = encodeSnapshot({
      sequence: expectedCode,
      baselineSequence: expectedCode - 1,
      serverTick: 1000 + expectedCode,
      full: true,
      records: [buildEntityDelta(state)],
      maxBytes: 1100,
    });
    const decoded = decodeSnapshot(packet);
    const applied = applySnapshotRecords(new Map(), decoded.records);
    assert.equal(applied.get(77).action, expectedCode);
    assert.equal(dequantizeEntity(applied.get(77)).action, action);
  }
});

test("server input ingress deduplicates redundant and reordered samples", () => {
  const ingress = new InputIngressWindow({ historyTicks: 10 });
  const packetA = encodeInputPacket({
    sequence: 1, clientTick: 100, ackServerTick: 20,
    samples: [{ tick: 100, moveX: 1 }, { tick: 99, moveX: 1 }, { tick: 98, moveX: 1 }],
  });
  const packetB = encodeInputPacket({
    sequence: 2, clientTick: 102, ackServerTick: 21,
    samples: [{ tick: 102, moveX: 1 }, { tick: 101, moveX: 1 }, { tick: 100, moveX: 1 }],
  });
  assert.deepEqual(ingress.ingest(packetA).accepted.map((sample) => sample.tick), [98, 99, 100]);
  assert.deepEqual(ingress.ingest(packetB).accepted.map((sample) => sample.tick), [101, 102]);
});

test("server input ingress drops samples outside its bounded replay window", () => {
  const ingress = new InputIngressWindow({ historyTicks: 4 });
  ingress.ingest(encodeInputPacket({ sequence: 1, clientTick: 100, samples: [{ tick: 100 }, { tick: 99 }] }));
  const result = ingress.ingest(encodeInputPacket({ sequence: 2, clientTick: 106, samples: [{ tick: 106 }, { tick: 105 }, { tick: 100 }] }));
  assert.deepEqual(result.accepted.map((sample) => sample.tick), [105, 106]);
});

test("snapshot delta encodes only changed fields and removals", () => {
  const baseline = [entity(1, 100, 100), entity(2, 200, 200)];
  const current = [entity(1, 101, 100, { hp: 66, action: "attack_windup" }), entity(3, 300, 300)];
  const records = buildSnapshotDelta(current, baseline);
  assert.equal(records.length, 3);
  const packet = encodeSnapshot({ sequence: 7, baselineSequence: 6, serverTick: 1234, records, maxBytes: 1100 });
  const decoded = decodeSnapshot(packet);
  assert.equal(decoded.sequence, 7);
  assert.equal(decoded.baselineSequence, 6);
  assert.equal(decoded.records.length, 3);

  const baselineMap = new Map(baseline.map((value) => {
    const quantized = quantizeEntity(value);
    return [quantized.netId, quantized];
  }));
  const next = applySnapshotRecords(baselineMap, decoded.records);
  assert.equal(next.has(2), false);
  assert.equal(next.has(3), true);
  const fighter = dequantizeEntity(next.get(1));
  assert.equal(fighter.hp, 66);
  assert.equal(fighter.action, "attack_windup");
  assert.ok(Math.abs(fighter.x - 101) <= 1);
});

test("packed snapshot record headers shrink 512-range IDs and preserve escaped IDs", () => {
  const records = [
    {
      netId: 200,
      mask: SNAPSHOT_FIELDS.FULL,
      x: 800,
      y: 1600,
      facing: 2570,
      hp: 91,
      guard: 73,
      action: 2,
      flags: 1,
    },
    {
      netId: 512,
      mask: SNAPSHOT_FIELDS.POSITION | SNAPSHOT_FIELDS.FACING,
      x: 2400,
      y: 3200,
      facing: 5140,
    },
    { netId: 70_000, mask: SNAPSHOT_FIELDS.REMOVED },
  ];

  const packed = encodeSnapshot({
    sequence: 7,
    baselineSequence: 6,
    serverTick: 1234,
    records,
    maxBytes: 1100,
    encoding: SNAPSHOT_ENCODINGS.PACKED_U10_IDS_U6_MASK_U8_FACING_U12_POSITION,
  });
  const previous = encodeSnapshot({
    sequence: 7,
    baselineSequence: 6,
    serverTick: 1234,
    records,
    maxBytes: 1100,
    encoding: SNAPSHOT_ENCODINGS.VARINT_IDS_U8_FACING_U12_POSITION,
  });

  assert.ok(packed.byteLength < previous.byteLength);
  const decoded = decodeSnapshot(packed);
  assert.equal(
    decoded.encoding,
    SNAPSHOT_ENCODINGS.PACKED_U10_IDS_U6_MASK_U8_FACING_U12_POSITION,
  );
  assert.deepEqual(decoded.records, records);
});

test("local-cell snapshot positions save a byte without changing compact coordinates", () => {
  const records = [
    { netId: 10, mask: SNAPSHOT_FIELDS.POSITION, x: 800, y: 1600 },
    { netId: 11, mask: SNAPSHOT_FIELDS.POSITION, x: 1000, y: 1800 },
    { netId: 12, mask: SNAPSHOT_FIELDS.FACING, facing: 0 },
    { netId: 13, mask: SNAPSHOT_FIELDS.POSITION, x: 2400, y: 1800 },
  ];

  const local = encodeSnapshot({
    sequence: 9,
    baselineSequence: 8,
    serverTick: 456,
    records,
    maxBytes: 1100,
    encoding: SNAPSHOT_ENCODINGS.PACKED_U10_IDS_U6_MASK_U8_FACING_LOCAL_U12_POSITION,
  });
  const absolute = encodeSnapshot({
    sequence: 9,
    baselineSequence: 8,
    serverTick: 456,
    records,
    maxBytes: 1100,
    encoding: SNAPSHOT_ENCODINGS.PACKED_U10_IDS_U6_MASK_U8_FACING_U12_POSITION,
  });

  assert.equal(local.byteLength + 1, absolute.byteLength);
  const decoded = decodeSnapshot(local);
  assert.equal(
    decoded.encoding,
    SNAPSHOT_ENCODINGS.PACKED_U10_IDS_U6_MASK_U8_FACING_LOCAL_U12_POSITION,
  );
  assert.deepEqual(decoded.records, records);

  const state = new Map();
  const result = applySnapshotPacketInPlace(state, local);
  assert.equal(result.encoding, SNAPSHOT_ENCODINGS.PACKED_U10_IDS_U6_MASK_U8_FACING_LOCAL_U12_POSITION);
  assert.equal(state.get(10).x, 200);
  assert.equal(state.get(10).y, 400);
  assert.equal(state.get(11).x, 250);
  assert.equal(state.get(11).y, 450);
  assert.equal(state.get(13).x, 600);
  assert.equal(state.get(13).y, 450);
});

test("compact snapshot action flags shrink common values and preserve wide escapes", () => {
  const records = [
    { netId: 10, mask: SNAPSHOT_FIELDS.ACTION, action: 2, flags: 1 },
    { netId: 11, mask: SNAPSHOT_FIELDS.ACTION, action: 8, flags: 2 },
    { netId: 12, mask: SNAPSHOT_FIELDS.ACTION, action: 0, flags: 0 },
    { netId: 13, mask: SNAPSHOT_FIELDS.ACTION, action: 200, flags: 240 },
  ];

  const compact = encodeSnapshot({
    sequence: 10,
    baselineSequence: 9,
    serverTick: 789,
    records,
    maxBytes: 1100,
    encoding: SNAPSHOT_ENCODINGS.PACKED_U10_IDS_U6_MASK_U8_FACING_LOCAL_U12_POSITION_U4_ACTION_FLAGS,
  });
  const previous = encodeSnapshot({
    sequence: 10,
    baselineSequence: 9,
    serverTick: 789,
    records,
    maxBytes: 1100,
    encoding: SNAPSHOT_ENCODINGS.PACKED_U10_IDS_U6_MASK_U8_FACING_LOCAL_U12_POSITION,
  });

  assert.equal(compact.byteLength + 2, previous.byteLength);
  assert.deepEqual(decodeSnapshot(compact).records, records);

  const state = new Map();
  const applied = applySnapshotPacketInPlace(state, compact);
  assert.equal(
    applied.encoding,
    SNAPSHOT_ENCODINGS.PACKED_U10_IDS_U6_MASK_U8_FACING_LOCAL_U12_POSITION_U4_ACTION_FLAGS,
  );
  assert.equal(state.get(10).action, 2);
  assert.equal(state.get(10).flags, 1);
  assert.equal(state.get(13).action, 200);
  assert.equal(state.get(13).flags, 240);

  const malformed = new Uint8Array(encodeSnapshot({
    sequence: 11,
    baselineSequence: 10,
    serverTick: 790,
    records: [{ netId: 10, mask: SNAPSHOT_FIELDS.ACTION, action: 16, flags: 0 }],
    maxBytes: 1100,
    encoding: SNAPSHOT_ENCODINGS.PACKED_U10_IDS_U6_MASK_U8_FACING_LOCAL_U12_POSITION_U4_ACTION_FLAGS,
  }));
  const actionOffset = 14 + 2;
  assert.equal(malformed[actionOffset], 0xff);
  malformed[actionOffset + 1] = 2;
  malformed[actionOffset + 2] = 1;
  assert.throws(
    () => decodeSnapshot(malformed),
    /non-canonical compact snapshot action flags/,
  );
  assert.throws(
    () => applySnapshotPacketInPlace(new Map(), malformed),
    /non-canonical compact snapshot action flags/,
  );
});

test("snapshot encoder refuses to fragment beyond the datagram budget", () => {
  // Keep this fixture well beyond the budget even as record encodings become
  // more compact; the contract under test is fail-closed fragmentation.
  const current = Array.from({ length: 220 }, (_, index) => entity(index + 1, 10 + index, 10));
  const records = buildSnapshotDelta(current, []);
  assert.throws(() => encodeSnapshot({ sequence: 1, serverTick: 1, records, maxBytes: 1100 }), /exceeds datagram budget/);
});

test("interest grid query matches a naive circle for 512 players", () => {
  const grid = new SpatialInterestGrid({ cellSize: NETWORK.interest.cellSize });
  const players = [];
  let seed = 0x12345678;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
  for (let index = 0; index < NETWORK.targetPlayersPerMap; index += 1) {
    const player = entity(index + 1, random() * 8000, random() * 8000);
    players.push(player);
    grid.upsert(player);
  }
  const x = 4000;
  const y = 4000;
  const radius = NETWORK.interest.midRadius;
  const indexed = grid.queryCircle(x, y, radius);
  const naive = players.filter((player) => Math.hypot(player.x - x, player.y - y) <= radius);
  assert.deepEqual(indexed.entities.map((value) => value.netId).sort((a, b) => a - b), naive.map((value) => value.netId).sort((a, b) => a - b));
  assert.ok(indexed.candidatesChecked < players.length, `expected grid to inspect fewer than ${players.length}, got ${indexed.candidatesChecked}`);
});

test("interest grid moves entities between cells without ghost duplicates", () => {
  const grid = new SpatialInterestGrid({ cellSize: 100 });
  const player = entity(1, 10, 10);
  grid.upsert(player);
  player.x = 510;
  grid.upsert(player);
  assert.equal(grid.queryCircle(10, 10, 50).entities.length, 0);
  assert.deepEqual(grid.queryCircle(510, 10, 50).entities.map((value) => value.netId), [1]);
});

test("replication planner prioritizes owner and hot combat under pressure", () => {
  const viewer = entity(1, 1000, 1000, { recentlyInteractedWith: 2 });
  const candidates = [viewer];
  for (let index = 2; index <= 220; index += 1) {
    const angle = (index / 220) * Math.PI * 2;
    const radius = 150 + (index % 12) * 35;
    candidates.push(entity(index, viewer.x + Math.cos(angle) * radius, viewer.y + Math.sin(angle) * radius, {
      combatHot: index === 2 || index === 3,
    }));
  }
  const wireStates = buildWireStateMap(candidates);
  const baseline = buildWireStateMap(candidates.map((value) => ({ ...value, x: value.x - 1 })));
  const plan = planReplication({
    viewer,
    candidates,
    baseline,
    wireStates,
    lastSentTick: new Map(),
    serverTick: 600,
    byteBudget: NETWORK.conservativeDatagramBytes,
  });
  assert.ok(plan.bytes <= NETWORK.conservativeDatagramBytes);
  assert.ok(plan.selected.some((value) => value.netId === 1));
  assert.ok(plan.selected.some((value) => value.netId === 2));
  assert.ok(plan.selected.some((value) => value.netId === 3));
  assert.ok(plan.omittedDueToBudget > 0);
});

test("replication planner accepts an array baseline fallback", () => {
  const viewer = entity(1, 100, 100);
  const other = entity(2, 130, 100);
  const candidates = [viewer, other];
  const plan = planReplication({
    viewer,
    candidates,
    baseline: candidates.map((value) => ({ ...value, x: value.x - 1 })),
    serverTick: 30,
  });
  assert.ok(plan.records.length >= 1);
  assert.ok(plan.bytes <= NETWORK.conservativeDatagramBytes);
});

test("512-player dense-map replication still produces a bounded datagram", () => {
  const viewer = entity(1, 4000, 4000);
  const candidates = [viewer];
  for (let index = 2; index <= NETWORK.targetPlayersPerMap; index += 1) {
    const angle = index * 2.399963229728653;
    const radius = 40 + (index % 40) * 12;
    candidates.push(entity(index, viewer.x + Math.cos(angle) * radius, viewer.y + Math.sin(angle) * radius));
  }
  const wireStates = buildWireStateMap(candidates);
  const baseline = buildWireStateMap(candidates.map((value) => ({ ...value, x: value.x - 0.5 })));
  const plan = planReplication({ viewer, candidates, baseline, wireStates, serverTick: 900, byteBudget: 1100 });
  const packet = encodeSnapshot({ sequence: 100, baselineSequence: 99, serverTick: 900, records: plan.records, maxBytes: 1100 });
  assert.ok(packet.byteLength <= 1100);
  assert.ok(plan.selected.length < candidates.length, "dense crowd should be priority-limited rather than fragmenting");
});

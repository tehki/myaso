import test from "node:test";
import assert from "node:assert/strict";
import { createFrameBudget } from "../src/browser/frame-budget.mjs";
import {
  applySnapshotPacketInPlace,
  createSnapshotApplyResult,
} from "../src/browser/snapshot-store.mjs";
import {
  buildEntityDelta,
  encodeSnapshot,
  quantizeEntity,
} from "../src/network/snapshot-codec.mjs";
import { connectGameTransport } from "../web/network-transport.mjs";

function fullRecord(entity) {
  return buildEntityDelta(quantizeEntity(entity));
}

test("browser frame budget bounds catch-up work and drops stale simulation debt", () => {
  const budget = createFrameBudget({ stepMs: 10, maxFrameDeltaMs: 50, maxStepsPerFrame: 3 });
  let stepped = 0;
  assert.deepEqual(budget.advance(100, () => { stepped += 1; }), {
    steps: 0,
    elapsedMs: 0,
    droppedMs: 0,
    alpha: 0,
  });

  const overloaded = budget.advance(200, () => { stepped += 1; });
  assert.equal(overloaded.steps, 3);
  assert.equal(overloaded.elapsedMs, 50);
  assert.equal(overloaded.droppedMs, 20);
  assert.equal(stepped, 3);

  const normal = budget.advance(210, () => { stepped += 1; });
  assert.equal(normal.steps, 1);
  assert.equal(normal.droppedMs, 0);
  assert.equal(stepped, 4);
});

test("browser snapshot store mutates existing entities instead of cloning the map", () => {
  const state = new Map([[99, { netId: 99, x: 1, y: 1 }]]);
  const result = createSnapshotApplyResult();
  const first = encodeSnapshot({
    sequence: 10,
    baselineSequence: 0xffff,
    serverTick: 100,
    full: true,
    records: [
      fullRecord({ netId: 1, x: 100, y: 120, facing: 0.5, hp: 100, guard: 100, action: "idle" }),
      fullRecord({ netId: 2, x: 180, y: 120, facing: 3.1, hp: 100, guard: 100, action: "block" }),
    ],
  });

  const returned = applySnapshotPacketInPlace(state, first, result);
  assert.equal(returned, result);
  assert.equal(state.has(99), false, "full snapshots clear stale browser entities");
  assert.equal(state.size, 2);
  assert.equal(result.created, 2);
  const entityOne = state.get(1);
  const entityTwo = state.get(2);

  const beforeOne = quantizeEntity({ netId: 1, x: 100, y: 120, facing: 0.5, hp: 100, guard: 100, action: "idle" });
  const afterOne = quantizeEntity({ netId: 1, x: 103, y: 121, facing: 0.6, hp: 66, guard: 80, action: "attack_recovery" });
  const delta = encodeSnapshot({
    sequence: 11,
    baselineSequence: 10,
    serverTick: 103,
    records: [
      buildEntityDelta(afterOne, beforeOne),
      { netId: 2, mask: 1 << 7 },
    ],
  });

  applySnapshotPacketInPlace(state, delta, result);
  assert.equal(state.get(1), entityOne, "updated entities keep object identity for renderer references");
  assert.equal(state.has(2), false);
  assert.equal(entityTwo.netId, 2, "removed entity references are not mutated after removal");
  assert.equal(state.get(1).hp, 66);
  assert.ok(Math.abs(state.get(1).x - 103) <= 1);
  assert.equal(result.created, 0);
  assert.equal(result.updated, 1);
  assert.equal(result.removed, 1);
});

test("repeated browser snapshot updates allocate no replacement entity objects", () => {
  const state = new Map();
  const result = createSnapshotApplyResult();
  const baselineEntity = { netId: 7, x: 20, y: 30, facing: 0, hp: 100, guard: 100, action: "idle" };
  const full = encodeSnapshot({
    sequence: 1,
    baselineSequence: 0xffff,
    serverTick: 1,
    full: true,
    records: [fullRecord(baselineEntity)],
  });
  applySnapshotPacketInPlace(state, full, result);
  const stableReference = state.get(7);
  let before = quantizeEntity(baselineEntity);

  for (let index = 2; index <= 250; index += 1) {
    const next = quantizeEntity({ ...baselineEntity, x: 20 + index * 0.25 });
    const packet = encodeSnapshot({
      sequence: index,
      baselineSequence: index - 1,
      serverTick: index,
      records: [buildEntityDelta(next, before)],
    });
    applySnapshotPacketInPlace(state, packet, result);
    assert.equal(state.get(7), stableReference);
    assert.equal(result.created, 0);
    before = next;
  }
});

test("owned WebTransport realtime sends avoid the defensive payload copy", async () => {
  const originalWebTransport = globalThis.WebTransport;
  const datagramWrites = [];

  class FakeReader {
    async read() {
      return { value: undefined, done: true };
    }

    releaseLock() {}
  }

  class FakeWriter {
    constructor(writes) {
      this.writes = writes;
      this.ready = Promise.resolve();
    }

    async write(value) {
      this.writes.push(value);
    }

    releaseLock() {}
  }

  class FakeWebTransport {
    constructor() {
      this.ready = Promise.resolve();
      this.datagramWriter = new FakeWriter(datagramWrites);
      this.reliableWriter = new FakeWriter([]);
      this.datagrams = {
        writable: { getWriter: () => this.datagramWriter },
        readable: { getReader: () => new FakeReader() },
      };
    }

    async createBidirectionalStream() {
      return {
        writable: { getWriter: () => this.reliableWriter },
        readable: { getReader: () => new FakeReader() },
      };
    }

    close() {}
  }

  globalThis.WebTransport = FakeWebTransport;
  try {
    const connection = await connectGameTransport({ webTransportUrl: "https://example.test/game" });
    const owned = new Uint8Array([1, 2, 3]);
    await connection.sendRealtimeOwned(owned);
    assert.equal(datagramWrites[0], owned, "owned payload should reach WebTransport without a copy");

    const copySafe = new Uint8Array([4, 5, 6]);
    await connection.sendRealtime(copySafe);
    assert.notEqual(datagramWrites[1], copySafe, "copy-safe API must retain its defensive copy");
    assert.deepEqual([...datagramWrites[1]], [4, 5, 6]);
    connection.close();
  } finally {
    if (originalWebTransport === undefined) delete globalThis.WebTransport;
    else globalThis.WebTransport = originalWebTransport;
  }
});

test("WebTransport close drains a pending realtime flush before releasing writer locks", async () => {
  const originalWebTransport = globalThis.WebTransport;
  let resolveDatagramReady;
  const datagramReady = new Promise((resolve) => { resolveDatagramReady = resolve; });
  let datagramReleased = false;
  let reliableReleased = false;
  let writeAttempted = false;

  class FakeReader {
    async read() {
      return { value: undefined, done: true };
    }

    releaseLock() {}
  }

  class FakeWriter {
    constructor({ delayed = false, onRelease }) {
      this.ready = delayed ? datagramReady : Promise.resolve();
      this.onRelease = onRelease;
    }

    async write() {
      writeAttempted = true;
      if (datagramReleased) throw new TypeError("Missing stream");
    }

    releaseLock() {
      this.onRelease();
    }
  }

  class FakeWebTransport {
    constructor() {
      this.ready = Promise.resolve();
      this.closed = new Promise((resolve) => { this.resolveClosed = resolve; });
      this.datagramWriter = new FakeWriter({
        delayed: true,
        onRelease: () => { datagramReleased = true; },
      });
      this.reliableWriter = new FakeWriter({
        onRelease: () => { reliableReleased = true; },
      });
      this.datagrams = {
        writable: { getWriter: () => this.datagramWriter },
        readable: { getReader: () => new FakeReader() },
      };
    }

    async createBidirectionalStream() {
      return {
        writable: { getWriter: () => this.reliableWriter },
        readable: { getReader: () => new FakeReader() },
      };
    }

    close() {
      this.resolveClosed();
    }
  }

  globalThis.WebTransport = FakeWebTransport;
  try {
    const connection = await connectGameTransport({ webTransportUrl: "https://example.test/game" });
    const pendingSend = connection.sendRealtimeOwned(new Uint8Array([9, 8, 7]));
    connection.close("test close");
    await Promise.resolve();
    assert.equal(datagramReleased, false, "pending writer must remain locked until the flush settles");

    resolveDatagramReady();
    await pendingSend;
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(writeAttempted, false, "closed connection must not write after writer.ready resolves");
    assert.equal(datagramReleased, true);
    assert.equal(reliableReleased, true);
  } finally {
    if (originalWebTransport === undefined) delete globalThis.WebTransport;
    else globalThis.WebTransport = originalWebTransport;
  }
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { connectGameTransport } from "../web/network-transport.mjs";
import { connectAuthoritativeClient } from "../web/authoritative-client.mjs";
import { ProposedSharedTypedGestureOutbox } from "../src/network/prealpha-lmb-gesture-outbox-proposal.mjs";

class OriginalQuicFixture {
  static sessions = [];
  static grantOnHello = true;
  constructor(url) {
    this.url = url;
    this.hello = null;
    this.writes = [];
    this.closedByClient = false;
    this.ready = Promise.resolve();
    this.closed = new Promise(resolve => { this.resolveClosed = resolve; });
    this.datagrams = {
      writable: { getWriter: () => ({
        ready: Promise.resolve(),
        write: async bytes => { this.writes.push(Uint8Array.from(bytes)); },
        releaseLock() {},
      }) },
      readable: new ReadableStream({ start: controller => { this.datagramSource = controller; } }),
    };
    OriginalQuicFixture.sessions.push(this);
  }
  async createBidirectionalStream() {
    const writable = new WritableStream({ write() {} });
    const readable = new ReadableStream({ start: controller => { this.reliableSource = controller; } });
    return { writable, readable };
  }
  async createUnidirectionalStream() {
    return new WritableStream({
      write: async bytes => {
        this.hello = Uint8Array.from(bytes);
        if (OriginalQuicFixture.grantOnHello) {
          // Original server's reliable stream: length=4, version2, opcode13, 0,0.
          queueMicrotask(() => this.reliableSource.enqueue(Uint8Array.from([4,0,2,0x13,0,0])));
        }
      },
    });
  }
  close() {
    if (this.closedByClient) return;
    this.closedByClient = true;
    this.resolveClosed();
    try { this.datagramSource.close(); } catch {}
    try { this.reliableSource.close(); } catch {}
  }
}
const v2 = (seq, id) => {
  const b = new Uint8Array(16);
  b[0] = 2; b[1] = 0x11; b[2] = 1;
  b[4] = seq; b[8] = id;
  return b;
};
async function withFixture(fn) {
  const previous = globalThis.WebTransport;
  globalThis.WebTransport = OriginalQuicFixture;
  OriginalQuicFixture.sessions = [];
  OriginalQuicFixture.grantOnHello = true;
  try { return await fn(); }
  finally {
    for (const s of OriginalQuicFixture.sessions) s.close();
    if (previous === undefined) delete globalThis.WebTransport;
    else globalThis.WebTransport = previous;
  }
}

test("same admitted QUIC connection waits for exact original Rust 0x13 grant", () => withFixture(async () => {
  const forwarded = [];
  const connection = await connectGameTransport({
    webTransportUrl: "https://127.0.0.1:4433/game",
    onReliable: packet => forwarded.push(Array.from(packet)),
  });
  const stream = connection.transport;
  assert.equal(connection.kind, "webtransport");
  assert.equal(stream.hello, null);
  assert.throws(() => connection.sendExperimentalGestureEdge(v2(1,1)), /server grant/);
  assert.equal(await connection.negotiateExperimentalGestureV2(), true);
  assert.deepEqual(Array.from(stream.hello), [2,0x10,77,89,65,83,79,49]);
  assert.deepEqual(forwarded, [], "private grant must not be mistaken for snapshot/kill");
  // Genuine legacy reliable payloads still reach the original client callback.
  stream.reliableSource.enqueue(Uint8Array.from([2,0,99,11]));
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(forwarded, [[99,11]]);
  connection.close("test");
}));

test("typed source0 and source1 PRESS/RELEASE use NONCOALESCING ordered datagrams", () => withFixture(async () => {
  const connection = await connectGameTransport({webTransportUrl:"https://localhost:4433/game"});
  await connection.negotiateExperimentalGestureV2();
  const source0Press = v2(1,1), source1Press=v2(2,2), source1Up=v2(3,2), source0Up=v2(4,1);
  await Promise.all([source0Press,source1Press,source1Up,source0Up].map(x=>connection.sendExperimentalGestureEdge(x)));
  assert.deepEqual(connection.transport.writes.map(x=>x[4]), [1,2,3,4]);
  assert.deepEqual(connection.transport.writes.map(x=>x[8]), [1,2,2,1]);
  source0Press[4] = 77;
  assert.equal(connection.transport.writes[0][4],1,"write must own immutable edge bytes");
  connection.close("test");
}));

test("public host can NEVER request this loopback-only experimental capability", () => withFixture(async () => {
  const c=await connectGameTransport({webTransportUrl:"https://game.open-trust-layer.org:4433/game"});
  await assert.rejects(c.negotiateExperimentalGestureV2(),/loopback-only/);
  assert.equal(c.transport.hello,null);
  assert.throws(()=>c.sendExperimentalGestureEdge(v2(1,1)),/server grant/);
  c.close("test");
}));

test("missing v2 grant fails CLOSED and never emits typed combat edges", () => withFixture(async () => {
  OriginalQuicFixture.grantOnHello=false;
  const c=await connectGameTransport({webTransportUrl:"https://127.0.0.1:4433/game"});
  await assert.rejects(c.negotiateExperimentalGestureV2({timeoutMs:100}),/timed out/);
  assert.equal(c.transport.closedByClient,true);
  assert.throws(()=>c.sendExperimentalGestureEdge(v2(1,1)),/server grant/);
  assert.deepEqual(c.transport.writes,[]);
}));

test("invalid typed packet and old closed lease cannot enter gesture QUIC queue", () => withFixture(async () => {
  const c=await connectGameTransport({webTransportUrl:"https://127.0.0.1:4433/game"});
  await c.negotiateExperimentalGestureV2();
  assert.throws(()=>c.sendExperimentalGestureEdge(new Uint8Array([2,0x11])),/16-byte/);
  assert.throws(()=>c.sendExperimentalGestureEdge(new Uint8Array(16)),/16-byte/);
  await c.sendExperimentalGestureEdge(v2(1,1));
  c.close("actor retired");
  assert.throws(()=>c.sendExperimentalGestureEdge(v2(2,1)),/server grant/);
  assert.equal(c.transport.writes.length,1);
}));

const originalRustAck = (sequence, gestureId, status = 1, tick = 99) => {
  const packet = new Uint8Array(16), view = new DataView(packet.buffer);
  view.setUint8(0,2); view.setUint8(1,0x12); view.setUint8(2,status);
  view.setUint32(4,sequence,true); view.setUint32(8,gestureId,true); view.setUint32(12,tick,true);
  return packet;
};

test("first-party client routes strict 0x12 ACK to original same-lease shared typed outbox only", () => withFixture(async () => {
  let holder, acknowledged = null;
  const c = await connectAuthoritativeClient({
    webTransportUrl:"https://127.0.0.1:4433/game",
    onExperimentalGestureAck(bytes, currentLease) {
      acknowledged = holder.receiveAck(bytes, currentLease);
    },
  });
  await c.negotiateExperimentalGestureV2();
  const lease = c.transport;
  holder = new ProposedSharedTypedGestureOutbox({reviewVersion:2,trustedLease:lease});
  const press = holder.begin(0,3);
  assert.equal(press.sequence,1);
  const send = holder.nextSendBatch(1);
  assert.equal(send.length,1);
  await c.sendExperimentalGestureEdge(send[0].bytes);
  lease.transport.datagramSource.enqueue(originalRustAck(press.sequence,press.gestureId));
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(acknowledged?.sequence,1);
  assert.equal(acknowledged?.serverTick,99);
  assert.equal(acknowledged?.combatCommitted,false,"receipt cannot authorize a combat HIT");
  assert.equal(holder.snapshot.pending,0);
  assert.deepEqual(lease.transport.writes.map(x=>x[4]),[1]);
  holder.retire();
  c.close("test");
}));

test("unnegotiated typed ACK closes original client transport, never admits a phantom receipt", () => withFixture(async () => {
  const errors=[],seen=[];
  const c=await connectAuthoritativeClient({
    webTransportUrl:"https://127.0.0.1:4433/game",
    onProtocolError:error=>errors.push(error.message),
    onExperimentalGestureAck:bytes=>seen.push(bytes),
  });
  c.transport.transport.datagramSource.enqueue(originalRustAck(1,1));
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(c.transport.transport.closedByClient,true);
  assert.deepEqual(seen,[]);
  assert.equal(errors.length,1);
  assert.match(errors[0],/current reviewed grant/);
}));

test("last sampled QUIC datagram cannot strand at flush settlement", () => withFixture(async () => {
  const c = await connectGameTransport({ webTransportUrl: "https://127.0.0.1:4433/game" });
  let finishFirst, firstStarted;
  const firstStartedPromise = new Promise(resolve => { firstStarted = resolve; });
  const firstWriteGate = new Promise(resolve => { finishFirst = resolve; });
  const writes = [];
  // One original QUIC datagram writer. Returning the gate directly makes
  // the async flush continuation run before our next queued microtask.
  c.datagramWriter = {
    ready: Promise.resolve(),
    write(bytes) {
      writes.push(Array.from(bytes));
      if (writes.length === 1) { firstStarted(); return firstWriteGate; }
      return Promise.resolve();
    },
    releaseLock() {},
  };
  const first = c.sendRealtimeOwned(Uint8Array.from([1, 2, 3]));
  await firstStartedPromise;
  finishFirst();
  // This arrives just AFTER the final writer await resumes and the flushing
  // loop observes no other sample, but BEFORE its promise finally settles.
  queueMicrotask(() => {
    void c.sendRealtimeOwned(Uint8Array.from([4, 5, 6]));
  });
  await first;
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(writes, [[1, 2, 3], [4, 5, 6]],
    "last current-lease sample must not wait for an unrelated third input");
  c.close("test");
}));

test("reliable send rejects lease retirement while waiting for writer readiness", () => withFixture(async () => {
  const c = await connectGameTransport({ webTransportUrl: "https://127.0.0.1:4433/game" });
  let unblock;
  const wrote = [];
  // Existing original bidi writer, intentionally stalled. No second client,
  // stream or sender is introduced; this models a genuine writer.ready wait.
  c.reliableWriter = {
    ready: new Promise(resolve => { unblock = resolve; }),
    write: async bytes => { wrote.push(Array.from(bytes)); },
    releaseLock() {},
  };
  const pending = c.sendReliable(Uint8Array.from([5, 6]));
  c.close("actor lease retired while reliable writer stalled");
  unblock();
  await assert.rejects(pending, /closed/,
    "unwritten reliable data must not resolve as a successful transport write");
  assert.deepEqual(wrote, [], "retired-lease bytes never reach the original writer");
  assert.equal(c.transport.closedByClient, true);
}));

test("reliable write completion after lease retirement is not credited as current delivery", () => withFixture(async () => {
  const c = await connectGameTransport({ webTransportUrl: "https://127.0.0.1:4433/game" });
  let markWriteStarted, finishWrite;
  const writeStarted = new Promise(resolve => { markWriteStarted = resolve; });
  const writeFinished = new Promise(resolve => { finishWrite = resolve; });
  const attempted = [];
  // Preserve ONE original bidi writer: simulate the in-flight write completing
  // after its actor/connection lease is retired, not a new protocol or HIT.
  c.reliableWriter = {
    ready: Promise.resolve(),
    async write(bytes) {
      attempted.push(Array.from(bytes));
      markWriteStarted();
      await writeFinished;
    },
    releaseLock() {},
  };
  const pending = c.sendReliable(Uint8Array.from([5, 6]));
  await writeStarted;
  c.close("retired during original reliable write");
  finishWrite();
  await assert.rejects(pending, /closed/,
    "an old-lease write completion cannot advance an M147 written cursor");
  assert.deepEqual(attempted, [[2, 0, 5, 6]],
    "exactly one original length-framed write was attempted before retirement");
  assert.equal(c.transport.closedByClient, true);
}));

test("backpressured 65th physical gesture edge fails closed without loss or unbounded writes", () => withFixture(async () => {
  const c = await connectGameTransport({ webTransportUrl: "https://127.0.0.1:4433/game" });
  await c.negotiateExperimentalGestureV2();
  let unblock;
  // The real sender is deliberately backpressured at its writer.ready gate.
  // This models a stalled QUIC transport, not synthetic combat admission.
  c.datagramWriter.ready = new Promise(resolve => { unblock = resolve; });
  const pending = [];
  for (let n = 1; n <= 64; n += 1) {
    const event = v2(n, n);
    pending.push(c.sendExperimentalGestureEdge(event));
  }
  assert.equal(c.pendingGestureEdges, 64);
  assert.equal(c.transport.writes.length, 0, "nothing sent while the real writer cannot accept bytes");
  assert.throws(() => c.sendExperimentalGestureEdge(v2(65, 65)), /bounded experimental gesture queue overflow/);
  assert.equal(c.transport.closedByClient, true, "overflow retires entire same-QUIC lease");
  unblock();
  const settled = await Promise.allSettled(pending);
  assert.equal(settled.length, 64);
  assert.equal(settled.every(result => result.status === "rejected"), true,
    "queued old-lease edges cannot escape after full-lease retirement");
  assert.equal(c.pendingGestureEdges, 0, "all 64 queue counters must retire");
  assert.equal(c.transport.writes.length, 0, "no phantom packet survives retired lease");
  assert.throws(() => c.sendExperimentalGestureEdge(v2(66, 66)), /server grant/);
}));

test("noncoalescing gesture queue drains exactly and restores capacity after a real backpressure release", () => withFixture(async () => {
  const c = await connectGameTransport({ webTransportUrl: "https://localhost:4433/game" });
  await c.negotiateExperimentalGestureV2();
  let unblock;
  c.datagramWriter.ready = new Promise(resolve => { unblock = resolve; });
  const sends = Array.from({ length: 32 }, (_, i) =>
    c.sendExperimentalGestureEdge(v2(i + 1, i + 1)));
  assert.equal(c.pendingGestureEdges, 32);
  unblock();
  await Promise.all(sends);
  assert.equal(c.pendingGestureEdges, 0);
  assert.deepEqual(c.transport.writes.map(packet => packet[4]),
    Array.from({ length: 32 }, (_, i) => i + 1));
  await c.sendExperimentalGestureEdge(v2(33, 33));
  assert.equal(c.pendingGestureEdges, 0);
  assert.equal(c.transport.writes.at(-1)[4], 33);
  c.close("test");
}));

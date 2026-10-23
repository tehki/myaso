import assert from "node:assert/strict";
import { test } from "node:test";
import { connectGameTransport } from "../web/network-transport.mjs";

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

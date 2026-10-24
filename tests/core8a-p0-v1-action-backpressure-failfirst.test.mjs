// Core8A P0 SIMPLIFICATION — intentional fail-first against the ACTUAL
// browser WebTransport adapter. No new networking service or synthetic World.
// This test must remain RED until one Main0/#723-authorized ingress contract
// transports physical one-shot actions through congestion without stale replay.
import test from "node:test";
import assert from "node:assert/strict";
import { connectGameTransport } from "../web/network-transport.mjs";
import { encodeInputPacket, decodeInputPacket } from "../src/network/input-codec.mjs";

test("P0 original QUIC sender retains a one-shot v1 attack over bounded writer stall", async () => {
  const original = globalThis.WebTransport;
  let releaseDatagramReady;
  const blockedWriter = new Promise((resolve) => { releaseDatagramReady = resolve; });
  const writes = [];
  const datagramWriter = {
    get ready() { return blockedWriter; },
    async write(bytes) { writes.push(new Uint8Array(bytes)); },
    releaseLock() {},
  };
  const readForever = () => new Promise(() => {});
  const makeReader = () => ({ read: readForever, releaseLock() {} });
  const reliableWriter = {
    get ready() { return Promise.resolve(); },
    async write() {},
    releaseLock() {},
  };
  globalThis.WebTransport = class OriginalSenderHarness {
    constructor() {
      this.ready = Promise.resolve();
      this.closed = Promise.resolve();
      this.datagrams = {
        writable: { getWriter: () => datagramWriter },
        readable: { getReader: makeReader },
      };
    }
    async createBidirectionalStream() {
      return {
        writable: { getWriter: () => reliableWriter },
        readable: { getReader: makeReader },
      };
    }
    close() {}
  };

  let connection;
  try {
    connection = await connectGameTransport({ webTransportUrl: "https://127.0.0.1:4433/game" });
    assert.equal(connection.kind, "webtransport");

    // Reconstruct EXACT original v1 sample policy: 30Hz packets with at
    // most 3 retained samples, newest first. A genuine short action at tick1
    // is followed by four neutral continuous movement samples. NO synthetic
    // action is supplied after tick1.
    const history = [];
    const authoredPackets = [];
    const pending = [];
    for (let tick = 1; tick <= 5; tick += 1) {
      history.push({
        tick, attack: tick === 1, heavyAttack: false,
        moveX: 0, moveY: 0, facing: 0,
      });
      const bytes = new Uint8Array(encodeInputPacket({
        sequence: tick - 1,
        clientTick: tick,
        samples: history.slice(-3).reverse(),
      }));
      authoredPackets.push(bytes);
      pending.push(connection.sendRealtimeOwned(bytes));
    }
    assert.deepEqual(
      authoredPackets.map((bytes) => decodeInputPacket(bytes).samples.some((sample) => sample.attack)),
      [true, true, true, false, false],
      "the actual v1 codec must retain only the three newest sample ticks",
    );

    // No datagram can be written until the actual adapter's writer.ready
    // resolves. A latest-wins replacement is therefore observable exactly,
    // without a fake World HIT or a forged server ACK.
    releaseDatagramReady();
    await Promise.all(pending);
    assert.equal(writes.length, 1, "one stalled slot is expected under the original adapter");
    const serverVisible = writes.flatMap((bytes) => decodeInputPacket(bytes).samples);
    assert.ok(
      serverVisible.some((sample) => sample.tick === 1 && sample.attack),
      "P0 FAIL-FIRST: legitimate attack tick1 was silently evicted by later neutral movement while QUIC writer was stalled",
    );
  } finally {
    releaseDatagramReady?.();
    connection?.close();
    if (original === undefined) delete globalThis.WebTransport;
    else globalThis.WebTransport = original;
  }
});

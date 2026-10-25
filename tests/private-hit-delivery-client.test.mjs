import assert from "node:assert/strict";
import { test } from "node:test";
import { createPrivateHitDeliveryLab } from "../web/private-hit-delivery-lab.mjs";
import { encodeHitReceipt } from "../src/network/m147-hit-receipt-codec.mjs";
import { encodeProposedHitControl, decodeProposedHitControl, HIT_CONTROL_OP as OP } from "../src/network/m147-hit-control-proposal.mjs";

const token = Uint8Array.from({ length: 16 }, (_, i) => 101 + i);
const grant = () => encodeProposedHitControl({ op: OP.SERVER_GRANT, token, aux: 64 });
const hit = (sequence, attacker = 2, target = 1) => encodeHitReceipt({ sequence,
  serverTick: 700 + sequence, attacker, target, damage: 34, targetHp: 66 });
const settle = () => new Promise(resolve => setImmediate(resolve));
function fixture(options = {}) {
  const writes = [], scheduled = new Map();
  let nextTimer = 0;
  const transport = { kind: "webtransport", closed: false,
    experimentalGestureState: "granted", webTransportUrl: "https://127.0.0.1:4433/game",
    async sendReliable(bytes) { writes.push(decodeProposedHitControl(bytes)); },
    close() { this.closed = true; },
  };
  const lab = createPrivateHitDeliveryLab({ transport, pageUrl: "http://localhost:8000", actorId: 2,
    timers: {
      setTimeout(fn, ms) { const id = ++nextTimer; scheduled.set(id, { fn, ms }); return id; },
      clearTimeout(id) { scheduled.delete(id); },
    }, ...options });
  async function start() {
    const ready = lab.start();
    lab.receive(grant(), transport);
    await ready;
    await settle();
  }
  function fire(ms) {
    for (const [id, timer] of scheduled) if (timer.ms === ms) {
      scheduled.delete(id); timer.fn();
    }
  }
  return { lab, transport, writes, start, fire, scheduled };
}

test("private receipt client rejects public/off/ungranted transports before any HELLO", () => {
  for (const change of [ { kind: "websocket" }, { closed: true },
    { experimentalGestureState: "off" }, { webTransportUrl: "https://game.example/game" } ]) {
    let writes = 0;
    assert.throws(() => createPrivateHitDeliveryLab({ actorId: 2, pageUrl: "http://localhost",
      transport: { kind: "webtransport", closed: false, experimentalGestureState: "granted",
        webTransportUrl: "https://127.0.0.1/game", sendReliable() { writes++; }, ...change },
    }), /loopback|grant/);
    assert.equal(writes, 0);
  }
  assert.throws(() => fixture({ pageUrl: "https://public.example" }), /loopback/);
});

test("actual scoped receipt is presented before cumulative ACK; snapshot is detached and token-free", async () => {
  let f;
  const seen = [];
  f = fixture({ onReceipt(receipt, presentation) {
    assert.deepEqual(f.writes.map(x => x.op), [OP.CLIENT_HELLO]);
    assert.equal(Object.isFrozen(receipt), true);
    assert.equal(presentation.text, "Opponent hit - 34 HP.");
    seen.push(receipt);
  } });
  await f.start();
  assert.equal(f.writes[0].cursor, 0);
  assert.ok(f.writes[0].token.every(x => x === 0));
  f.lab.receive(hit(0), f.transport);
  await settle();
  assert.equal(seen.length, 1);
  assert.equal(f.writes.at(-1).op, OP.CLIENT_ACK);
  assert.equal(f.writes.at(-1).cursor, 1);
  const proof = f.lab.snapshot;
  assert.equal(proof.delivered[0].serverTick, 700);
  assert.equal(proof.expected, 1);
  assert.equal(Object.isFrozen(proof.delivered), true);
  assert.equal(JSON.stringify(proof).includes('"token"'), false);
  assert.equal(f.lab.receive(Uint8Array.from([1, 2, 0, 0]), f.transport), false);
  f.lab.close();
});

test("missing receipts recover contiguously without buffering or duplicate presentation", async () => {
  const f = fixture();
  await f.start();
  f.lab.receive(hit(2), f.transport);
  await settle();
  assert.equal(f.writes.at(-1).op, OP.CLIENT_NACK);
  assert.equal(f.writes.at(-1).cursor, 0);
  for (const sequence of [0, 1, 2]) {
    f.lab.receive(hit(sequence), f.transport);
    await settle();
  }
  assert.deepEqual(f.lab.snapshot.delivered.map(x => x.sequence), [0, 1, 2]);
  assert.deepEqual(f.writes.slice(1).map(x => [x.op, x.cursor]),
    [[OP.CLIENT_NACK, 0], [OP.CLIENT_NACK, 1], [OP.CLIENT_NACK, 2], [OP.CLIENT_ACK, 3]]);
  f.lab.receive(hit(2), f.transport);
  await settle();
  assert.equal(f.lab.snapshot.delivered.length, 3);
  assert.equal(f.writes.at(-1).cursor, 3);
  f.lab.close();
});

test("foreign connection, unsolicited grant and unowned spectator receipt fail without ACK", async () => {
  const foreign = fixture();
  const ready = foreign.lab.start();
  foreign.lab.receive(grant(), {});
  await assert.rejects(ready, /foreign/);
  assert.equal(foreign.transport.closed, true);
  const spectator = fixture();
  await spectator.start();
  spectator.lab.receive(hit(0, 3, 4), spectator.transport);
  await settle();
  assert.equal(spectator.transport.closed, true);
  assert.deepEqual(spectator.writes.map(x => x.op), [OP.CLIENT_HELLO]);
  assert.equal(spectator.lab.snapshot.delivered.length, 0);
});

test("failed or asynchronous presentation never acknowledges damage", async () => {
  for (const onReceipt of [() => { throw new Error("UI rejected"); }, () => Promise.resolve()]) {
    const f = fixture({ onReceipt });
    await f.start();
    f.lab.receive(hit(0), f.transport);
    await settle();
    assert.equal(f.transport.closed, true);
    assert.deepEqual(f.writes.map(x => x.op), [OP.CLIENT_HELLO]);
    assert.equal(f.lab.snapshot.expected, 0);
  }
});

test("blocked control output has one coalesced cursor and cannot continue after 1500ms retirement", async () => {
  const f = fixture();
  await f.start();
  let unblock;
  f.transport.sendReliable = () => new Promise(resolve => { unblock = resolve; });
  for (let i = 0; i < 20; i++) f.lab.receive(hit(i), f.transport);
  assert.equal(f.lab.snapshot.expected, 20);
  assert.equal(f.scheduled.size, 1);
  f.fire(1500);
  assert.equal(f.transport.closed, true);
  unblock();
  await settle();
  assert.equal(f.lab.snapshot.closed, true);
  assert.deepEqual(f.writes.map(x => x.op), [OP.CLIENT_HELLO]);
  assert.equal(f.scheduled.size, 0);
});

test("missing grant and server GAP retire the current lease with no replacement inference", async () => {
  const f = fixture();
  const ready = f.lab.start();
  f.fire(3000);
  await assert.rejects(ready, /timed out/);
  assert.equal(f.transport.closed, true);
  const gap = fixture();
  await gap.start();
  gap.lab.receive(encodeProposedHitControl({ op: OP.SERVER_GAP, token, cursor: 0, aux: 3 }), gap.transport);
  assert.equal(gap.transport.closed, true);
  assert.equal(gap.lab.snapshot.status, "retired");
});

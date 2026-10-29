import assert from "node:assert/strict";
import { test } from "node:test";
import { openLocalChatUiBridge } from "../src/network/local-chat-ui-bridge.mjs";

function fixture() {
  let onReceived, onResult, end, fail;
  const calls = [];
  const reading = new Promise((resolve, reject) => { end = resolve; fail = reject; });
  const wire = {
    closed: false, calls, reading,
    async send(packet) { calls.push(packet); },
    async close() { wire.closed = true; end(); },
    result(correlation, code = 0, messageId = 3n) {
      onResult({kind: "result", correlation, code, messageId});
    },
    receive(senderId = 2, messageId = 4n, text = "hello") {
      onReceived({kind: "received", channel: 1, senderId, messageId, text});
    },
    disconnect() { end(); },
    crash() { fail(new Error("network lost")); },
  };
  return {wire, openChannel: async (_, callbacks) => {
    onReceived = callbacks.onReceived;
    onResult = callbacks.onResult;
    return wire;
  }};
}
const flush = () => new Promise(resolve => setImmediate(resolve));

test("real server result is required for UI accepted state; trusted sender ID drives label", async () => {
  const f = fixture();
  const ui = await openLocalChatUiBridge({}, {openChannel: f.openChannel});
  assert.equal(ui.ready, true);
  const seen = [];
  const unsubscribe = ui.subscribe(message => seen.push(message));
  const ack = ui.send({channel: "local", clientMessageId: "uuid-a", text: "Привет 🌕"});
  await flush();
  assert.deepEqual(f.wire.calls, [{correlation: 1, channel: 1, text: "Привет 🌕"}]);
  f.wire.receive(42, 18n, "<img onerror=alert(1)>");
  assert.equal(seen[0].sender.displayName, "Player #42");
  assert.equal(seen[0].sender.netId, 42,
    "overhead target must originate in the authenticated binary senderId, never in a display name");
  assert.equal(seen[0].channel, "local");
  assert.equal(seen[0].text, "<img onerror=alert(1)>");
  assert.equal(seen[0].serverMessageId.endsWith("-18"), true);
  f.wire.result(1, 0, 18n);
  assert.deepEqual(await ack, {ok: true, clientMessageId: "uuid-a"});
  unsubscribe();
  f.wire.receive(42, 19n, "hidden");
  assert.equal(seen.length, 1);
  await ui.close();
  assert.equal(ui.ready, false);
});

test("Core UTF-8 limit and bidi restrictions remain enforced; duplicate IDs fail", async () => {
  const f = fixture();
  const ui = await openLocalChatUiBridge({}, {openChannel: f.openChannel});
  await assert.rejects(ui.send({channel: "global", clientMessageId: "1", text: "hello"}));
  await assert.rejects(ui.send({channel: "local", clientMessageId: "1", text: "x".repeat(241)}));
  await assert.rejects(ui.send({channel: "local", clientMessageId: "1", text: String.fromCharCode(0x202e)+"spoof"}));
  const first = ui.send({channel: "local", clientMessageId: "1", text: "okay"});
  await assert.rejects(ui.send({channel: "local", clientMessageId: "2", text: "busy"}));
  await flush();
  assert.equal(f.wire.calls[0].correlation, 1);
  f.wire.result(1, 5, 0n);
  await assert.rejects(first, /not accepted/);
  await assert.rejects(ui.send({channel: "local", clientMessageId: "1", text: "replay"}));
  const second = ui.send({channel: "local", clientMessageId: "2", text: "again"});
  await flush();
  f.wire.result(2, 0, 0n);
  await assert.rejects(second, /not accepted/);
  await ui.close();
});

test("reconnect cancels old-session ACK and inbound callbacks; new IDs are session scoped", async () => {
  const old = fixture(), inbound = [];
  let disconnected = 0;
  const ui = await openLocalChatUiBridge({}, {
    openChannel: old.openChannel, onDisconnect: () => disconnected++,
  });
  ui.subscribe(event => inbound.push(event));
  const oldAck = ui.send({channel: "local", clientMessageId: "old-uuid", text: "pending"});
  await flush();
  old.wire.disconnect();
  await assert.rejects(oldAck, /ended/);
  assert.equal(ui.ready, false);
  assert.equal(disconnected, 1);
  old.wire.result(1, 0, 777n);
  old.wire.receive(1, 777n, "stale");
  assert.equal(inbound.length, 0);
  const newer = fixture();
  const next = await openLocalChatUiBridge({}, {openChannel: newer.openChannel});
  const fresh = [];
  next.subscribe(event => fresh.push(event));
  newer.wire.receive(1, 777n, "new session");
  assert.equal(fresh.length, 1);
  const ack = next.send({channel: "local", clientMessageId: "old-uuid", text: "new session"});
  await flush();
  newer.wire.result(1, 0, 1n);
  assert.equal((await ack).ok, true);
  await next.close();
});

test("reader failure and faulty UI callback cannot forge delivery or break subscribers", async () => {
  const f = fixture(), ui = await openLocalChatUiBridge({}, {openChannel: f.openChannel});
  let count = 0;
  ui.subscribe(() => {throw new Error("view failed");});
  ui.subscribe(() => count++);
  f.wire.receive();
  assert.equal(count, 1);
  const inFlight = ui.send({channel: "local", clientMessageId: "pending", text: "hi"});
  await flush();
  f.wire.crash();
  await assert.rejects(inFlight, /failed/);
  assert.equal(ui.ready, false);
  f.wire.result(1, 0, 10n);
  assert.equal(count, 1);
});

test("closing in the same turn suppresses an unsent old-session message", async () => {
  const f = fixture();
  const ui = await openLocalChatUiBridge({}, { openChannel: f.openChannel });
  const unsent = ui.send({ channel: "local", clientMessageId: "cancelled-uuid", text: "do not send" });
  // The transport dispatch is intentionally queued on a microtask; a
  // disconnect before that dispatch must cancel both the ACK and the write.
  const rejected = assert.rejects(unsent, /closed/);
  await ui.close();
  await rejected;
  await flush();
  assert.equal(f.wire.calls.length, 0, "retired session cannot send queued chat");
  assert.equal(ui.ready, false);
});

test("missing server ACK retires only chat after bounded deadline", async () => {
  const f = fixture();
  const reasons = [];
  const ui = await openLocalChatUiBridge({}, {
    openChannel: f.openChannel, ackTimeoutMs: 20,
    onDisconnect: error => reasons.push(error.message),
  });
  const pending = ui.send({ channel: "local", clientMessageId: "unacked", text: "hello" });
  await assert.rejects(pending, /No authoritative chat acknowledgement/);
  await flush();
  assert.equal(f.wire.calls.length, 1, "one bounded chat send was attempted");
  assert.equal(f.wire.closed, true, "only optional chat stream must be closed");
  assert.equal(ui.ready, false);
  assert.deepEqual(reasons, ["No authoritative chat acknowledgement"]);
  await assert.rejects(ui.send({
    channel: "local", clientMessageId: "second", text: "retry",
  }), /session unavailable/i);
  f.wire.result(1, 0, 9n);
  assert.equal(reasons.length, 1, "late ACK must not resurrect a retired session");
});

test("failed optional chat write retires adapter rather than stacking blocked sends", async () => {
  const f = fixture();
  f.wire.send = async () => { throw new Error("optional QUIC stream write failed"); };
  const ui = await openLocalChatUiBridge({}, {openChannel: f.openChannel});
  await assert.rejects(ui.send({
    channel: "local", clientMessageId: "write-failure", text: "hello",
  }), /optional QUIC stream write failed/);
  await flush();
  assert.equal(f.wire.closed, true);
  assert.equal(ui.ready, false);
  await assert.rejects(ui.send({
    channel: "local", clientMessageId: "again", text: "more",
  }), /session unavailable/i);
});

test("invalid ACK deadlines cannot open an optional chat stream", async () => {
  let opened = 0;
  const openChannel = () => { opened++; throw new Error("must not open"); };
  for (const ackTimeoutMs of [0, -1, 9001, 1.2, NaN, "10"]) {
    await assert.rejects(
      openLocalChatUiBridge({}, {openChannel, ackTimeoutMs}), RangeError,
    );
  }
  assert.equal(opened, 0);
});

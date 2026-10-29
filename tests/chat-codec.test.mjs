import assert from "node:assert/strict";
import test from "node:test";
import {
  CHAT, CHAT_RESULT_CODE, encodeChatSend, decodeChatServerFrame, openLocalChat,
} from "../src/network/chat-codec.mjs";

function makeReceived({ sender = 4, messageId = 9n, tick = 123, text = "Hi 🌕" } = {}) {
  const bytes = new TextEncoder().encode(text);
  const packet = new Uint8Array(21 + bytes.length);
  packet.set([CHAT.received, CHAT.version, CHAT.channelLocal]);
  const dv = new DataView(packet.buffer);
  dv.setBigUint64(3, messageId, true);
  dv.setUint32(11, sender, true);
  dv.setUint32(15, tick, true);
  dv.setUint16(19, bytes.length, true);
  packet.set(bytes, 21);
  return packet;
}
function makeResult() {
  const packet = new Uint8Array(15);
  packet.set([CHAT.result, CHAT.version]);
  const view = new DataView(packet.buffer);
  view.setUint32(2, 77, true);
  packet[6] = CHAT_RESULT_CODE.ACCEPTED;
  view.setBigUint64(7, 99n, true);
  return packet;
}
function frame(payload) {
  const result = new Uint8Array(2 + payload.length);
  new DataView(result.buffer).setUint16(0, payload.length, true);
  result.set(payload, 2);
  return result;
}

test("chat sends contain only version, channel, correlation and bounded text", () => {
  const request = encodeChatSend({ correlation: 91, text: "Greetings 🌕" });
  const dv = new DataView(request.buffer);
  assert.deepEqual([...request.slice(0, 3)], [0x31, 1, 1]);
  assert.equal(dv.getUint32(3, true), 91);
  assert.equal(dv.getUint16(7, true), new TextEncoder().encode("Greetings 🌕").length);
  assert.equal(new TextDecoder().decode(request.subarray(9)), "Greetings 🌕");
  assert.equal(Object.keys(CHAT).includes("sender"), false);
});
test("strict validation rejects unsupported channels, controls, byte overflow and lone surrogates", () => {
  for (const text of ["", "  ", "hello\nbye", "\u202e", "\ud800", "🍀".repeat(61)]) {
    assert.throws(() => encodeChatSend({ correlation: 1, text }), RangeError, text);
  }
  assert.throws(() => encodeChatSend({ correlation: 0, text: "Hi" }), RangeError);
  assert.throws(() => encodeChatSend({ correlation: 1, channel: 7, text: "Hi" }), RangeError);
  assert.doesNotThrow(() => encodeChatSend({ correlation: 1, text: "🍀".repeat(60) }));
});
test("server result and received frames preserve sender, UTF-8 and message correlation", () => {
  assert.deepEqual(decodeChatServerFrame(makeResult()), {
    kind: "result", correlation: 77, code: CHAT_RESULT_CODE.ACCEPTED, messageId: 99n,
  });
  assert.deepEqual(decodeChatServerFrame(makeReceived()), {
    kind: "received", channel: CHAT.channelLocal, messageId: 9n,
    senderId: 4, serverTick: 123, text: "Hi 🌕",
  });
});
test("malformed server frames cannot reach UI callbacks", () => {
  const corrupted = makeReceived();
  corrupted[19] += 1;
  assert.throws(() => decodeChatServerFrame(corrupted), RangeError);
  const wrongVersion = makeResult();
  wrongVersion[1] = 9;
  assert.throws(() => decodeChatServerFrame(wrongVersion), RangeError);
  assert.throws(() => decodeChatServerFrame(new Uint8Array([0, 1])), RangeError);
  assert.throws(() => decodeChatServerFrame(new Uint8Array([CHAT.result,1,0,0,0,0,255,...Array(8).fill(0)])), RangeError);
});
test("optional WebTransport channel handles fragmented network frames separately from combat", async () => {
  const writes = [];
  let controller;
  const reply = new ReadableStream({
    start(value) { controller = value; },
  });
  const transport = {
    async createUnidirectionalStream() {
      return new WritableStream({ write(value) { writes.push(value); } });
    },
    incomingUnidirectionalStreams: new ReadableStream({
      start(value) { value.enqueue(reply); value.close(); },
    }),
  };
  const received = [], results = [];
  const channel = await openLocalChat({ kind: "webtransport", transport }, {
    onReceived: (event) => received.push(event),
    onResult: (event) => results.push(event),
  });
  await channel.send({ correlation: 5, text: "hi" });
  assert.equal(writes.length, 2);
  assert.deepEqual([...writes[0]], [2, 0, CHAT.hello, CHAT.version]);
  assert.equal(new DataView(writes[1].buffer).getUint16(0, true), 11);
  const output = frame(makeReceived({ text: "hello" }));
  controller.enqueue(output.slice(0, 3));
  controller.enqueue(output.slice(3));
  controller.enqueue(frame(makeResult()));
  controller.close();
  await channel.reading;
  assert.equal(received.length, 1);
  assert.equal(received[0].text, "hello");
  assert.equal(results.length, 1);
  assert.equal(results[0].correlation, 77);
  assert.equal(channel.closed, true);
});

test("optional chat timeout preserves shared QUIC incoming stream collection", async () => {
  let aborted = 0, collectionCancelled = 0, gameplayClosed = 0;
  const outbound = new WritableStream({ abort() { aborted += 1; } });
  const incomingUnidirectionalStreams = new ReadableStream({
    start() { /* Peer never opens chat reply stream. */ },
    cancel() { collectionCancelled++; },
  });
  const transport = {
    async createUnidirectionalStream() { return outbound; },
    incomingUnidirectionalStreams,
    close() { gameplayClosed++; },
  };
  await assert.rejects(
    openLocalChat({ kind: "webtransport", transport }, { handshakeTimeoutMs: 20 }),
    /chat reply stream timed out/,
  );
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(aborted, 1, "only optional outbound chat stream is aborted");
  assert.equal(outbound.locked, false, "writer lock is released");
  assert.equal(incomingUnidirectionalStreams.locked, false, "timed-out chat reader releases lock");
  assert.equal(collectionCancelled, 0, "never cancel shared future QUIC incoming streams");
  assert.equal(gameplayClosed, 0, "gameplay WebTransport stays open");
  // Verify the stream collection remains usable by another independent
  // protocol consumer after chat has failed.
  const another = incomingUnidirectionalStreams.getReader();
  assert.equal(incomingUnidirectionalStreams.locked, true);
  another.releaseLock();
});

test("late outgoing stream is aborted after bounded startup failure", async () => {
  let allowOpen, aborted = false;
  const pending = new Promise(resolve => { allowOpen = resolve; });
  const transport = {
    createUnidirectionalStream() { return pending; },
    incomingUnidirectionalStreams: new ReadableStream({ start() {} }),
  };
  await assert.rejects(
    openLocalChat({ kind: "webtransport", transport }, { handshakeTimeoutMs: 20 }),
    /chat outgoing stream timed out/,
  );
  allowOpen(new WritableStream({ abort() { aborted = true; } }));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(aborted, true, "late optional stream must not be leaked");
});

test("invalid chat handshake deadlines fail before starting any network stream", async () => {
  let attempted = 0;
  const transport = {
    async createUnidirectionalStream() { attempted++; return new WritableStream(); },
  };
  for (const handshakeTimeoutMs of [-1, 0, 30_001, NaN, 2.5, "20"]) {
    await assert.rejects(
      openLocalChat({ kind: "webtransport", transport }, { handshakeTimeoutMs }),
      RangeError,
    );
  }
  assert.equal(attempted, 0);
});

test("closing idle chat releases both optional streams without closing gameplay", async () => {
  let readCancelled = 0, writeAborted = 0, gameplayClosed = 0;
  const reply = new ReadableStream({
    start() { /* Deliberately open forever until optional chat closes. */ },
    cancel() { readCancelled++; },
  });
  const outgoing = new WritableStream({ abort() { writeAborted++; } });
  const transport = {
    createUnidirectionalStream: async () => outgoing,
    incomingUnidirectionalStreams: new ReadableStream({
      start(controller) { controller.enqueue(reply); controller.close(); },
    }),
    close() { gameplayClosed++; },
  };
  const chat = await openLocalChat({ kind: "webtransport", transport });
  await chat.close();
  await chat.reading;
  await chat.close(); // Idempotent: no second QUIC reset.
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(chat.closed, true);
  assert.equal(readCancelled, 1);
  assert.equal(writeAborted, 1);
  assert.equal(outgoing.locked, false);
  assert.equal(reply.locked, false);
  assert.equal(gameplayClosed, 0, "gameplay transport must stay open");
});

test("malformed incoming chat frame closes optional writer, not gameplay transport", async () => {
  let replyController, writeAborted = 0, gameplayClosed = 0;
  const reply = new ReadableStream({
    start(controller) { replyController = controller; },
  });
  const outgoing = new WritableStream({ abort() { writeAborted++; } });
  const transport = {
    createUnidirectionalStream: async () => outgoing,
    incomingUnidirectionalStreams: new ReadableStream({
      start(controller) { controller.enqueue(reply); controller.close(); },
    }),
    close() { gameplayClosed++; },
  };
  const chat = await openLocalChat({ kind: "webtransport", transport });
  replyController.enqueue(new Uint8Array([2, 0, 1, 1]));
  await assert.rejects(chat.reading, /chat frame length invalid/);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(chat.closed, true);
  assert.equal(writeAborted, 1);
  assert.equal(outgoing.locked, false);
  assert.equal(reply.locked, false);
  assert.equal(gameplayClosed, 0);
});

test("coalesced valid chat frames over 4096 bytes decode with one bounded frame buffer", async () => {
  const text = "🌕".repeat(60); // 240 UTF-8 bytes, largest valid local chat payload
  const packets = Array.from({ length: 32 }, (_, i) => frame(makeReceived({
    sender: i + 1, messageId: BigInt(i + 1), text,
  })));
  const bytes = new Uint8Array(packets.reduce((sum, packet) => sum + packet.length, 0));
  let pos = 0;
  for (const packet of packets) {
    bytes.set(packet, pos);
    pos += packet.length;
  }
  assert.ok(bytes.length > 4096, "the combined transport chunk exceeds old buffer limit");
  let gameplayClosed = 0;
  const reply = new ReadableStream({
    start(controller) { controller.enqueue(bytes); controller.close(); },
  });
  const transport = {
    createUnidirectionalStream: async () => new WritableStream(),
    incomingUnidirectionalStreams: new ReadableStream({
      start(controller) { controller.enqueue(reply); controller.close(); },
    }),
    close() { gameplayClosed++; },
  };
  const events = [];
  const chat = await openLocalChat({ kind: "webtransport", transport }, {
    onReceived(event) { events.push(event); },
  });
  await chat.reading;
  assert.equal(events.length, 32);
  for (let i = 0; i < events.length; i++) {
    assert.equal(events[i].messageId, BigInt(i + 1));
    assert.equal(events[i].senderId, i + 1);
    assert.equal(events[i].text, text);
  }
  assert.equal(chat.closed, true);
  assert.equal(gameplayClosed, 0, "only optional chat stream may close");
});

test("fragmented and coalesced chat frames still reject invalid length prefixes", async () => {
  const reply = new ReadableStream({
    start(controller) {
      controller.enqueue(frame(makeResult()).slice(0, 1));
      const goodTail = frame(makeResult()).slice(1);
      const batch = new Uint8Array(goodTail.length + 2);
      batch.set(goodTail, 0);
      batch.set([0xff, 0xff], goodTail.length);
      controller.enqueue(batch);
      controller.close();
    },
  });
  const transport = {
    createUnidirectionalStream: async () => new WritableStream(),
    incomingUnidirectionalStreams: new ReadableStream({
      start(controller) { controller.enqueue(reply); controller.close(); },
    }),
  };
  const results = [];
  const chat = await openLocalChat({ kind: "webtransport", transport }, {
    onResult(event) { results.push(event); },
  });
  await assert.rejects(chat.reading, /chat frame length invalid/);
  assert.equal(results.length, 1, "valid first frame remains delivered");
  assert.equal(results[0].correlation, 77);
  assert.equal(chat.closed, true);
});

test("server EOF inside a chat frame rejects only the optional channel", async () => {
  const valid = frame(makeReceived({ text: "full payload" }));
  for (const prefixBytes of [1, 2, 7, valid.length - 1]) {
    let gameplayClosed = 0;
    const reply = new ReadableStream({
      start(controller) {
        controller.enqueue(valid.subarray(0, prefixBytes));
        controller.close();
      },
    });
    const transport = {
      createUnidirectionalStream: async () => new WritableStream(),
      incomingUnidirectionalStreams: new ReadableStream({
        start(controller) { controller.enqueue(reply); controller.close(); },
      }),
      close() { gameplayClosed++; },
    };
    const events = [];
    const chat = await openLocalChat({ kind: "webtransport", transport }, {
      onReceived(event) { events.push(event); },
    });
    await assert.rejects(chat.reading, /truncated chat frame at stream end/);
    assert.equal(chat.closed, true);
    assert.equal(events.length, 0, "a truncated frame cannot be shown as a delivered message");
    assert.equal(gameplayClosed, 0, "chat errors must not close the game transport");
  }
});

test("closing chat during one coalesced chunk suppresses subsequent callbacks", async () => {
  let controller, gameplayClosed = 0;
  const reply = new ReadableStream({ start(c) { controller = c; } });
  const transport = {
    createUnidirectionalStream: async () => new WritableStream(),
    incomingUnidirectionalStreams: new ReadableStream({
      start(c) { c.enqueue(reply); c.close(); },
    }),
    close() { gameplayClosed++; },
  };
  let chat;
  const events = [];
  chat = await openLocalChat({ kind: "webtransport", transport }, {
    onReceived(event) {
      events.push(event);
      void chat.close();
    },
  });
  const first = frame(makeReceived({ messageId: 101n }));
  const second = frame(makeReceived({ messageId: 102n }));
  const chunk = new Uint8Array(first.length + second.length);
  chunk.set(first, 0);
  chunk.set(second, first.length);
  controller.enqueue(chunk);
  await chat.reading;
  assert.equal(events.length, 1, "a closed chat channel cannot emit queued follow-up events");
  assert.equal(events[0].messageId, 101n);
  assert.equal(chat.closed, true);
  assert.equal(gameplayClosed, 0);
});

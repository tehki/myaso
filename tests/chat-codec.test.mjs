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
  assert.equal(writes.length, 1);
  assert.equal(new DataView(writes[0].buffer).getUint16(0, true), 11);
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

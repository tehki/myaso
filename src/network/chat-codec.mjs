// Chat C1 reliable WebTransport protocol. Owned by Core & Multiplayer.
// UI department owns rendering/composer; this is a transport-only contract.
export const CHAT = Object.freeze({
  version: 1,
  channelLocal: 1,
  send: 0x31,
  received: 0x32,
  result: 0x33,
  maxTextBytes: 240,
  maxFrameBytes: 261,
});
export const CHAT_RESULT_CODE = Object.freeze({
  ACCEPTED: 0,
  NOT_CONNECTED: 1,
  UNAUTHORIZED: 2,
  INVALID: 3,
  TOO_LONG: 4,
  RATE_LIMITED: 5,
  CHANNEL_UNAVAILABLE: 6,
  UNAVAILABLE: 7,
  DUPLICATE: 8,
});
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
const badControls = /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u;
const badSurrogates = /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/u;

function checkedBytes(value) {
  if (!(value instanceof Uint8Array)) throw new TypeError("chat packet requires Uint8Array");
  return value;
}

export function encodeChatSend({ correlation, text, channel = CHAT.channelLocal }) {
  if (!Number.isInteger(correlation) || correlation <= 0 || correlation > 0xffffffff) {
    throw new RangeError("chat correlation must be a nonzero uint32");
  }
  if (channel !== CHAT.channelLocal) throw new RangeError("unsupported chat channel");
  if (typeof text !== "string" || !text.trim() || badControls.test(text) || badSurrogates.test(text)) {
    throw new RangeError("chat text contains invalid characters");
  }
  const bytes = encoder.encode(text);
  if (bytes.length > CHAT.maxTextBytes) throw new RangeError("chat message exceeds UTF-8 byte limit");
  const output = new Uint8Array(9 + bytes.length);
  const data = new DataView(output.buffer);
  output.set([CHAT.send, CHAT.version, channel]);
  data.setUint32(3, correlation, true);
  data.setUint16(7, bytes.length, true);
  output.set(bytes, 9);
  return output;
}

export function decodeChatServerFrame(raw) {
  const frame = checkedBytes(raw);
  if (frame.length < 2 || frame[1] !== CHAT.version) throw new RangeError("unsupported chat frame");
  const view = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);
  if (frame[0] === CHAT.result && frame.length === 15) {
    const code = frame[6];
    if (code > CHAT_RESULT_CODE.DUPLICATE) throw new RangeError("unknown chat result code");
    return Object.freeze({
      kind: "result", correlation: view.getUint32(2, true), code,
      messageId: view.getBigUint64(7, true),
    });
  }
  if (frame[0] === CHAT.received && frame.length >= 21 && frame[2] === CHAT.channelLocal) {
    const textLength = view.getUint16(19, true);
    if (textLength < 1 || textLength > CHAT.maxTextBytes || frame.length !== 21 + textLength) {
      throw new RangeError("malformed chat text length");
    }
    const text = decoder.decode(frame.subarray(21));
    if (!text.trim() || badControls.test(text)) throw new RangeError("invalid received chat text");
    return Object.freeze({
      kind: "received", channel: CHAT.channelLocal,
      messageId: view.getBigUint64(3, true),
      senderId: view.getUint32(11, true),
      serverTick: view.getUint32(15, true), text,
    });
  }
  throw new RangeError("unknown or malformed chat frame");
}

function frameReliable(payload) {
  if (payload.length > CHAT.maxFrameBytes) throw new RangeError("oversize chat frame");
  const frame = new Uint8Array(2 + payload.length);
  new DataView(frame.buffer).setUint16(0, payload.length, true);
  frame.set(payload, 2);
  return frame;
}


// A chat stream is optional. A missing peer reply must not leave the UI
// pending forever or hold the shared session's incoming-stream reader.
// A late outgoing stream is aborted without closing the gameplay transport.
async function boundedChatHandshake(promise, timeoutMs, phase, { onTimeout, onLate } = {}) {
  let expired = false;
  let timer;
  const operation = Promise.resolve(promise);
  if (onLate) {
    operation.then(value => {
      if (expired) {
        try { Promise.resolve(onLate(value)).catch(() => {}); } catch { /* cleanup only */ }
      }
    }, () => {});
  }
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      expired = true;
      // Reject the timeout before cancelling the pending read, otherwise a
      // synchronous cancel may win Promise.race with a misleading EOF result.
      reject(new Error("local chat " + phase + " timed out"));
      try { onTimeout?.(); } catch { /* timeout remains authoritative */ }
    }, timeoutMs);
  });
  try { return await Promise.race([operation, timeout]); }
  finally { clearTimeout(timer); }
}

/**
 * Opt-in separate WebTransport streams attached to an already connected game
 * session. No separate WebSocket/account/channel service is started.
 *
 * An older client does not call this function and remains wire-compatible.
 * Its authoritatively assigned player ID comes from the existing game session;
 * sender IDs or coordinate claims never appear in ChatSend.
 */
export async function openLocalChat(gameConnection, {
  onReceived, onResult, handshakeTimeoutMs = 10_000,
} = {}) {
  if (gameConnection?.kind !== "webtransport" || !gameConnection.transport) {
    throw new Error("local chat requires active WebTransport game connection");
  }
  if (!Number.isInteger(handshakeTimeoutMs) || handshakeTimeoutMs < 1 || handshakeTimeoutMs > 30_000) {
    throw new RangeError("invalid local chat handshake deadline");
  }
  const transport = gameConnection.transport;
  let writer;
  let reader;
  try {
    const outgoing = await boundedChatHandshake(
      transport.createUnidirectionalStream(), handshakeTimeoutMs, "outgoing stream",
      { onLate: stream => stream?.abort?.(new Error("late local chat stream")) },
    );
    writer = outgoing.getWriter();
    const incoming = transport.incomingUnidirectionalStreams.getReader();
    const pendingRead = incoming.read();
    // The read may complete only *after* timeout cancellation. Release its
    // lock in both cases, without waiting forever for a failed handshake.
    pendingRead.then(
      () => { try { incoming.releaseLock(); } catch { /* best effort */ } },
      () => { try { incoming.releaseLock(); } catch { /* best effort */ } },
    );
    const channel = await boundedChatHandshake(
      pendingRead, handshakeTimeoutMs, "reply stream",
      { onTimeout: () => { void incoming.cancel("chat reply timeout").catch(() => {}); } },
    );
    if (channel.done || !channel.value) throw new Error("chat reply stream unavailable");
    reader = channel.value.getReader();
  } catch (error) {
    // Never close the shared WebTransport connection used by realtime combat.
    if (writer) {
      try { void writer.abort(error).catch(() => {}); } catch { /* best effort */ }
      try { writer.releaseLock(); } catch { /* best effort */ }
    }
    throw error;
  }
  let closed = false;
  let outgoingStopped = false;
  // Chat is optional, and its writer must never survive its receive loop.
  // Abort only this stream; the WebTransport connection carries live combat.
  function abortChatWriter() {
    if (outgoingStopped) return;
    outgoingStopped = true;
    try {
      Promise.resolve(writer.abort(new Error("local chat stream closed")))
        .catch(() => {})
        .finally(() => { try { writer.releaseLock(); } catch { /* already released */ } });
    } catch {
      try { writer.releaseLock(); } catch { /* already released */ }
    }
  }
  let pending = new Uint8Array(0);
  const reading = (async () => {
    try {
      while (!closed) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = checkedBytes(value);
        if (pending.length + chunk.length > 4096) throw new RangeError("chat receive buffer overflow");
        const next = new Uint8Array(pending.length + chunk.length);
        next.set(pending);
        next.set(chunk, pending.length);
        pending = next;
        while (pending.length >= 2) {
          const length = pending[0] | (pending[1] << 8);
          if (length < 9 || length > CHAT.maxFrameBytes) throw new RangeError("chat frame length invalid");
          if (pending.length < length + 2) break;
          const event = decodeChatServerFrame(pending.slice(2, length + 2));
          pending = pending.slice(length + 2);
          if (event.kind === "result") onResult?.(event);
          else onReceived?.(event);
        }
      }
    } finally {
      closed = true;
      abortChatWriter();
      reader.releaseLock();
    }
  })();
  return {
    async send({ correlation, text, channel = CHAT.channelLocal }) {
      if (closed) throw new Error("chat channel disconnected");
      const frame = frameReliable(encodeChatSend({ correlation, text, channel }));
      await writer.ready;
      if (closed) throw new Error("chat channel disconnected");
      await writer.write(frame);
    },
    async close() {
      // Do not await QUIC backpressure or a peer-held reader. Cancellation
      // wakes our pending reader.read() and the reading finally releases it.
      closed = true;
      try { Promise.resolve(reader.cancel("local chat closed")).catch(() => {}); }
      catch { /* cancellation failure must not affect gameplay */ }
      abortChatWriter();
    },
    get closed() { return closed; },
    reading,
  };
}

/**
 * Browser transport adapter.
 *
 * Realtime messages are deliberately lossy/latest-wins. WebTransport maps them
 * to QUIC datagrams; the WebSocket fallback still uses reliable frames, so the
 * caller must coalesce and discard stale snapshots instead of building a queue.
 * Reliable messages use a WebTransport bidirectional stream or WebSocket frames.
 *
 * sendRealtime() retains the historical copy-safe contract. sendRealtimeOwned()
 * transfers ownership of a fresh binary payload to the transport hot path and
 * avoids the extra browser-side copy for WebTransport datagrams.
 */
export async function connectGameTransport({
  webTransportUrl,
  webTransportOptions,
  webSocketUrl,
  onRealtime,
  onReliable,
}) {
  if (typeof WebTransport === "function" && webTransportUrl) {
    try {
      return await WebTransportGameConnection.connect({
        webTransportUrl,
        webTransportOptions,
        onRealtime,
        onReliable,
      });
    } catch (error) {
      if (!webSocketUrl) throw error;
      console.warn("WebTransport connection failed; falling back to WebSocket", error);
    }
  }
  if (!webSocketUrl) throw new Error("no supported game transport configured");
  return WebSocketGameConnection.connect({ webSocketUrl, onRealtime, onReliable });
}

class WebTransportGameConnection {
  constructor(transport, datagramWriter, reliableWriter) {
    this.kind = "webtransport";
    this.transport = transport;
    this.datagramWriter = datagramWriter;
    this.reliableWriter = reliableWriter;
    this.latestRealtime = null;
    this.realtimeFlush = null;
    this.closed = false;
    // Typed Combat edges are never fed to the latest-wins sampled input queue.
    this.experimentalGestureState = "off";
    this.gestureGrantWaiter = null;
    this.gestureWriteQueue = Promise.resolve();
    // This is a transport safety ceiling, not a Combat retry policy.
    // The one-lease outbox may independently bound or retry genuine edges.
    this.pendingGestureEdges = 0;
  }

  static async connect({ webTransportUrl, webTransportOptions, onRealtime, onReliable }) {
    const transport = new WebTransport(webTransportUrl, webTransportOptions);
    await transport.ready;
    const datagramWriter = transport.datagrams.writable.getWriter();
    const reliable = await transport.createBidirectionalStream();
    const reliableWriter = reliable.writable.getWriter();
    const connection = new WebTransportGameConnection(transport, datagramWriter, reliableWriter);
    connection.webTransportUrl = webTransportUrl;
    pumpReader(transport.datagrams.readable.getReader(), onRealtime);
    pumpLengthPrefixedReader(reliable.readable.getReader(), packet => {
      if (!connection.#handleGestureGrant(packet)) onReliable?.(packet);
    });
    return connection;
  }

  #handleGestureGrant(packet) {
    const bytes = toUint8Array(packet);
    if (bytes.length < 2 || bytes[0] !== 2 || bytes[1] !== 0x13) return false;
    const waiter = this.gestureGrantWaiter;
    if (this.experimentalGestureState !== "pending" || !waiter ||
        bytes.length !== 4 || bytes[2] !== 0 || bytes[3] !== 0) {
      waiter?.reject(new Error("unexpected or malformed experimental gesture grant"));
      this.gestureGrantWaiter = null;
      this.close("invalid experimental gesture grant");
      return true;
    }
    this.gestureGrantWaiter = null;
    this.experimentalGestureState = "granted";
    waiter.resolve(true);
    return true;
  }

  // Only a LOCAL loopback original-Rust flight may negotiate this experimental
  // server-issued capability. In particular this cannot activate public R2.
  // The existing WebTransport bidi stream and original server actor stay shared.
  async negotiateExperimentalGestureV2({ timeoutMs = 3000 } = {}) {
    if (this.closed || this.experimentalGestureState !== "off") {
      throw new Error("experimental gesture handshake requires a fresh connection");
    }
    const host = new URL(this.webTransportUrl).hostname;
    if (!["localhost", "127.0.0.1", "[::1]"].includes(host)) {
      throw new Error("experimental gesture grant is loopback-only");
    }
    if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 10000) {
      throw new RangeError("bounded handshake timeout required");
    }
    this.experimentalGestureState = "pending";
    let resolveGrant, rejectGrant;
    const acknowledged = new Promise((resolve, reject) => {
      resolveGrant = resolve; rejectGrant = reject;
    });
    // Prevent an unhandled rejected handshake if the QUIC uni write itself fails.
    void acknowledged.catch(() => {});
    this.gestureGrantWaiter = { resolve: resolveGrant, reject: rejectGrant };
    const timeout = setTimeout(() => {
      this.gestureGrantWaiter?.reject(new Error("original Rust v2 grant timed out"));
      this.gestureGrantWaiter = null;
    }, timeoutMs);
    try {
      const stream = await this.transport.createUnidirectionalStream();
      const writer = stream.getWriter();
      try {
        // Original server accepts exactly this 8-byte HELLO on the admitted
        // existing connection, then returns 02 13 00 00 on its bidi stream.
        await writer.write(Uint8Array.from([2, 0x10, 77, 89, 65, 83, 79, 49]));
        await writer.close();
      } finally { try { writer.releaseLock(); } catch {} }
      await acknowledged;
      return true;
    } catch (error) {
      this.close("experimental gesture grant not confirmed");
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  // Each accepted gesture edge is preserved as an individual datagram, never
  // overwritten by the movement sampler's latestRealtime slot. This is only
  // transport delivery, NOT an authoritative Combat hit or admission ACK.
  sendExperimentalGestureEdge(bytes) {
    if (this.closed || this.experimentalGestureState !== "granted") {
      throw new Error("gesture datagram requires current server grant");
    }
    const payload = toUint8Array(bytes);
    // Owner retired source1 Key E from Combat. Reject even handcrafted old
    // source1 bytes BEFORE they can occupy the one bounded QUIC writer queue.
    // Rust admission independently rejects them before World mutation.
    if (payload.length !== 16 || payload[0] !== 2 || payload[1] !== 0x11
        || payload[3] !== 0) {
      throw new TypeError("only source0 LMB typed 16-byte Combat events accepted");
    }
    // Never let a stalled datagram writer accumulate arbitrarily many
    // outstanding 16-byte gesture events/promises. Overflow is not an ACK,
    // not a skipped RELEASE, and must retire the whole same-QUIC lease.
    if (this.pendingGestureEdges >= 64) {
      this.close("experimental gesture queue overflow");
      throw new RangeError("bounded experimental gesture queue overflow");
    }
    const owned = payload.slice();
    this.pendingGestureEdges += 1;
    const send = this.gestureWriteQueue.then(async () => {
      if (this.closed || this.experimentalGestureState !== "granted") {
        throw new Error("old gesture edge cannot outlive its QUIC lease");
      }
      await this.datagramWriter.ready;
      if (this.closed) throw new Error("gesture lease ended before send");
      await this.datagramWriter.write(owned);
    });
    this.gestureWriteQueue = send.then(
      () => { this.pendingGestureEdges -= 1; },
      () => {
        this.pendingGestureEdges -= 1;
        this.close("gesture delivery failed");
      },
    );
    return send;
  }

  sendRealtime(bytes) {
    return this.#queueRealtime(bytes, true);
  }

  sendRealtimeOwned(bytes) {
    return this.#queueRealtime(bytes, false);
  }

  #queueRealtime(bytes, copy) {
    if (this.closed) return Promise.resolve();
    const payload = toUint8Array(bytes);
    this.latestRealtime = copy ? payload.slice() : payload;
    if (!this.realtimeFlush) {
      this.realtimeFlush = this.#flushRealtime()
        .catch((error) => {
          if (!this.closed) throw error;
        })
        .finally(() => { this.realtimeFlush = null; });
    }
    return this.realtimeFlush;
  }

  async #flushRealtime() {
    while (!this.closed && this.latestRealtime) {
      await this.datagramWriter.ready;
      if (this.closed) return;
      const payload = this.latestRealtime;
      this.latestRealtime = null;
      await this.datagramWriter.write(payload);
    }
  }

  async sendReliable(bytes) {
    if (this.closed) throw new Error("WebTransport connection is closed");
    const payload = frameReliable(toUint8Array(bytes));
    await this.reliableWriter.ready;
    if (this.closed) return;
    await this.reliableWriter.write(payload);
  }

  close(reason = "client close") {
    if (this.closed) return;
    this.closed = true;
    this.experimentalGestureState = "closed";
    this.gestureGrantWaiter?.reject(new Error("experimental gesture transport closed"));
    this.gestureGrantWaiter = null;
    this.latestRealtime = null;
    const pendingFlush = this.realtimeFlush;
    const transportClosed = this.transport.closed;
    this.transport.close({ closeCode: 0, reason });
    const waits = [pendingFlush, transportClosed].filter(Boolean);
    void Promise.allSettled(waits).finally(() => {
      safeReleaseLock(this.datagramWriter);
      safeReleaseLock(this.reliableWriter);
    });
  }
}

class WebSocketGameConnection {
  constructor(socket) {
    this.kind = "websocket";
    this.socket = socket;
    this.latestRealtime = null;
    this.flushScheduled = false;
  }

  static connect({ webSocketUrl, onRealtime, onReliable }) {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(webSocketUrl);
      socket.binaryType = "arraybuffer";
      const fail = () => reject(new Error("WebSocket connection failed"));
      socket.addEventListener("error", fail, { once: true });
      socket.addEventListener("open", () => {
        socket.removeEventListener("error", fail);
        const connection = new WebSocketGameConnection(socket);
        socket.addEventListener("message", (event) => {
          const bytes = new Uint8Array(event.data);
          if (bytes.length < 1) return;
          const channel = bytes[0];
          const payload = bytes.subarray(1);
          if (channel === 0) onRealtime?.(payload);
          if (channel === 1) onReliable?.(payload);
        });
        resolve(connection);
      }, { once: true });
    });
  }

  sendRealtime(bytes) {
    return this.#queueRealtime(bytes, true);
  }

  sendRealtimeOwned(bytes) {
    return this.#queueRealtime(bytes, false);
  }

  #queueRealtime(bytes, copy) {
    const payload = toUint8Array(bytes);
    this.latestRealtime = copy ? payload.slice() : payload;
    if (this.flushScheduled) return;
    this.flushScheduled = true;
    queueMicrotask(() => {
      this.flushScheduled = false;
      if (!this.latestRealtime || this.socket.readyState !== WebSocket.OPEN) return;
      if (this.socket.bufferedAmount > 64 * 1024) return;
      const framed = new Uint8Array(1 + this.latestRealtime.length);
      framed[0] = 0;
      framed.set(this.latestRealtime, 1);
      this.latestRealtime = null;
      this.socket.send(framed);
    });
  }

  sendReliable(bytes) {
    if (this.socket.readyState !== WebSocket.OPEN) throw new Error("WebSocket is not open");
    const data = toUint8Array(bytes);
    const payload = new Uint8Array(1 + data.length);
    payload[0] = 1;
    payload.set(data, 1);
    this.socket.send(payload);
  }

  close(reason = "client close") {
    this.socket.close(1000, reason.slice(0, 123));
  }
}

async function pumpReader(reader, handler) {
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) return;
      if (value) handler?.(value);
    }
  } catch (error) {
    console.warn("realtime receive loop ended", error);
  } finally {
    reader.releaseLock();
  }
}

async function pumpLengthPrefixedReader(reader, handler) {
  let pending = new Uint8Array(0);
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) return;
      pending = concatBytes(pending, value);
      while (pending.length >= 2) {
        const length = pending[0] | (pending[1] << 8);
        if (pending.length < 2 + length) break;
        handler?.(pending.slice(2, 2 + length));
        pending = pending.slice(2 + length);
      }
    }
  } catch (error) {
    console.warn("reliable receive loop ended", error);
  } finally {
    reader.releaseLock();
  }
}

function frameReliable(payload) {
  if (payload.length > 0xffff) throw new RangeError("reliable frame exceeds 65535 bytes");
  const framed = new Uint8Array(2 + payload.length);
  framed[0] = payload.length & 0xff;
  framed[1] = payload.length >>> 8;
  framed.set(payload, 2);
  return framed;
}

function concatBytes(a, b) {
  const next = new Uint8Array(a.length + b.length);
  next.set(a);
  next.set(b, a.length);
  return next;
}

function safeReleaseLock(writer) {
  try {
    writer.releaseLock();
  } catch {
    // The transport may have already released/errored the stream during close.
  }
}

function toUint8Array(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  throw new TypeError("network payload must be binary");
}

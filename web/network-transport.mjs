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
  }

  static async connect({ webTransportUrl, webTransportOptions, onRealtime, onReliable }) {
    const transport = new WebTransport(webTransportUrl, webTransportOptions);
    await transport.ready;
    const datagramWriter = transport.datagrams.writable.getWriter();
    const reliable = await transport.createBidirectionalStream();
    const reliableWriter = reliable.writable.getWriter();
    pumpReader(transport.datagrams.readable.getReader(), onRealtime);
    pumpLengthPrefixedReader(reliable.readable.getReader(), onReliable);
    return new WebTransportGameConnection(transport, datagramWriter, reliableWriter);
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
    if (!this.realtimeFlush) {
      this.realtimeFlush = this.#flushRealtime().finally(() => { this.realtimeFlush = null; });
    }
    return this.realtimeFlush;
  }

  async #flushRealtime() {
    while (!this.closed && this.latestRealtime) {
      await this.datagramWriter.ready;
      const payload = this.latestRealtime;
      this.latestRealtime = null;
      await this.datagramWriter.write(payload);
    }
  }

  async sendReliable(bytes) {
    const payload = frameReliable(toUint8Array(bytes));
    await this.reliableWriter.ready;
    await this.reliableWriter.write(payload);
  }

  close(reason = "client close") {
    this.closed = true;
    this.latestRealtime = null;
    this.datagramWriter.releaseLock();
    this.reliableWriter.releaseLock();
    this.transport.close({ closeCode: 0, reason });
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

function toUint8Array(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  throw new TypeError("network payload must be binary");
}

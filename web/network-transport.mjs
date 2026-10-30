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
import { createV1InputReplayWindow } from "../src/network/v1-input-replay-window.mjs";
import { decodeProposedTypedGestureEvent } from "../src/network/prealpha-lmb-gesture-proposal.mjs";

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
  #privateHitLab = null;

  constructor(transport, datagramWriter, reliableWriter) {
    this.kind = "webtransport";
    this.transport = transport;
    this.datagramWriter = datagramWriter;
    this.reliableWriter = reliableWriter;
    this.latestRealtime = null;
    this.realtimeFlush = null;
    this.closed = false;
    this.v1ReplayWindow = createV1InputReplayWindow({
      onStall: () => this.close("original v1 replay writer stalled for 1500ms"),
    });
    // Typed Combat edges are never fed to the latest-wins sampled input queue.
    this.experimentalGestureState = "off";
    this.gestureGrantWaiter = null;
    this.gestureWriteQueue = Promise.resolve();
    // This is a transport safety ceiling, not a Combat retry policy.
    // The one-lease outbox may independently bound or retry genuine edges.
    this.pendingGestureEdges = 0;
    // Source11: each successful server-bound bidi renewal gets a NEW opaque
    // JS token; the initial QUIC datagram generation uses the connection.
    this.typedLeaseToken = this;
    this.typedGeneration = 0;
    this.typedBoundWriter = null;
    this.onBoundGestureAck = null;
    this.onGestureRenewalRequired = null;
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
      if (!connection.#handleGestureGrant(packet)
          && !connection.#handleRespawnRenewalNotice(packet)
          && !connection.#privateHitLab?.receive(packet, connection)) onReliable?.(packet);
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

  #handleRespawnRenewalNotice(packet) {
    const bytes = toUint8Array(packet);
    if (bytes.length !== 4 || bytes[0] !== 2 || bytes[1] !== 0x14
        || bytes[2] !== 0 || bytes[3] !== 0) return false;
    if (!this.closed && this.experimentalGestureState === "granted") {
      // Notice is a hint only: the new bidi's real server grant is required.
      void Promise.resolve().then(() => this.onGestureRenewalRequired?.()).catch(() => {
        this.close("Source11 generation renewal failed");
      });
    }
    return true;
  }

  // Only after a real server-side World respawn. This extra bidi is not
  // another root reliable channel, and never calls acceptUni()/Chat C1.
  async negotiateRespawnTypedChannel({timeoutMs=2000}={}) {
    if (this.closed || this.kind !== "webtransport" ||
        this.experimentalGestureState !== "granted" || !this.onGestureRenewalRequired) {
      throw new Error("Source11 requires current original server-granted QUIC actor");
    }
    if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 10000)
      throw new RangeError("bounded Source11 grant deadline required");
    // A single startup deadline covers OPEN, HELLO write/backpressure and
    // server GRANT, rather than starting only after HELLO has been written.
    // WebTransport does not guarantee that createBidirectionalStream() can
    // be aborted; any late-resolving stream is explicitly reset/closed.
    let timer, expired=false, writer;
    const deadline=new Promise((_,reject)=>{
      timer=setTimeout(()=>{
        expired=true;
        reject(new Error("Source11 bound channel startup timeout"));
      },timeoutMs);
    });
    const opening=Promise.resolve().then(()=>this.transport.createBidirectionalStream());
    void opening.then(stream=>{
      if(!expired && !this.closed) return;
      try {
        void Promise.resolve(stream.writable.getWriter().abort(
          "stale Source11 channel opened after startup deadline"
        )).catch(()=>{});
      } catch {}
      try { void Promise.resolve(stream.readable.cancel?.()).catch(()=>{}); } catch {}
    }).catch(()=>{});
    try {
      const stream=await Promise.race([opening,deadline]);
      if(this.closed || expired) throw new Error("retired Source11 stream cannot acquire authority");
      writer=stream.writable.getWriter();
      const reader=stream.readable.getReader();
      let settle, fail, first=true;
      const acknowledged=new Promise((resolve,reject)=>{settle=resolve;fail=reject;});
      void acknowledged.catch(()=>{});
      const token=Object.freeze({generation:this.typedGeneration+1});
      // Grant and all subsequent ACKs originate on this SAME original
      // server-bound bidi; no old DATAGRAM ACK can settle a fresh generation.
      void pumpLengthPrefixedReader(reader,packet=>{
        const bytes=toUint8Array(packet);
        if(first){
          first=false;
          if(bytes.length===4 && bytes[0]===2 && bytes[1]===0x13
              && bytes[2]===0 && bytes[3]===0) settle();
          else fail(new Error("Source11 malformed or rejected bound grant"));
          return;
        }
        if(this.closed || this.typedLeaseToken!==token) return;
        this.onBoundGestureAck?.(bytes.slice(),token);
      });
      await Promise.race([
        writer.write(Uint8Array.from([2,0x10,77,89,65,83,79,49])),
        deadline,
      ]);
      await Promise.race([acknowledged,deadline]);
      if(this.closed || expired) throw new Error("Source11 original QUIC retired");
      const previous=this.typedBoundWriter;
      this.typedGeneration+=1;
      this.typedLeaseToken=token;
      this.typedBoundWriter=writer;
      // Old pending .ready/write promises must neither block nor close the
      // newly bound generation. Every old continuation checks its own token.
      this.gestureWriteQueue=Promise.resolve();
      this.pendingGestureEdges=0;
      if(previous) { void previous.close().catch(()=>{}); }
      return token;
    } catch(error) {
      // Never wait indefinitely for a stuck writer's abort. This optional
      // stream may fail while the original game and Chat C1 remain alive.
      if(writer){
        try { void Promise.resolve(writer.abort?.(String(error))).catch(()=>{}); } catch {}
      }
      throw error;
    } finally { clearTimeout(timer); }
  }

  // Only a LOCAL loopback original-Rust flight may negotiate this experimental
  // server-issued capability. In particular this cannot activate public R2.
  // The existing WebTransport bidi stream and original server actor stay shared.
  async negotiateExperimentalGestureV2({ timeoutMs = 3000, reliableStream = false } = {}) {
    const host = new URL(this.webTransportUrl).hostname;
    if (!["localhost", "127.0.0.1", "[::1]"].includes(host)) {
      throw new Error("experimental gesture grant is loopback-only");
    }
    return this.#negotiateGesture({timeoutMs,reliableStream});
  }

  async negotiateInstantLmb({timeoutMs=3000}={}) {
    const url = new URL(this.webTransportUrl);
    const local = ["localhost","127.0.0.1","[::1]"].includes(url.hostname);
    const official = url.hostname === "game.open-trust-layer.org" && url.port === "4433";
    if ((!local && !official) || url.protocol !== "https:" || url.pathname !== "/game"
        || url.username || url.password || url.search || url.hash) {
      throw new Error("instant LMB requires the pinned first-party game endpoint or loopback preview");
    }
    // First-party UI separately verifies its operator-served release config.
    // The existing original server must still grant this connection's lease.
    return this.#negotiateGesture({timeoutMs,reliableStream:true});
  }

  async #negotiateGesture({timeoutMs,reliableStream}) {
    if (this.closed || this.experimentalGestureState !== "off") {
      throw new Error("experimental gesture handshake requires a fresh connection");
    }
    if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 10000) {
      throw new RangeError("bounded handshake timeout required");
    }
    if (typeof reliableStream !== "boolean") throw new TypeError("explicit reliable negotiation mode required");
    this.experimentalGestureState = "pending";
    let resolveGrant, rejectGrant;
    const acknowledged = new Promise((resolve, reject) => {
      resolveGrant = resolve; rejectGrant = reject;
    });
    // Prevent an unhandled rejected handshake if the QUIC uni write itself fails.
    void acknowledged.catch(() => {});
    this.gestureGrantWaiter = { resolve: resolveGrant, reject: rejectGrant };
    let rejectDeadline;
    const deadline = new Promise((_, reject) => { rejectDeadline = reject; });
    const timeout = setTimeout(() => {
      const error = new Error("original Rust v2 grant timed out");
      this.gestureGrantWaiter?.reject(error);
      rejectDeadline(error);
      this.gestureGrantWaiter = null;
    }, timeoutMs);
    try {
      const sendHello = async () => {
        const hello = Uint8Array.from([2, 0x10, 77, 89, 65, 83, 79, 49]);
        if (reliableStream) {
          // Chat C1 retains optional uni streams. sendReliable frames the
          // same original HELLO exactly once on the admitted game bi stream.
          await this.sendReliable(hello);
          return;
        }
        const stream = await this.transport.createUnidirectionalStream();
        const writer = stream.getWriter();
        try {
          // Older loopback-only peers retain their exact 8byte uni HELLO.
          await writer.write(hello);
          await writer.close();
        } finally { try { writer.releaseLock(); } catch {} }
      };
      await Promise.race([sendHello(), deadline]);
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
  sendExperimentalGestureEdge(bytes, expectedLease = this) {
    if (this.closed || this.experimentalGestureState !== "granted" ||
        expectedLease !== this.typedLeaseToken) {
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
    // Use the SAME selected 0x11 codec as the current LMB producer/World.
    // A forged source0 with invalid action, zero sequence or gesture ID must
    // not consume one of the bounded real QUIC writer slots.
    decodeProposedTypedGestureEvent(payload);
    // Never let a stalled datagram writer accumulate arbitrarily many
    // outstanding 16-byte gesture events/promises. Overflow is not an ACK,
    // not a skipped RELEASE, and must retire the whole same-QUIC lease.
    if (this.pendingGestureEdges >= 64) {
      this.close("experimental gesture queue overflow");
      throw new RangeError("bounded experimental gesture queue overflow");
    }
    const owned = payload.slice();
    const boundWriter = this.typedBoundWriter;
    this.pendingGestureEdges += 1;
    const send = this.gestureWriteQueue.then(async () => {
      if (this.closed || this.experimentalGestureState !== "granted" ||
          expectedLease !== this.typedLeaseToken)
        throw new Error("retired generation cannot write a typed edge");
      const writer = boundWriter ?? this.datagramWriter;
      await writer.ready;
      if (this.closed || expectedLease !== this.typedLeaseToken)
        throw new Error("generation changed while typed writer waited");
      await writer.write(boundWriter ? frameReliable(owned) : owned);
    });
    this.gestureWriteQueue = send.then(
      () => {
        if (expectedLease === this.typedLeaseToken) this.pendingGestureEdges -= 1;
      },
      () => {
        // An old in-flight promise cannot retire a newer authenticated lease.
        if (expectedLease === this.typedLeaseToken) {
          this.pendingGestureEdges -= 1;
          this.close("gesture delivery failed");
        }
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
    const offered = toUint8Array(bytes);
    const payload = copy ? offered.slice() : offered;
    try {
      if (this.v1ReplayWindow.offer(payload)) this.latestRealtime = null;
      else this.latestRealtime = payload;
    } catch (error) {
      this.close("original v1 replay window overflow");
      throw error;
    }
    return this.#ensureRealtimeFlush();
  }

  #ensureRealtimeFlush() {
    if (!this.realtimeFlush) {
      this.realtimeFlush = this.#flushRealtime()
        .catch((error) => {
          if (!this.closed) throw error;
        })
        .finally(() => {
          this.realtimeFlush = null;
          // Resume existing work without offering/counting its packets twice.
          if (!this.closed && (this.v1ReplayWindow.pending || this.latestRealtime)) {
            void this.#ensureRealtimeFlush().catch(() => {
              if (!this.closed) this.close("realtime continuation failed");
            });
          }
        });
    }
    return this.realtimeFlush;
  }

  async #flushRealtime() {
    while (!this.closed && (this.v1ReplayWindow.pending || this.latestRealtime)) {
      await this.datagramWriter.ready;
      if (this.closed) return;
      const protectedPayload = this.v1ReplayWindow.peek();
      const payload = protectedPayload ?? this.latestRealtime;
      if (!protectedPayload) this.latestRealtime = null;
      await this.datagramWriter.write(payload);
      if (this.closed) return;
      if (protectedPayload) this.v1ReplayWindow.complete(protectedPayload);
    }
  }

  async negotiatePrivateHitDeliveryLab(options) {
    if (this.closed || this.experimentalGestureState !== "granted" || this.#privateHitLab) {
      throw new Error("private HIT requires one current original gesture transport");
    }
    const { createPrivateHitDeliveryLab } = await import("./private-hit-delivery-lab.mjs");
    if (this.closed || this.#privateHitLab) throw new Error("retired or duplicate private HIT negotiation");
    this.#privateHitLab = createPrivateHitDeliveryLab({ ...options, transport: this });
    void this.transport.closed.then(
      () => this.close("original private HIT connection ended"),
      () => this.close("original private HIT connection failed"),
    );
    await this.#privateHitLab.start();
    return this.#privateHitLab;
  }

  async sendReliable(bytes) {
    if (this.closed) throw new Error("WebTransport connection is closed");
    const payload = frameReliable(toUint8Array(bytes));
    await this.reliableWriter.ready;
    // A closed session cannot treat an unsent reliable frame as delivered.
    // The M147 recipient ledger may advance written-state ONLY after write().
    if (this.closed) throw new Error("WebTransport connection is closed");
    await this.reliableWriter.write(payload);
    // A completed writer promise is not a current-lease delivery if the
    // connection was retired while the write was still in flight. Keep this
    // conservative: any later recipient ACK/replay must use its own lease.
    if (this.closed) throw new Error("WebTransport connection is closed");
  }

  close(reason = "client close") {
    if (this.closed) return;
    this.closed = true;
    this.#privateHitLab?.close(reason);
    this.experimentalGestureState = "closed";
    this.onGestureRenewalRequired = null;
    this.onBoundGestureAck = null;
    this.typedLeaseToken = null;
    this.pendingGestureEdges = 0;
    this.gestureWriteQueue = Promise.resolve();
    if(this.typedBoundWriter) { void this.typedBoundWriter.close().catch(()=>{}); }
    this.gestureGrantWaiter?.reject(new Error("experimental gesture transport closed"));
    this.gestureGrantWaiter = null;
    this.latestRealtime = null;
    this.v1ReplayWindow.close();
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

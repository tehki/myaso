// Explicit private laboratory only. No public packet registry or HP writer.
import { createProposedHitInbox, encodeProposedHitControl, HIT_CONTROL_OP } from "../src/network/m147-hit-control-proposal.mjs";
import { decodeHitReceipt } from "../src/network/m147-hit-receipt-codec.mjs";
import { presentHitReceipt } from "../src/browser/m147-hit-receipt-feedback.mjs";

const loopback = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function createPrivateHitDeliveryLab({ transport, pageUrl, actorId, onReceipt, onGap,
  timers = { setTimeout, clearTimeout } } = {}) {
  if (transport?.kind !== "webtransport" || transport.closed
      || transport.experimentalGestureState !== "granted"
      || !loopback.has(new URL(transport.webTransportUrl).hostname)
      || !loopback.has(new URL(pageUrl).hostname)) {
    throw new Error("private HIT lab requires current original v2 grant and loopback page/QUIC");
  }
  let closed = false, started = false, pending = null, writing = false;
  let highestSeen = -1, grantTimer = null, writeTimer = null;
  let resolveGrant, rejectGrant;
  const ready = new Promise((resolve, reject) => { resolveGrant = resolve; rejectGrant = reject; });
  void ready.catch(() => {});
  const delivered = [], controlsWritten = [];
  const inbox = createProposedHitInbox({ trustedTransport: transport, actorId,
    onAttackerHit: present, onDamageTaken: present,
    onGap: gap => onGap?.(Object.freeze({ ...gap })),
  });

  function present(hit) {
    const receipt = Object.freeze({ ...hit });
    const presentation = Object.freeze(presentHitReceipt(receipt, actorId));
    // An exception prevents ACK. This callback never changes replicated HP.
    const applied = onReceipt?.(receipt, presentation);
    if (applied && typeof applied.then === "function") {
      void Promise.resolve(applied).catch(() => {});
      throw new Error("private HIT presentation must complete synchronously before ACK");
    }
    delivered.push(Object.freeze({ ...receipt, presentation, presentedAtEpochMs: Date.now() }));
    if (delivered.length > 64) delivered.shift();
  }
  function close(reason = "private HIT lease retired") {
    if (closed) return;
    closed = true;
    pending = null;
    inbox.retire();
    timers.clearTimeout(grantTimer);
    timers.clearTimeout(writeTimer);
    rejectGrant(new Error(reason));
  }
  function fail(error) {
    close(error.message);
    transport.close("private HIT delivery failed");
  }
  async function flush() {
    if (writing || closed || !pending) return;
    writing = true;
    const bytes = pending;
    pending = null;
    writeTimer = timers.setTimeout(() => fail(new Error("private HIT control writer stalled")), 1500);
    try {
      await transport.sendReliable(bytes);
      if (closed || transport.closed) return;
      controlsWritten.push(Object.freeze({ op: new Uint8Array(bytes)[2],
        cursor: new DataView(bytes).getUint32(4, true),
        presentedCount: inbox.state.expected, writtenAtEpochMs: Date.now() }));
      if (controlsWritten.length > 64) controlsWritten.shift();
    } catch (error) {
      fail(error);
    } finally {
      timers.clearTimeout(writeTimer);
      writing = false;
      if (!closed) void flush();
    }
  }
  function send(bytes) {
    if (closed || transport.closed) throw new Error("retired private HIT transport");
    // One in-flight control plus one coalesced current cursor; no retry queue.
    pending = bytes;
    void flush();
  }
  function receive(packet, presentedTransport) {
    const bytes = packet instanceof Uint8Array ? packet : new Uint8Array(packet);
    if (bytes[0] !== 1 || (bytes[1] !== 5 && bytes[1] !== 6)) return false;
    try {
      if (closed || !started || transport.closed || presentedTransport !== transport)
        throw new Error("foreign or retired private HIT connection");
      if (bytes[1] === 6) {
        const result = inbox.acceptControl(bytes, presentedTransport);
        if (result.kind === "granted") {
          timers.clearTimeout(grantTimer);
          resolveGrant(true);
        } else {
          throw new Error("private HIT GAP/retirement requires a fresh server lease");
        }
      } else {
        const hit = decodeHitReceipt(bytes);
        const result = inbox.receipt(bytes, presentedTransport);
        highestSeen = Math.max(highestSeen, hit.sequence);
        if (inbox.state.expected <= highestSeen) {
          // Future packets were intentionally not buffered. Recover each
          // missing contiguous receipt, including those discarded before replay.
          const response = new Uint8Array(result.response).slice();
          response[2] = HIT_CONTROL_OP.CLIENT_NACK;
          send(response.buffer);
        } else {
          send(result.response);
        }
      }
    } catch (error) { fail(error); }
    return true;
  }
  async function start() {
    if (started || closed) throw new Error("private HIT handshake requires a fresh lease");
    started = true;
    grantTimer = timers.setTimeout(() => fail(new Error("private HIT grant timed out")), 3000);
    send(encodeProposedHitControl({ op: HIT_CONTROL_OP.CLIENT_HELLO }));
    await ready;
    return true;
  }
  return Object.freeze({ start, receive, close,
    get snapshot() {
      return Object.freeze({ closed, ...inbox.state,
        delivered: Object.freeze(delivered.map(x => Object.freeze({ ...x }))),
        controlsWritten: Object.freeze(controlsWritten.map(x => Object.freeze({ ...x }))),
      });
    },
  });
}

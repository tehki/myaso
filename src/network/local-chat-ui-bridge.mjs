// Department 8A: bridge the authenticated Chat C1 stream to Department 10 UI.
// Draft-only integration seam; do not install in production before release gates.
import { CHAT, CHAT_RESULT_CODE, encodeChatSend, openLocalChat } from "./chat-codec.mjs";

const ACK_TIMEOUT_MS = 9000; // Below UI's existing 10-second pending deadline.
const MAX_RECENT_UI_IDS = 64;
let nextAdapterInstance = 0;

/**
 * Attach to an existing authenticated game WebTransport session. The UI receives
 * no authority to choose sender ID, position, recipients or message delivery.
 * openChannel injection is for deterministic tests only.
 */
export async function openLocalChatUiBridge(gameConnection, {
  openChannel = openLocalChat,
  onDisconnect = () => {},
  ackTimeoutMs = ACK_TIMEOUT_MS,
} = {}) {
  if (!Number.isInteger(ackTimeoutMs) || ackTimeoutMs < 1 || ackTimeoutMs > ACK_TIMEOUT_MS) {
    throw new RangeError("invalid chat acknowledgement deadline");
  }
  const listeners = new Set();
  const pending = new Map();
  const recentIds = new Set();
  const recentOrder = [];
  const localSessionTag = "c1-" + (++nextAdapterInstance) + "-";
  let retired = false;
  let correlationNext = 1;
  let wire;

  function failPending(reason) {
    for (const record of pending.values()) {
      clearTimeout(record.timer);
      record.reject(reason);
    }
    pending.clear();
  }
  function retire(reason) {
    if (retired) return;
    retired = true;
    listeners.clear();
    failPending(reason);
    try { onDisconnect(reason); } catch { /* UI observers never control transport. */ }
  }
  function failChatTransport(reason) {
    // ACK absence/write failure makes the optional chat channel untrustworthy;
    // continuing to enqueue would silently accumulate blocked QUIC writes.
    // A fresh game/chat session is required; never close gameplay WebTransport.
    retire(reason);
    try { Promise.resolve(wire?.close?.()).catch(() => {}); }
    catch { /* failure cannot change combat connection */ }
  }
  function onReceived(event) {
    if (retired || event?.kind !== "received" || event.channel !== CHAT.channelLocal
      || !Number.isInteger(event.senderId) || event.senderId <= 0
      || typeof event.messageId !== "bigint" || event.messageId <= 0n
      || typeof event.text !== "string") return;
    // Verified character display names belong to Department 8B. A provisional
    // label MUST derive from the server-issued net ID, not untrusted text.
    const message = Object.freeze({
      channel: "local",
      serverMessageId: localSessionTag + event.messageId.toString(),
      // ChatReceived senderId comes from the authenticated Rust World stream,
      // never client-provided text or claimed display names.
      sender: Object.freeze({ netId: event.senderId, displayName: "Player #" + event.senderId }),
      text: event.text,
    });
    for (const listener of listeners) {
      try { listener(message); } catch { /* Faulty view must not halt chat. */ }
    }
  }
  function onResult(event) {
    if (retired || event?.kind !== "result") return;
    const record = pending.get(event.correlation);
    if (!record) return; // Stale, duplicate or unrelated ACK.
    pending.delete(event.correlation);
    clearTimeout(record.timer);
    if (event.code === CHAT_RESULT_CODE.ACCEPTED
      && typeof event.messageId === "bigint" && event.messageId > 0n) {
      // Accepted by the server is NOT proof of recipient delivery/read.
      record.resolve(Object.freeze({ ok: true, clientMessageId: record.uiId }));
    } else {
      record.reject(new Error("Chat was not accepted (result " + String(event.code) + ")"));
    }
  }

  wire = await openChannel(gameConnection, { onReceived, onResult });
  if (!wire || typeof wire.send !== "function"
    || typeof wire.close !== "function" || wire.closed) {
    throw new Error("Chat C1 reliable stream unavailable");
  }
  // Ensure a closed/erroring reader invalidates old-session ACK state and
  // cannot produce unhandled promise rejections.
  if (wire.reading && typeof wire.reading.then === "function") {
    Promise.resolve(wire.reading).then(
      () => retire(new Error("Chat connection ended")),
      () => retire(new Error("Chat connection failed")),
    );
  }

  return Object.freeze({
    get ready() { return !retired && !wire.closed; },
    subscribe(listener) {
      if (typeof listener !== "function") throw new TypeError("chat listener must be a function");
      if (retired) return () => {};
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    send({ channel, clientMessageId, text }) {
      if (retired || wire.closed) return Promise.reject(new Error("Chat session unavailable"));
      if (channel !== "local") return Promise.reject(new RangeError("Unsupported chat channel"));
      if (typeof clientMessageId !== "string" || !clientMessageId
        || clientMessageId.length > 128 || recentIds.has(clientMessageId)) {
        return Promise.reject(new RangeError("Missing or repeated UI chat message ID"));
      }
      if (pending.size !== 0) return Promise.reject(new Error("Chat send already pending"));
      if (correlationNext > 0xffffffff) return Promise.reject(new Error("Chat correlation exhausted"));
      const correlation = correlationNext;
      try {
        // Exact Core wire validation; the presentation's text limit is larger.
        encodeChatSend({ correlation, text, channel: CHAT.channelLocal });
      } catch (error) { return Promise.reject(error); }
      correlationNext += 1;
      recentIds.add(clientMessageId);
      recentOrder.push(clientMessageId);
      if (recentOrder.length > MAX_RECENT_UI_IDS) recentIds.delete(recentOrder.shift());
      const result = new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          if (!pending.delete(correlation)) return;
          const reason = new Error("No authoritative chat acknowledgement");
          reject(reason);
          failChatTransport(reason);
        }, ackTimeoutMs);
        pending.set(correlation, { uiId: clientMessageId, resolve, reject, timer });
      });
      // Writable stream delays must not indefinitely block the UI's ACK timer.
      // Only the server-issued result can resolve the promise successfully.
      Promise.resolve().then(() => {
        // Closing/replacing the adapter before the queued microtask runs
        // must never submit a message from a retired session.
        if (retired || wire.closed || !pending.has(correlation)) return;
        return wire.send({ correlation, text, channel: CHAT.channelLocal });
      }).catch(error => {
        const record = pending.get(correlation);
        if (record) {
          pending.delete(correlation);
          clearTimeout(record.timer);
          record.reject(error);
          failChatTransport(error);
        }
      });
      return result;
    },
    async close() {
      retire(new Error("Chat adapter closed"));
      await wire.close();
    },
  });
}

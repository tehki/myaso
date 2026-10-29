// Chat C1 presentation-only foundation. Core owns authentication, reliable
// transport, sender identity, recipient selection, rates, and server policy.
// No live adapter is installed in this milestone; an injected adapter must
// return explicit server acknowledgement before an outgoing row is accepted.
const INSTANCES = new WeakMap();
export const CHAT_UI_LIMITS = Object.freeze({ history: 60, chars: 240, bytes: 240 });

export function validateLocalChatText(value) {
  if (typeof value !== "string") throw new Error("Enter a message.");
  const text = value.trim();
  if (!text) throw new Error("Enter a message.");
  if (/\p{Cc}/u.test(text) || /[\u202a-\u202e\u2066-\u2069\u200e\u200f]/iu.test(text)) throw new Error("Control characters are not allowed.");
  if ([...text].length > CHAT_UI_LIMITS.chars || new TextEncoder().encode(text).length > CHAT_UI_LIMITS.bytes) {
    throw new Error("Message is too long.");
  }
  return text;
}

export function createLocalChatHistory(limit = CHAT_UI_LIMITS.history) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) throw new RangeError("Invalid chat history limit");
  const entries = [];
  const ids = new Set();
  // Core server-issued message IDs can restart after a new WebTransport
  // session (for example when an ephemeral alpha server restarts). Keep
  // dedup scoped to the authenticated adapter generation, not lifetime UI.
  let session = 0;
  return {
    beginSession() { session += 1; },
    push(event) {
      if (!event || !["local", "system"].includes(event.channel)
        || typeof event.serverMessageId !== "string" || !event.serverMessageId || event.serverMessageId.length > 128
        || typeof event.text !== "string" || event.text.length > 1024
        || (event.channel === "local" && (typeof event.sender?.displayName !== "string" || !event.sender.displayName))) return false;
      const key = session + ":" + event.serverMessageId;
      if (ids.has(key)) return false;
      ids.add(key);
      entries.push({ event, key });
      // Evict the *original* session key so an old row never frees an ID
      // owned by the current session after the server counter restarts.
      while (entries.length > limit) ids.delete(entries.shift().key);
      return true;
    },
    values() { return entries.map(entry => entry.event); },
    size() { return entries.length; },
  };
}

function element(doc, tag, className, label) {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (label !== undefined) node.textContent = label;
  return node;
}

export function installLocalChat(doc, { online = false, adapter = null, idFactory = () => globalThis.crypto?.randomUUID?.() } = {}) {
  if (INSTANCES.has(doc)) {
    const existing = INSTANCES.get(doc);
    if (adapter) existing.bindAdapter(adapter);
    return existing;
  }
  const stage = doc.querySelector(".arena-stage");
  const canvas = doc.querySelector("#arena");
  if (!stage || !canvas) return null;

  const root = element(doc, "section", "local-chat");
  root.dataset.open = "false";
  root.dataset.combat = "false";
  root.setAttribute("role", "region");
  root.setAttribute("aria-label", "Local chat");
  root.setAttribute("data-local-chat", "");

  const toggle = element(doc, "button", "local-chat-toggle");
  toggle.type = "button";
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-label", "Expand local chat");
  const title = element(doc, "strong", "local-chat-heading", "LOCAL");
  const connection = element(doc, "span", "local-chat-connection", online ? "Offline" : "Practice");
  const unread = element(doc, "span", "local-chat-unread");
  unread.hidden = true;
  toggle.append(title, connection, unread);

  const body = element(doc, "div", "local-chat-body");
  const history = element(doc, "ol", "local-chat-history");
  history.setAttribute("role", "log");
  history.setAttribute("aria-label", "Local chat messages");
  history.setAttribute("aria-live", "off");
  const form = element(doc, "form", "local-chat-form");
  const input = element(doc, "input", "local-chat-input");
  input.type = "text";
  input.maxLength = CHAT_UI_LIMITS.chars;
  input.autocomplete = "off";
  input.setAttribute("aria-label", "Local chat message");
  input.placeholder = "Say something nearby…";
  const send = element(doc, "button", "local-chat-send", "Send");
  send.type = "submit";
  const status = element(doc, "p", "local-chat-status", online
    ? "Chat unavailable — awaiting Core server support."
    : "Practice has no multiplayer chat.");
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  status.setAttribute("aria-atomic", "true");
  form.append(input, send);
  body.append(history, form, status);
  root.append(toggle, body);
  stage.append(root);

  const css = element(doc, "link");
  css.rel = "stylesheet";
  css.href = "./local-chat.css";
  css.setAttribute("data-local-chat-style", "");
  doc.head?.append(css);

  const store = createLocalChatHistory();
  let transport = null;
  let unsubscribe = null;
  let pending = false;
  let generation = 0;
  let cancelInflight = null;
  let unreadCount = 0;
  let disposed = false;

  function isReady() { return Boolean(online && transport && typeof transport.send === "function" && transport.ready !== false); }
  function availability() {
    const ready = isReady();
    const changed = root.dataset.connected !== String(ready);
    root.dataset.connected = String(ready);
    connection.textContent = ready ? "Nearby" : online ? "Offline" : "Practice";
    // Keep the composer focused while an ACK is pending, so Escape still works.
    input.disabled = !ready;
    input.readOnly = pending;
    send.disabled = !ready || pending;
    if (changed) status.textContent = ready ? "Local · nearby players only" :
      online ? "Chat unavailable — awaiting Core server support." : "Practice has no multiplayer chat.";
    return ready;
  }
  function setExpanded(expanded, focusInput = false) {
    root.dataset.open = String(expanded);
    toggle.setAttribute("aria-expanded", String(expanded));
    toggle.setAttribute("aria-label", expanded ? "Collapse local chat" : "Expand local chat");
    if (expanded) {
      unreadCount = 0;
      unread.hidden = true;
      if (focusInput && isReady()) input.focus();
      history.scrollTop = history.scrollHeight;
    } else if (doc.activeElement === input) {
      input.value = "";
      canvas.focus();
    }
  }
  function messageRow(channel, name, text, state) {
    const item = element(doc, "li", "local-chat-item");
    item.dataset.channel = channel;
    if (state) item.dataset.delivery = state;
    const meta = element(doc, "span", "local-chat-sender", name);
    const message = element(doc, "span", "local-chat-text", text);
    const stateLabel = element(doc, "small", "local-chat-delivery", state === "pending" ? "Sending…" : "");
    item.append(meta, message, stateLabel);
    history.append(item);
    while (history.childElementCount > CHAT_UI_LIMITS.history) history.firstElementChild.remove();
    history.scrollTop = history.scrollHeight;
    return { item, stateLabel, meta, message };
  }
  function receive(event) {
    if (disposed || !store.push(event)) return false;
    const name = event.channel === "system" ? "System" : event.sender.displayName.slice(0, 64);
    messageRow(event.channel, name, event.text);
    if (root.dataset.open !== "true") {
      unreadCount = Math.min(99, unreadCount + 1);
      unread.hidden = false;
      unread.textContent = String(unreadCount);
      unread.setAttribute("aria-label", unreadCount + " unread chat messages");
    } else if (doc.activeElement !== input) {
      status.textContent = "New " + event.channel + " message from " + name;
    }
    return true;
  }
  async function submit() {
    if (disposed) return false;
    if (!isReady()) {
      status.textContent = "Message not sent — chat server unavailable.";
      return false;
    }
    if (pending) return false;
    let text;
    try { text = validateLocalChatText(input.value); }
    catch (error) { status.textContent = error.message; return false; }
    const clientMessageId = idFactory();
    if (typeof clientMessageId !== "string" || !clientMessageId || clientMessageId.length > 128) {
      status.textContent = "Message not sent — secure identifier unavailable.";
      return false;
    }
    const sendGeneration = generation;
    const sendAdapter = transport;
    const cancelled = new Promise((_resolve, reject) => {
      cancelInflight = () => reject(new Error("Connection changed"));
    });
    pending = true;
    const { item, stateLabel } = messageRow("local", "You", text, "pending");
    input.value = "";
    availability();
    let timeout;
    try {
      const ack = await Promise.race([
        Promise.resolve().then(() => {
          if (disposed || generation !== sendGeneration) throw new Error("Connection changed");
          return sendAdapter.send({ channel: "local", clientMessageId, text });
        }),
        cancelled,
        new Promise((_resolve, reject) => { timeout = setTimeout(() => reject(new Error("No server acknowledgement")), 10000); }),
      ]);
      if (disposed || generation !== sendGeneration || !ack || ack.ok !== true || ack.clientMessageId !== clientMessageId) {
        throw new Error("Message rejected by server");
      }
      item.dataset.delivery = "accepted";
      stateLabel.textContent = "Accepted";
      status.textContent = "Server accepted message; recipient delivery not confirmed.";
      return true;
    } catch {
      item.dataset.delivery = "failed";
      if (disposed || generation !== sendGeneration) {
        stateLabel.textContent = "Not confirmed";
      } else {
        stateLabel.textContent = "Failed";
        status.textContent = "Message not sent — server rejected or timed out.";
      }
      return false;
    } finally {
      clearTimeout(timeout);
      if (generation === sendGeneration) {
        cancelInflight = null;
        pending = false;
        if (!disposed) availability();
      }
    }
  }
  function bindAdapter(next) {
    if (disposed) return;
    // Binding the same live authenticated adapter is a refresh, not a new
    // server identity/session. Never cancel its pending ACK, reset the dedup
    // epoch, or subscribe to it twice.
    if (transport && next === transport) {
      availability();
      return;
    }
    const interrupted = pending;
    generation += 1;
    cancelInflight?.();
    cancelInflight = null;
    pending = false;
    unsubscribe?.();
    unsubscribe = null;
    transport = online && next && typeof next.send === "function" && typeof next.subscribe === "function" ? next : null;
    // Rebind means a new authenticated session. Continue showing bounded
    // prior history without letting old server IDs shadow new messages.
    if (transport) store.beginSession();
    if (transport) {
      const subscriptionGeneration = generation;
      // A callback queued by a replaced connection is no longer authoritative.
      const unbind = transport.subscribe(event =>
        !disposed && subscriptionGeneration === generation && receive(event));
      unsubscribe = typeof unbind === "function" ? unbind : null;
    }
    availability();
    if (interrupted) status.textContent = "Connection changed — previous message not confirmed.";
  }

  // P0 independent Combat4D real native first-red: when the chat input is
  // focused a physical W3C canvas click must never steal composer focus or
  // reach the Combat charge/roll/parry listeners (including window fallback).
  // Install capture listeners before keyboard handler, and remove on dispose.
  function suppressArenaInputWhileComposing(event) {
    if (root.dataset.open !== "true" || doc.activeElement !== input) return;
    if (event.cancelable !== false) event.preventDefault();
    event.stopImmediatePropagation();
  }
  const suppressedArenaEvents = [
    "pointerdown", "pointerup", "mousedown", "mouseup",
    "wheel", "contextmenu", "auxclick",
  ];
  for (const type of suppressedArenaEvents) {
    canvas.addEventListener(type, suppressArenaInputWhileComposing, true);
  }

  function onArenaKey(event) {
    if (event.key !== "Enter" || event.repeat || event.altKey || event.ctrlKey || event.metaKey || !isReady()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    setExpanded(true, true);
  }
  function onComposerKey(event) {
    // Input elements own ALL typing; no key event may bubble to Combat.
    event.stopPropagation();
    if (event.key === "Escape" && !event.isComposing) {
      event.preventDefault();
      event.stopPropagation();
      input.value = "";
      setExpanded(false);
      canvas.focus();
    } else if (event.key === "Enter" && !event.isComposing) {
      event.preventDefault();
      event.stopPropagation();
      void submit();
    }
  }
  const onSubmit = event => { event.preventDefault(); void submit(); };
  const onToggle = () => setExpanded(root.dataset.open !== "true", root.dataset.open !== "true");
  canvas.addEventListener("keydown", onArenaKey, true);
  input.addEventListener("keydown", onComposerKey);
  form.addEventListener("submit", onSubmit);
  toggle.addEventListener("click", onToggle);
  const Observer = doc.defaultView?.MutationObserver;
  const observer = Observer ? new Observer(() => {
    root.dataset.combat = String(stage.hasAttribute("data-combat-feedback") && doc.activeElement !== input);
  }) : null;
  observer?.observe(stage, { attributes: true, attributeFilter: ["data-combat-feedback"] });

  const controller = {
    root, input, toggle, status, history, receive, submit, bindAdapter,
    setExpanded, isReady,
    dispose() {
      if (disposed) return;
      disposed = true;
      generation += 1;
      cancelInflight?.();
      cancelInflight = null;
      observer?.disconnect();
      unsubscribe?.();
      canvas.removeEventListener("keydown", onArenaKey, true);
      for (const type of suppressedArenaEvents) {
        canvas.removeEventListener(type, suppressArenaInputWhileComposing, true);
      }
      input.removeEventListener("keydown", onComposerKey);
      form.removeEventListener("submit", onSubmit);
      toggle.removeEventListener("click", onToggle);
      root.remove();
      css.remove();
      INSTANCES.delete(doc);
    },
  };
  INSTANCES.set(doc, controller);
  bindAdapter(adapter);
  return controller;
}

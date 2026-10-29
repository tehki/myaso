// Chat C1 overhead text belongs to the *server-authenticated fighter identity*.
// Presentation only: never chooses recipients, adds Combat input or echoes a
// provisional outgoing message before the authoritative ChatResult ACCEPTED.
// Uses the same projected world/camera positions as the real Knight renderer.
import { projectArenaPoint, ARENA_VIEW_ZOOM } from "./arena-viewport.mjs";

export const OVERHEAD_CHAT = Object.freeze({
  lifetimeMs: 4800,
  fadeStartMs: 3450,
  maxVisible: 8,
  maxPerFighter: 2,
});

export function createOverheadChatBubbles({
  doc, stage = doc?.querySelector?.(".arena-stage"),
  canvas = doc?.querySelector?.("#arena"),
  clock = () => performance.now(),
} = {}) {
  if (!doc || !stage || !canvas) throw new TypeError("arena DOM required");
  const layer = doc.createElement("div");
  layer.className = "chat-c1-overheads";
  layer.setAttribute("aria-hidden", "true"); // Chat log alone is announced.
  layer.setAttribute("data-chat-c1-overheads", "");
  stage.append(layer);
  let entries = [];
  let disposed = false;

  function remove(entry) {
    entry.node.remove();
    entries = entries.filter(item => item !== entry);
  }
  function clear() {
    for (const entry of entries) entry.node.remove();
    entries = [];
  }
  function show(fighterId, text) {
    if (disposed || !Number.isSafeInteger(fighterId) || fighterId <= 0
      || typeof text !== "string" || !text.trim()
      || new TextEncoder().encode(text).length > 240) return false;
    const time = clock();
    if (!Number.isFinite(time)) return false;
    for (const previous of entries.filter(e => e.fighterId === fighterId)
      .slice(0, Math.max(0, entries.filter(e => e.fighterId === fighterId).length
        - OVERHEAD_CHAT.maxPerFighter + 1))) remove(previous);
    const node = doc.createElement("span");
    node.className = "chat-c1-overhead";
    node.textContent = text; // NEVER innerHTML, even for server-borne strings.
    node.hidden = true; // Wait for matching authoritative Knight on a frame.
    layer.append(node);
    entries.push({ fighterId, text, node, start: time });
    while (entries.length > OVERHEAD_CHAT.maxVisible) remove(entries[0]);
    return true;
  }
  function received(message) {
    // The UI bridge supplies sender.netId directly from authenticated
    // ChatReceived senderId. Do not infer it from a display name or message.
    if (!message || message.channel !== "local") return false;
    return show(message.sender?.netId, message.text);
  }
  function acceptedOwn(fighterId, text) {
    // Invoked only after a matching authoritative ChatResult ACK. The Rust
    // server does not echo the ChatReceived packet back to its sender.
    return show(fighterId, text);
  }
  function frame({
    ownId, own, remotes = [], camera, width, height,
    zoom = ARENA_VIEW_ZOOM, deadAction, nowMs = clock(),
  } = {}) {
    if (disposed) return;
    if (!Number.isFinite(nowMs)) return;
    for (const entry of entries.slice()) {
      if (nowMs - entry.start >= OVERHEAD_CHAT.lifetimeMs) remove(entry);
    }
    if (!camera || !Number.isFinite(camera.x) || !Number.isFinite(camera.y)
      || !Number.isFinite(width) || !Number.isFinite(height)
      || width <= 0 || height <= 0) {
      for (const entry of entries) entry.node.hidden = true;
      return;
    }
    const roster = new Map();
    if (Number.isSafeInteger(ownId) && ownId > 0 && own
      && Number.isFinite(own.x) && Number.isFinite(own.y)) {
      roster.set(ownId, own);
    }
    for (const entity of remotes) {
      if (Number.isSafeInteger(entity?.netId) && entity.netId > 0
        && entity.netId !== ownId && Number.isFinite(entity.x) && Number.isFinite(entity.y)) {
        roster.set(entity.netId, entity);
      }
    }
    const stageRect = stage.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const stacked = new Map();
    for (const entry of [...entries].reverse()) {
      const fighter = roster.get(entry.fighterId);
      const hidden = !fighter || fighter.action === deadAction
        || (Number.isFinite(fighter.hp) && fighter.hp <= 0);
      if (hidden) { entry.node.hidden = true; continue; }
      const point = projectArenaPoint(fighter.x, fighter.y,
        camera.x, camera.y, width, height, zoom);
      if (point.x < 0 || point.x > width || point.y < 0 || point.y > height) {
        entry.node.hidden = true; continue;
      }
      const index = stacked.get(entry.fighterId) ?? 0;
      stacked.set(entry.fighterId, index + 1);
      const canvasScaleX = canvasRect.width / width;
      const canvasScaleY = canvasRect.height / height;
      const x = canvasRect.left - stageRect.left + point.x * canvasScaleX;
      const y = canvasRect.top - stageRect.top + (point.y - 74 - index * 40) * canvasScaleY;
      entry.node.style.left = Math.max(12, Math.min(stageRect.width - 12, x)) + "px";
      entry.node.style.top = Math.max(4, y) + "px";
      const elapsed = Math.max(0, nowMs - entry.start);
      const fade = elapsed <= OVERHEAD_CHAT.fadeStartMs ? 1
        : Math.max(0, 1 - (elapsed - OVERHEAD_CHAT.fadeStartMs)
          / (OVERHEAD_CHAT.lifetimeMs - OVERHEAD_CHAT.fadeStartMs));
      entry.node.style.opacity = String(fade);
      entry.node.hidden = false;
    }
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    clear();
    layer.remove();
  }
  return Object.freeze({
    received, acceptedOwn, frame, clear, dispose,
    // Inspectable only for tests; no mutation of server fighter identity.
    get count() { return entries.length; },
    root: layer,
  });
}

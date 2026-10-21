// IDR P0 presentation preview. NOT an authenticated identity wire feed.
// True identity, controller type, canonical ID and current equipment are never
// inferred from network slot, appearance or player-authored chat text.
export const IDR_UNKNOWN = "Unknown stranger";

export function isIdrPreviewEligible(location) {
  if (!location || location.protocol !== "http:"
    || !["localhost", "127.0.0.1", "[::1]"].includes(location.hostname)) return false;
  return new URLSearchParams(location.search).get("idrPreview") === "1";
}

// Future Core 8B view projections MUST be signed/bound to the active viewer
// session and epoch. This is a pure display decoder, not such verification.
export function idrLabelFromProjection(projection) {
  if (!projection || !["verified", "claimed"].includes(projection.certainty)
    || typeof projection.label !== "string"
    || projection.label.length > 100 || !projection.label.trim()
    || /[\p{Cc}\u202a-\u202e\u2066-\u2069\u200e\u200f]/u.test(projection.label)) {
    return IDR_UNKNOWN;
  }
  return projection.label;
}

export function idrScoreboardRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map(row => ({
    ...row,
    // Preserve numeric network slot for internal sort/score bookkeeping.
    label: row.own ? "You" : IDR_UNKNOWN,
  }));
}

export function idrChatSender(event) {
  if (event?.channel !== "local" || !event.sender) return event;
  return Object.freeze({
    ...event,
    sender: Object.freeze({displayName: "Unknown voice"}),
  });
}

export function idrKillFeedText(event, ownId) {
  const own = id => id === ownId;
  if (!event || !Number.isInteger(event.killer) || !Number.isInteger(event.victim)) return "";
  const killer = own(event.killer) ? "You" : IDR_UNKNOWN;
  const victim = own(event.victim) ? "you" : IDR_UNKNOWN;
  return killer + " defeated " + victim;
}

export function idrFocusText(mode, hasTarget) {
  if (!hasTarget) return "NO RIVAL";
  const labels = {
    "guard-break": "GUARD BREAK", parry: "PARRY PUNISH",
    knockdown: "KNOCKDOWN", recovery: "PUNISH TARGET",
    nearest: "NEAREST",
  };
  return (labels[mode] ?? "NEAREST") + " · UNKNOWN";
}

export function idrStatusText(value) {
  if (typeof value !== "string") return "";
  // Legacy server-facing slot labels are a privacy leak if repeated in HUD.
  return value.replace(/player\s*#\d+/gi, "connected character")
    .replace(/(^|[^\w])#\d+\b/g, "$1unknown");
}

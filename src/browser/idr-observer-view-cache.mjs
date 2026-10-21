// UI 10 IDR: dormant observer-specific view cache, never a wire authenticator.
// Only the future authenticated Core 8A viewer projection adapter may call
// ingest/retire. This module cannot verify signatures, LOS or witness evidence.
import { IDR_UNKNOWN, idrLabelFromProjection } from "./identity-visibility.mjs";

const UNKNOWN = Object.freeze({ certainty: "unknown", label: IDR_UNKNOWN });
const safeRef = s => typeof s === "string" && s.length > 0 && s.length <= 160
  && !/[\p{Cc}\u202a-\u202e\u2066-\u2069\u200e\u200f]/u.test(s);
const safeEpoch = n => Number.isSafeInteger(n) && n >= 0;
const validBinding = b => b && safeRef(b.viewerRef) && safeRef(b.sessionRef)
  && safeEpoch(b.sessionEpoch);
const sameBinding = (a,b) => Boolean(a && b
  && a.viewerRef === b.viewerRef && a.sessionRef === b.sessionRef
  && a.sessionEpoch === b.sessionEpoch);
const safeProjection = p => p && safeRef(p.actorRef)
  && safeEpoch(p.appearanceEpoch) && safeEpoch(p.revision)
  && ["unknown", "claimed", "verified"].includes(p.certainty)
  // An Unknown view must not carry a hidden true name or disguised kind.
  && (p.certainty !== "unknown"
    ? typeof p.label === "string" && idrLabelFromProjection(p) !== IDR_UNKNOWN
    : p.label === undefined || p.label === null || p.label === "")
  && !("trueName" in p) && !("controllerKind" in p)
  && !("isHuman" in p) && !("isNpc" in p);

/**
 * Presentation ONLY; lifetime is the authenticated active viewer session.
 * This does not accept claims from chat text or grant authority to mark names
 * verified. Core 8A must authenticate recipient, source, epoch and signature
 * before delivering any observation to this cache.
 */
export function createIdrObserverViewCache({maxActors = 256} = {}) {
  if (!Number.isSafeInteger(maxActors) || maxActors < 1 || maxActors > 256) {
    throw new RangeError("bounded observer UI actor capacity required");
  }
  let binding = null;
  const actors = new Map();

  function beginSession(current) {
    if (!validBinding(current)) {
      binding = null;
      actors.clear();
      return false;
    }
    // Always discard prior knowledge on attach/re-attach, including same
    // connection string; a reconnect must not retain old leaked labels.
    binding = Object.freeze({
      viewerRef: current.viewerRef,
      sessionRef: current.sessionRef,
      sessionEpoch: current.sessionEpoch,
    });
    actors.clear();
    return true;
  }
  function ingest(projection) {
    if (!sameBinding(binding, projection) || !safeProjection(projection)) return false;
    const previous = actors.get(projection.actorRef);
    if (previous) {
      if (projection.revision < previous.revision
        || projection.appearanceEpoch < previous.appearanceEpoch) return false;
      if (projection.revision === previous.revision) {
        // Byte-equivalent replay only; conflicting same-revision packets cannot
        // silently replace evidence or resurrect a retired actor.
        return !previous.retired && previous.appearanceEpoch === projection.appearanceEpoch
          && previous.certainty === projection.certainty
          && previous.label === (projection.certainty === "unknown"
            ? IDR_UNKNOWN : idrLabelFromProjection(projection));
      }
      if (previous.retired) return false;
    }
    if (!previous && actors.size >= maxActors) return false;
    const label = projection.certainty === "unknown"
      ? IDR_UNKNOWN : idrLabelFromProjection(projection);
    actors.set(projection.actorRef, Object.freeze({
      revision: projection.revision, appearanceEpoch: projection.appearanceEpoch,
      certainty: projection.certainty, label, retired: false,
    }));
    return true;
  }
  function retire(projection) {
    if (!sameBinding(binding, projection) || !safeRef(projection?.actorRef)
      || !safeEpoch(projection.revision) || !safeEpoch(projection.appearanceEpoch)) {
      return false;
    }
    const prev = actors.get(projection.actorRef);
    if (!prev || prev.retired || projection.revision <= prev.revision
      || projection.appearanceEpoch < prev.appearanceEpoch) return false;
    actors.set(projection.actorRef, Object.freeze({
      revision: projection.revision, appearanceEpoch: projection.appearanceEpoch,
      certainty: "unknown", label: IDR_UNKNOWN, retired: true,
    }));
    return true;
  }
  function read(actorRef) {
    if (!binding || !safeRef(actorRef)) return UNKNOWN;
    const item = actors.get(actorRef);
    return item && !item.retired
      ? Object.freeze({certainty:item.certainty,label:item.label}) : UNKNOWN;
  }
  return Object.freeze({
    beginSession, ingest, retire, read,
    reset() { binding = null; actors.clear(); },
    get size() { return actors.size; },
  });
}

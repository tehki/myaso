// Combat 4A/4B DORMANT policy-review seam, NOT imported by live gameplay.
// The owner requires physical LMB DOWN to start LightWindup and a 320ms hold
// to yield HeavyReady only when the original World Light has not landed.
// To provide that possibility with 135ms Light windup, a same-gesture early
// UPGRADE request must be made before the authoritative contact. This review
// seam cannot itself grant Heavy: original Rust World + actor lease decide.
// No timers, W3C synthesis, QUIC writer or actual gameplay activation here.
export function createDormantPrecontactHoldReview({
  gate, now, requestAfterMs, expireAfterMs, explicitReview = false,
} = {}) {
  if (explicitReview !== true) {
    throw new Error("dormant precontact hold policy requires explicit review, not live activation");
  }
  if (typeof now !== "function"
      || typeof gate?.approvedHoldUpgrade !== "function"
      || !gate?.snapshot) {
    throw new TypeError("current dormant source0 gate and monotonic clock required");
  }
  // No product policy default: 4A/4B/Core8A must independently approve
  // the early intent threshold and latency budget before any runtime wiring.
  if (!Number.isFinite(requestAfterMs) || requestAfterMs <= 0
      || !Number.isFinite(expireAfterMs)
      || expireAfterMs <= requestAfterMs || expireAfterMs >= 135) {
    throw new RangeError("review bounds must be ordered and strictly before original 135ms Light");
  }
  let observation = null;
  let done = false;
  function arm(pointerId) {
    const s = gate.snapshot;
    if (observation || s.closed || !s.active || s.pointerId !== pointerId
      || s.upgraded || s.jump) return false;
    const t = now();
    if (!Number.isFinite(t)) return false;
    observation = {pointerId, gestureId:s.gestureId, pressMs:t, lastMs:t};
    done = false;
    return true;
  }
  function poll() {
    if (!observation || done) return "inactive";
    const t = now();
    const s = gate.snapshot;
    if (!Number.isFinite(t) || t < observation.lastMs) {
      done = true; return "invalid-clock";
    }
    observation.lastMs = t;
    if (s.closed || !s.active || s.pointerId !== observation.pointerId
      || s.gestureId !== observation.gestureId || s.jump || s.upgraded) {
      done = true; return "retired";
    }
    const heldMs = t - observation.pressMs;
    if (heldMs < requestAfterMs) return "waiting";
    done = true; // one review attempt ONLY; never retry after expiry/failure
    if (heldMs >= expireAfterMs) return "expired";
    return gate.approvedHoldUpgrade(observation.pointerId) ? "submitted" : "rejected";
  }
  function retire() {done = true; observation = null;}
  return Object.freeze({
    arm, poll, retire,
    get snapshot() {
      return Object.freeze({
        armed: Boolean(observation) && !done,
        observedGestureId: observation?.gestureId ?? null,
        // This is local elapsed intent, NOT authoritative World HIT/READY.
        didAttempt: done && observation !== null,
      });
    },
  });
}

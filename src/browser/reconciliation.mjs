import { NETWORK } from "../network/constants.mjs";

export function createPredictionHistory({ maxEntries = 64 } = {}) {
  if (!Number.isInteger(maxEntries) || maxEntries < 2 || maxEntries > 512) {
    throw new RangeError("maxEntries must be an integer in [2, 512]");
  }
  const entries = [];
  return {
    get size() { return entries.length; },
    push(tick, input) {
      assertUint32(tick, "tick");
      const copy = copyInput(tick, input);
      const last = entries.at(-1);
      if (last && !isTickNewer32(tick, last.tick)) {
        if (tick === last.tick) entries[entries.length - 1] = copy;
        return;
      }
      entries.push(copy);
      if (entries.length > maxEntries) entries.splice(0, entries.length - maxEntries);
    },
    discardThrough(tick) {
      assertUint32(tick, "tick");
      let count = 0;
      while (count < entries.length && !isTickNewer32(entries[count].tick, tick)) count += 1;
      if (count) entries.splice(0, count);
      return count;
    },
    replay(callback) {
      for (const entry of entries) callback(entry);
    },
    snapshot() {
      return entries.map((entry) => ({ ...entry }));
    },
    clear() { entries.length = 0; },
  };
}

export function reconcilePrediction({
  history,
  processedClientTick,
  authoritativeState,
  restoreAuthoritative,
  replayInput,
}) {
  if (!history || typeof history.discardThrough !== "function") throw new TypeError("history is required");
  if (typeof restoreAuthoritative !== "function") throw new TypeError("restoreAuthoritative must be a function");
  if (typeof replayInput !== "function") throw new TypeError("replayInput must be a function");
  const discarded = history.discardThrough(processedClientTick);
  restoreAuthoritative(authoritativeState);
  let replayed = 0;
  history.replay((entry) => {
    replayInput(entry);
    replayed += 1;
  });
  return { discarded, replayed };
}

export function applyVisualCorrection(current, authoritative, target = current) {
  const dx = authoritative.x - current.x;
  const dy = authoritative.y - current.y;
  const distance = Math.hypot(dx, dy);
  if (distance >= NETWORK.reconciliation.hardSnapDistance) {
    target.x = authoritative.x;
    target.y = authoritative.y;
    return { snapped: true, distance };
  }
  const rate = NETWORK.reconciliation.softCorrectionRate;
  target.x = current.x + dx * rate;
  target.y = current.y + dy * rate;
  return { snapped: false, distance };
}

export function isTickNewer32(candidate, reference) {
  candidate >>>= 0;
  reference >>>= 0;
  return candidate !== reference && ((candidate - reference) >>> 0) < 0x80000000;
}

function copyInput(tick, input = {}) {
  return {
    tick: tick >>> 0,
    moveX: finiteOrZero(input.moveX),
    moveY: finiteOrZero(input.moveY),
    facing: Number.isFinite(input.facing) ? input.facing : 0,
    attack: Boolean(input.attack),
    heavyAttack: Boolean(input.heavyAttack),
    dodge: Boolean(input.dodge),
    block: Boolean(input.block),
  };
}

function finiteOrZero(value) {
  return Number.isFinite(value) ? value : 0;
}

function assertUint32(value, name) {
  if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) throw new RangeError(`${name} must be a uint32`);
}

import { decodeInputPacket } from "./input-codec.mjs";

export class InputIngressWindow {
  #historyTicks;
  #newestTick = null;
  #seen = new Set();

  constructor({ historyTicks = 180 } = {}) {
    if (!Number.isInteger(historyTicks) || historyTicks < 1 || historyTicks > 4096) {
      throw new RangeError("historyTicks must be an integer in [1, 4096]");
    }
    this.#historyTicks = historyTicks;
  }

  ingest(buffer) {
    const packet = decodeInputPacket(buffer);
    const accepted = [];

    for (const sample of packet.samples) {
      if (this.#newestTick === null || isTickNewer32(sample.tick, this.#newestTick)) {
        this.#newestTick = sample.tick;
      }
      if (this.#newestTick !== null && tickDistance32(this.#newestTick, sample.tick) > this.#historyTicks) continue;
      if (this.#seen.has(sample.tick)) continue;
      validateSample(sample);
      this.#seen.add(sample.tick);
      accepted.push(sample);
    }

    this.#prune();
    accepted.sort((a, b) => tickDistance32(this.#newestTick, b.tick) - tickDistance32(this.#newestTick, a.tick));
    return { packet, accepted };
  }

  #prune() {
    if (this.#newestTick === null) return;
    for (const tick of this.#seen) {
      if (tickDistance32(this.#newestTick, tick) > this.#historyTicks) this.#seen.delete(tick);
    }
  }
}

export function isTickNewer32(candidate, reference) {
  assertUint32(candidate, "candidate");
  assertUint32(reference, "reference");
  if (candidate === reference) return false;
  return ((candidate - reference) >>> 0) < 0x80000000;
}

export function tickDistance32(newer, older) {
  assertUint32(newer, "newer");
  assertUint32(older, "older");
  return (newer - older) >>> 0;
}

function validateSample(sample) {
  if (!Number.isFinite(sample.moveX) || !Number.isFinite(sample.moveY)) throw new TypeError("movement must be finite");
  if (Math.abs(sample.moveX) > 1.001 || Math.abs(sample.moveY) > 1.001) throw new RangeError("movement axis outside normalized range");
  if (!Number.isFinite(sample.facing)) throw new TypeError("facing must be finite");
}

function assertUint32(value, name) {
  if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) throw new RangeError(`${name} must be a uint32`);
}

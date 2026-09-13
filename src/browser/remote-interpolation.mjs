import { NETWORK } from "../network/constants.mjs";

export function createRemoteInterpolator({ maxSamplesPerEntity = 3 } = {}) {
  if (!Number.isInteger(maxSamplesPerEntity) || maxSamplesPerEntity < 2 || maxSamplesPerEntity > 8) {
    throw new RangeError("maxSamplesPerEntity must be an integer in [2, 8]");
  }
  const tracks = new Map();

  return {
    push(entity, serverTick) {
      if (!entity || !Number.isInteger(entity.netId)) throw new TypeError("entity with netId is required");
      let samples = tracks.get(entity.netId);
      if (!samples) {
        samples = [];
        tracks.set(entity.netId, samples);
      }
      const sample = {
        serverTick: serverTick >>> 0,
        x: entity.x,
        y: entity.y,
        facing: entity.facing,
        hp: entity.hp,
        guard: entity.guard,
        action: entity.action,
        flags: entity.flags,
      };
      const last = samples.at(-1);
      if (last && last.serverTick === sample.serverTick) samples[samples.length - 1] = sample;
      else samples.push(sample);
      if (samples.length > maxSamplesPerEntity) samples.splice(0, samples.length - maxSamplesPerEntity);
    },
    remove(netId) { tracks.delete(netId); },
    clear() { tracks.clear(); },
    sample(netId, renderServerTick, target = {}) {
      const samples = tracks.get(netId);
      if (!samples?.length) return null;
      if (samples.length === 1 || renderServerTick <= samples[0].serverTick) {
        return copySample(samples[0], target);
      }
      let older = samples[0];
      let newer = samples.at(-1);
      for (let index = 1; index < samples.length; index += 1) {
        if (renderServerTick <= samples[index].serverTick) {
          older = samples[index - 1];
          newer = samples[index];
          break;
        }
      }
      const span = Math.max(1, newer.serverTick - older.serverTick);
      let alpha = (renderServerTick - older.serverTick) / span;
      const maxExtrapolationTicks = Math.max(
        1,
        Math.round((NETWORK.reconciliation.maxRemoteExtrapolationMs / 1000) * NETWORK.serverSimulationHz),
      );
      alpha = Math.min(1 + maxExtrapolationTicks / span, Math.max(0, alpha));
      target.x = older.x + (newer.x - older.x) * alpha;
      target.y = older.y + (newer.y - older.y) * alpha;
      target.facing = interpolateAngle(older.facing, newer.facing, Math.min(1, alpha));
      target.hp = newer.hp;
      target.guard = newer.guard;
      target.action = newer.action;
      target.flags = newer.flags;
      target.serverTick = newer.serverTick;
      return target;
    },
  };
}

function copySample(sample, target) {
  Object.assign(target, sample);
  return target;
}

function interpolateAngle(a, b, t) {
  const tau = Math.PI * 2;
  let delta = ((b - a + Math.PI) % tau + tau) % tau - Math.PI;
  if (delta === -Math.PI) delta = Math.PI;
  return a + delta * t;
}

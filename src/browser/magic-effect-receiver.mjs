// P4: inactive receiver for proposed server-to-client semantic magic FX.
// This module never sends packets, creates combat actions, or changes state.
// Only a future authenticated server snapshot/effect channel may call ingest.
import { PARTICLE_KINDS } from "./magic-particle-pool.mjs";

export const MAGIC_FX_WIRE_VERSION = 1;
export const MAGIC_FX_PACKET_BYTES = 32;
export const MAGIC_FX_MAX_TTL_TICKS = 120;
export const MAGIC_FX_MAX_VIEW_RADIUS = 1500;
const MAGIC_FX_MAX_SEEN = 256;
const MAGIC_FX_FUTURE_GRACE = 3;
const MAX_COORDINATE = 1_000_000;
const UINT32_MAX = 0xffffffff;

function uint32(value) {
  return Number.isInteger(value) && value >= 0 && value <= UINT32_MAX;
}

/**
 * Decode an exact 32-byte proposed magic FX envelope. It has a distinct
 * magic marker and MUST NOT be installed as a live PACKET_TYPE until reviewed.
 *
 * The packet is presentation-only: no damage, hit, mana, target or spell
 * effect can be inferred from any field or emitted client particle.
 */
export function decodeMagicEffectPacket(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength !== MAGIC_FX_PACKET_BYTES
    || bytes[0] !== 0x4d || bytes[1] !== 0x45
    || bytes[2] !== MAGIC_FX_WIRE_VERSION
    || bytes[3] >= PARTICLE_KINDS.length
    || bytes[30] !== 0 || bytes[31] !== 0) return null;

  const wire = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const zoneId = wire.getUint32(4, true);
  const eventId = wire.getUint32(8, true);
  const serverTick = wire.getUint32(12, true);
  const seed = wire.getUint32(16, true);
  const x = wire.getInt32(20, true) / 4;
  const y = wire.getInt32(24, true) / 4;
  const intensityByte = bytes[28];
  const ttlTicks = bytes[29];
  if (zoneId === 0 || eventId === 0 || intensityByte === 0
    || ttlTicks === 0 || ttlTicks > MAGIC_FX_MAX_TTL_TICKS
    || !Number.isFinite(x) || !Number.isFinite(y)
    || Math.abs(x) > MAX_COORDINATE || Math.abs(y) > MAX_COORDINATE) return null;

  return { zoneId, eventId, serverTick, seed, x, y,
    kind: PARTICLE_KINDS[bytes[3]], intensity: intensityByte / 255, ttlTicks };
}

function validView(view) {
  return uint32(view?.zoneId) && view.zoneId !== 0
    && uint32(view?.serverTick)
    && Number.isFinite(view?.x) && Math.abs(view.x) <= MAX_COORDINATE
    && Number.isFinite(view?.y) && Math.abs(view.y) <= MAX_COORDINATE
    && Number.isFinite(view?.radius)
    && view.radius >= 0 && view.radius <= MAGIC_FX_MAX_VIEW_RADIUS;
}

/**
 * Renderer-facing ingest only. No live WebTransport integration.
 *
 * The caller MUST provide view.zoneId, position and serverTick from the
 * authenticated, authoritative snapshot state. Never accept them from the
 * untrusted effect bytes or a player-supplied URL flag.
 */
export function createMagicEffectReceiver(pool) {
  if (!pool || typeof pool.emit !== "function" || typeof pool.clear !== "function") {
    throw new TypeError("a valid cosmetic particle pool is required");
  }
  let currentZone = 0;
  let highestEventId = 0;
  const seen = new Set();
  let accepted = 0;
  let rejected = 0;
  let duplicates = 0;

  function reset(zoneId = 0) {
    if (!uint32(zoneId)) throw new RangeError("zone ID must be a u32");
    currentZone = zoneId;
    highestEventId = 0;
    seen.clear();
    pool.clear();
  }

  return Object.freeze({
    /**
     * @returns number of cosmetic particles spawned (never gameplay outcomes)
     */
    ingest(bytes, view) {
      if (!validView(view)) { rejected += 1; return 0; }
      if (view.zoneId !== currentZone) reset(view.zoneId);

      const effect = decodeMagicEffectPacket(bytes);
      if (!effect || effect.zoneId !== view.zoneId) { rejected += 1; return 0; }

      // Wrap-safe 32-bit tick comparison, with a strict future tolerance.
      const age = (view.serverTick - effect.serverTick) >>> 0;
      if (age >= effect.ttlTicks) {
        const future = (effect.serverTick - view.serverTick) >>> 0;
        if (future > MAGIC_FX_FUTURE_GRACE) { rejected += 1; return 0; }
      }

      const dx = effect.x - view.x;
      const dy = effect.y - view.y;
      if (Math.abs(dx) > view.radius || Math.abs(dy) > view.radius
        || dx * dx + dy * dy > view.radius * view.radius) {
        rejected += 1;
        return 0;
      }

      if (seen.has(effect.eventId)
        || (highestEventId > MAGIC_FX_MAX_SEEN
          && effect.eventId <= highestEventId - MAGIC_FX_MAX_SEEN)) {
        duplicates += 1;
        return 0;
      }

      // Drop sufficiently old/out-of-window events even after the set prunes.
      if (effect.eventId > highestEventId) highestEventId = effect.eventId;
      seen.add(effect.eventId);
      for (const id of seen) {
        if (id + MAGIC_FX_MAX_SEEN <= highestEventId) seen.delete(id);
      }
      accepted += 1;
      return pool.emit(effect, { x: view.x, y: view.y, radius: view.radius });
    },
    reset,
    metrics() {
      return { zoneId: currentZone, accepted, rejected, duplicates, remembered: seen.size };
    },
  });
}

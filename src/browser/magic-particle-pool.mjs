// P1: client-only visual particle pool. No gameplay, damage, replication,
// random globals, timers, canvas ownership, or persistent data.
export const PARTICLE_KINDS = Object.freeze(["fire", "ice", "lightning", "wind", "arcane"]);
export const PARTICLE_QUALITY = Object.freeze({
  low: Object.freeze({ maxActive: 64, perBurst: 8 }),
  medium: Object.freeze({ maxActive: 192, perBurst: 16 }),
  high: Object.freeze({ maxActive: 384, perBurst: 32 }),
});
const EFFECTS = Object.freeze([
  Object.freeze({ speed: 190, lifeMs: 540, spread: 12 }),
  Object.freeze({ speed: 105, lifeMs: 780, spread: 10 }),
  Object.freeze({ speed: 255, lifeMs: 260, spread: 8 }),
  Object.freeze({ speed: 145, lifeMs: 660, spread: 14 }),
  Object.freeze({ speed: 120, lifeMs: 880, spread: 11 }),
]);
const MAX_COORDINATE = 1_000_000;
const MAX_VIEW_RADIUS = 100_000;
const TWO_PI = Math.PI * 2;

function validCoordinate(value) {
  return Number.isFinite(value) && Math.abs(value) <= MAX_COORDINATE;
}

function validView(view) {
  return view && validCoordinate(view.x) && validCoordinate(view.y)
    && Number.isFinite(view.radius) && view.radius >= 0 && view.radius <= MAX_VIEW_RADIUS;
}

function seededRandom(seed, kind) {
  let state = (seed ^ Math.imul(kind + 1, 0x9e3779b1)) >>> 0;
  // Nonzero state keeps xorshift valid even for zero seeds.
  if (state === 0) state = 0x6d2b79f5;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

/**
 * All particles are non-authoritative. The server must independently
 * calculate impacts; this pool must never be used for collision or targeting.
 *
 * Coordinates are in world units; the caller converts to screen/canvas space.
 * Events are expected from a future validated server-owned spell event stream.
 */
export function createMagicParticlePool({ capacity = 384, quality = "medium" } = {}) {
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 4096) {
    throw new RangeError("capacity must be an integer from 1 to 4096");
  }
  if (!Object.hasOwn(PARTICLE_QUALITY, quality)) {
    throw new RangeError("unrecognized particle quality preset");
  }

  const positionX = new Float32Array(capacity);
  const positionY = new Float32Array(capacity);
  const velocityX = new Float32Array(capacity);
  const velocityY = new Float32Array(capacity);
  const remainingMs = new Float32Array(capacity);
  const lifetimeMs = new Float32Array(capacity);
  const kindIds = new Uint8Array(capacity);
  const occupied = new Uint8Array(capacity);
  let activeCount = 0;
  let nextSlot = 0;
  let dropped = 0;
  let culled = 0;

  function retire(slot) {
    occupied[slot] = 0;
    activeCount -= 1;
  }

  return Object.freeze({
    emit(event, view) {
      const kind = PARTICLE_KINDS.indexOf(event?.kind);
      if (kind < 0 || !validView(view) || !validCoordinate(event.x)
        || !validCoordinate(event.y) || !Number.isInteger(event.seed)
        || event.seed < 0 || event.seed > 0xffffffff
        || !Number.isFinite(event.intensity ?? 1)
        || (event.intensity ?? 1) < 0 || (event.intensity ?? 1) > 1) {
        return 0;
      }

      const effect = EFFECTS[kind];
      const radius = view.radius + effect.spread;
      const diffX = event.x - view.x;
      const diffY = event.y - view.y;
      if (Math.abs(diffX) > radius || Math.abs(diffY) > radius
        || diffX * diffX + diffY * diffY > radius * radius) {
        culled += 1;
        return 0;
      }

      const preset = PARTICLE_QUALITY[quality];
      const planned = Math.ceil(preset.perBurst * (event.intensity ?? 1));
      if (planned === 0) return 0;
      const random = seededRandom(event.seed, kind);
      let emitted = 0;
      const activeLimit = Math.min(capacity, preset.maxActive);

      for (let index = 0; index < planned && activeCount < activeLimit; index += 1) {
        let slot = nextSlot;
        let searched = 0;
        while (occupied[slot] && searched < capacity) {
          slot = (slot + 1) % capacity;
          searched += 1;
        }
        if (searched === capacity) break;
        nextSlot = (slot + 1) % capacity;

        const angle = random() * TWO_PI;
        const speed = effect.speed * (0.45 + random() * 0.65);
        const radial = random() * effect.spread;
        const life = effect.lifeMs * (0.65 + random() * 0.35);
        positionX[slot] = event.x + Math.cos(angle) * radial;
        positionY[slot] = event.y + Math.sin(angle) * radial;
        velocityX[slot] = Math.cos(angle) * speed;
        velocityY[slot] = Math.sin(angle) * speed;
        remainingMs[slot] = life;
        lifetimeMs[slot] = life;
        kindIds[slot] = kind;
        occupied[slot] = 1;
        activeCount += 1;
        emitted += 1;
      }
      dropped += planned - emitted;
      return emitted;
    },

    advance(elapsedMs) {
      if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return activeCount;
      // Backgrounded tabs should expire particles immediately after a pause.
      // Position integration is capped to avoid huge displacements on resume.
      const seconds = Math.min(elapsedMs, 50) / 1000;
      for (let slot = 0; slot < capacity; slot += 1) {
        if (!occupied[slot]) continue;
        remainingMs[slot] -= elapsedMs;
        if (remainingMs[slot] <= 0) {
          retire(slot);
          continue;
        }
        positionX[slot] += velocityX[slot] * seconds;
        positionY[slot] += velocityY[slot] * seconds;
      }
      return activeCount;
    },

    forEachVisible(view, draw) {
      if (!validView(view) || typeof draw !== "function") return 0;
      let count = 0;
      const squaredRadius = view.radius * view.radius;
      for (let slot = 0; slot < capacity; slot += 1) {
        if (!occupied[slot]) continue;
        const dx = positionX[slot] - view.x;
        const dy = positionY[slot] - view.y;
        if (Math.abs(dx) > view.radius || Math.abs(dy) > view.radius
          || dx * dx + dy * dy > squaredRadius) continue;
        draw(positionX[slot], positionY[slot],
          remainingMs[slot] / lifetimeMs[slot], PARTICLE_KINDS[kindIds[slot]]);
        count += 1;
      }
      return count;
    },

    setQuality(nextQuality) {
      if (!Object.hasOwn(PARTICLE_QUALITY, nextQuality)) {
        throw new RangeError("unrecognized particle quality preset");
      }
      quality = nextQuality;
      const limit = Math.min(capacity, PARTICLE_QUALITY[quality].maxActive);
      // Drop visual-only excess immediately when scaling down.
      for (let slot = capacity - 1; slot >= 0 && activeCount > limit; slot -= 1) {
        if (occupied[slot]) retire(slot);
      }
    },

    clear() {
      occupied.fill(0);
      activeCount = 0;
      nextSlot = 0;
      dropped = 0;
      culled = 0;
    },

    metrics() {
      return { active: activeCount, capacity, quality, dropped, culled };
    },
  });
}

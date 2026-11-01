import { AUTHORED_MAPS, MAP_IDS } from '../world/authored-maps.mjs';
import { projectAuthoritativeCombat } from '../combat/authoritative-combat-view.mjs';

// Presentation coordinates only. The Rust World alone owns actual positions,
// collision, map membership and respawn; this map has no authority over them.
const world = AUTHORED_MAPS[MAP_IDS.overworld];
export const VISUAL_WORLD9_SCALE = 0.025;
export const WORLD9_VISUAL_ORIGIN = Object.freeze({
  x: world.city.x + world.city.w / 2,
  y: world.city.y + world.city.h / 2
});

export function projectAuthoritativePosition(x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)
    || x < 0 || y < 0 || x > world.width || y > world.height) {
    return null;
  }
  return Object.freeze({
    x: (x - WORLD9_VISUAL_ORIGIN.x) * VISUAL_WORLD9_SCALE,
    y: 0,
    z: (y - WORLD9_VISUAL_ORIGIN.y) * VISUAL_WORLD9_SCALE
  });
}

export function createAuthoritativeSnapshotView({ create, update, remove }) {
  if (![create, update, remove].every(fn => typeof fn === 'function')) {
    throw new TypeError('actor view must provide create, update and remove callbacks');
  }
  const actors = new Map();

  function reconcile(state, ownNetId = null) {
    if (!(state instanceof Map)) throw new TypeError('authoritative state must be a Map');
    const validIds = new Set();
    for (const [netId, entity] of state) {
      if (!Number.isInteger(netId) || netId < 0 || !entity || entity.netId !== netId) continue;
      const position = projectAuthoritativePosition(entity.x, entity.y);
      if (!position) continue;
      validIds.add(netId);
      const pose = Object.freeze({
        netId,
        position,
        facing: Number.isFinite(entity.facing) ? entity.facing : 0,
        hp: entity.hp,
        guard: entity.guard,
        stamina: entity.stamina,
        action: entity.action,
        serverTick: entity.serverTick,
        combat: projectAuthoritativeCombat(entity),
        isOwn: Number.isInteger(ownNetId) && ownNetId === netId
      });
      if (!actors.has(netId)) {
        actors.set(netId, create(pose));
      } else {
        update(actors.get(netId), pose);
      }
    }
    for (const [netId, handle] of actors) {
      if (validIds.has(netId)) continue;
      remove(handle, netId);
      actors.delete(netId);
    }
    return Object.freeze({ count: actors.size });
  }

  function clear() {
    for (const [netId, handle] of actors) remove(handle, netId);
    actors.clear();
  }

  return Object.freeze({ reconcile, clear, get count() { return actors.size; } });
}

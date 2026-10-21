// Optional, render-only 3D-derived knight sprite presentation.
// Combat, hitboxes, prediction and authoritative snapshots remain untouched.
import { COMBAT_ACTION } from "../src/browser/combat-readability.mjs";

export const KNIGHT_FRAME_PX = 160;
export const KNIGHT_ROLL_PRESENTATION_MS = 350;
// Owner-approved A2.10 knight visual scale. This affects ONLY the optional
// knight sprite renderer, not gameplay positions, roll physics or hitboxes.
// &knights=1 uses 120%; &knights=1&knightScale=100 previews the old presentation.
export const KNIGHT_PRESENTATION_SCALE = 1.2;
export function knightPresentationRect(rolling, scale = KNIGHT_PRESENTATION_SCALE) {
  if (scale !== 1 && scale !== KNIGHT_PRESENTATION_SCALE) {
    throw new RangeError("Only approved baseline/120% knight visual scales are supported");
  }
  const baseSize = rolling ? 112 : 80;
  const size = Math.round(baseSize * scale);
  return {
    x: -size / 2,
    y: (rolling ? -65 : -52) * scale,
    width: size, height: size,
  };
}
export const KNIGHT_DIRECTIONS = Object.freeze([
  "south", "southwest", "west", "northwest", "north", "northeast", "east", "southeast",
]);
export const KNIGHT_CLIPS = Object.freeze({
  silver_walk: 8, silver_idle: 4, silver_sprint: 8, silver_jump: 6, silver_roll: 8,
  t1_walk: 8, t1_attack: 8, t1_block: 4, t1_roll: 8,
});
const ATTACKS = new Set([
  COMBAT_ACTION.attackWindup, COMBAT_ACTION.attackActive, COMBAT_ACTION.attackRecovery,
  COMBAT_ACTION.attackLeftWindup, COMBAT_ACTION.attackLeftActive, COMBAT_ACTION.attackLeftRecovery,
  COMBAT_ACTION.attackRightWindup, COMBAT_ACTION.attackRightActive, COMBAT_ACTION.attackRightRecovery,
  COMBAT_ACTION.heavyAttackWindup, COMBAT_ACTION.heavyAttackActive, COMBAT_ACTION.heavyAttackRecovery,
  COMBAT_ACTION.runningAttackWindup, COMBAT_ACTION.runningAttackActive, COMBAT_ACTION.runningAttackRecovery,
  COMBAT_ACTION.jumpAttackWindup, COMBAT_ACTION.jumpAttackActive, COMBAT_ACTION.jumpAttackRecovery,
]);
export function knightDirectionIndex(facing) {
  if (!Number.isFinite(facing)) return 0;
  const turn = Math.PI * 2;
  return ((Math.round((facing - Math.PI / 2) / (Math.PI / 4)) % 8) + 8) % 8;
}

// Actor kind must come from a validated Core/AI roster. A network-locality
// flag is NEVER permission to draw a Sentinel for another human player.
export function knightClip(action, actorKind, speed = 0, moving = false) {
  if (actorKind !== "player" && actorKind !== "npc") return null;
  if (action === COMBAT_ACTION.dodge || action === COMBAT_ACTION.dodgeRecovery) {
    return actorKind === "npc" ? "t1_roll" : "silver_roll";
  }
  // The optional atlases cover only a subset of authoritative Combat actions.
  // An unrelated idle/walk pose would falsely depict readiness during kicks,
  // stun, knockdown, jump attacks, or committed local sword attacks. Let the
  // existing combat renderer draw those actions and their truthful tells.
  if (actorKind === "npc") {
    if (action === COMBAT_ACTION.block) return "t1_block";
    if (ATTACKS.has(action)) return "t1_attack";
    return action === COMBAT_ACTION.idle ? "t1_walk" : null;
  }
  if (action === COMBAT_ACTION.jump) return "silver_jump";
  if (action !== COMBAT_ACTION.idle) return null;
  if (moving && speed >= 280) return "silver_sprint";
  return moving ? "silver_walk" : "silver_idle";
}

export function spriteAtlasRect(facing, frame, frames) {
  const direction = knightDirectionIndex(facing);
  const index = ((Math.floor(frame) % frames) + frames) % frames;
  return { x: index * KNIGHT_FRAME_PX, y: direction * KNIGHT_FRAME_PX,
    width: KNIGHT_FRAME_PX, height: KNIGHT_FRAME_PX };
}

export function createKnightSpriteRenderer({ ImageCtor = Image,
  assetBase = new URL("./assets/knights/", import.meta.url),
  presentationScale = KNIGHT_PRESENTATION_SCALE } = {}) {
  // Fail closed for unsupported visual transforms rather than silently
  // scaling A3 source art to arbitrary dimensions.
  knightPresentationRect(false, presentationScale);
  const atlases = new Map();
  const states = new Map();
  for (const [name] of Object.entries(KNIGHT_CLIPS)) {
    const image = new ImageCtor();
    const atlas = { image, ready: false };
    image.onload = () => {
      atlas.ready = image.naturalWidth === KNIGHT_CLIPS[name] * KNIGHT_FRAME_PX
        && image.naturalHeight === 8 * KNIGHT_FRAME_PX;
    };
    image.onerror = () => { atlas.ready = false; };
    image.decoding = "async";
    image.src = new URL(name + ".webp", assetBase).href;
    atlases.set(name, atlas);
  }
  return {
    draw(ctx, fighter, { remote = false, actorKind = null, rotation = 0, nowMs = performance.now() } = {}) {
      if (actorKind !== "player" && actorKind !== "npc") return false;
      const key = remote ? actorKind + ":remote:" + fighter.netId : actorKind + ":local";
      let state = states.get(key);
      if (!state) {
        state = { x: fighter.x, y: fighter.y, atMs: nowMs, lastMoveMs: -Infinity,
          speed: 0, cycle: 0, clip: null, clipStartedMs: nowMs };
        states.set(key, state);
      }
      const dt = Math.max(0, nowMs - state.atMs);
      const dist = Math.hypot(fighter.x - state.x, fighter.y - state.y);
      // Ignore reconnects, packet gaps and teleport discontinuities.
      if (dt > 0 && dt <= 250 && dist > 0.15 && dist < 75) {
        state.speed = dist * 1000 / dt;
        state.lastMoveMs = nowMs;
        state.cycle = (state.cycle + dist / 68) % 1;
      } else if (dt > 250 || dist >= 75) {
        state.speed = 0;
      }
      state.x = fighter.x;
      state.y = fighter.y;
      state.atMs = nowMs;
      const moving = nowMs - state.lastMoveMs < 135;
      const clip = knightClip(fighter.action ?? COMBAT_ACTION.idle, actorKind, state.speed, moving);
      if (!clip) {
        // End the previous clip on unsupported states. A future roll must
        // start at frame zero rather than resume its previous final frame.
        state.clip = null;
        return false;
      }
      const atlas = atlases.get(clip);
      if (!atlas?.ready) return false;
      if (state.clip !== clip) {
        state.clip = clip;
        state.clipStartedMs = nowMs;
      }
      const frames = KNIGHT_CLIPS[clip];
      let frame;
      if (clip.endsWith("_walk") || clip.endsWith("_sprint")) {
        frame = moving ? Math.floor(state.cycle * frames) : 0;
      } else if (clip === "silver_idle") {
        frame = Math.floor(nowMs / 300) % frames;
      } else {
        const duration = clip.endsWith("_roll") ? KNIGHT_ROLL_PRESENTATION_MS
          : clip === "silver_jump" ? 430 : clip === "t1_block" ? 240 : 470;
        frame = Math.min(frames - 1, Math.floor((nowMs - state.clipStartedMs) / duration * frames));
      }
      const src = spriteAtlasRect(fighter.facing ?? 0, frame, frames);
      // The combat context is rotated for attack telegraphs; the sprite already
      // contains an eight-direction facing. Undo only that presentation rotation.
      ctx.save();
      ctx.rotate(-rotation);
      ctx.fillStyle = actorKind === "npc" ? "rgba(55, 32, 26, .45)" : "rgba(49, 38, 28, .45)";
      ctx.beginPath();
      ctx.ellipse(0, 11 * presentationScale, 20 * presentationScale,
        8 * presentationScale, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      // A2.11 keeps the visual sprite horizontally centered on the existing
      // fighter world origin, even when 112 * 1.2 rounds to 134 pixels.
      // Source atlas, combat geometry and A3 350ms cycle are unchanged.
      const rect = knightPresentationRect(clip.endsWith("_roll"), presentationScale);
      ctx.drawImage(atlas.image, src.x, src.y, src.width, src.height,
        rect.x, rect.y, rect.width, rect.height);
      ctx.restore();
      // Bounded cache: disconnected remote identities do not accumulate forever.
      if (states.size > 600) {
        for (const [id, cached] of states) {
          if (nowMs - cached.atMs > 30000) states.delete(id);
        }
      }
      return true;
    },
    loaded() {
      return [...atlases].filter(([,atlas]) => atlas.ready).map(([name]) => name);
    },
  };
}

// Pre-Alpha 0.1: original first-party Silver Knight visual-only renderer.
// Combat, hitboxes, prediction and authoritative snapshots remain untouched.
import { COMBAT_ACTION } from "../src/browser/combat-readability.mjs";

export const KNIGHT_FRAME_PX = 160;
export const KNIGHT_ROLL_PRESENTATION_MS = 350;
// Owner-approved A2.10 knight visual scale. This affects ONLY the optional
// knight sprite renderer, not gameplay positions, roll physics or hitboxes.
// Default Silver uses 120%; &knightScale=100 is a reviewed scale comparator.
export const KNIGHT_PRESENTATION_SCALE = 1.2;
// In Pre-Alpha with Knight art active there is no authenticated
// MainHand snapshot in the live client, do not paint the arena prototype's
// unconditional sword-shaped bar over the fallback circle. This does NOT
// provide an equipped sword sprite or turn visual art into item ownership.
export function showPrototypeWeaponStroke(knightVisualOptIn) {
  return knightVisualOptIn !== true;
}
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
// A remote Silver may remain partially visible after its actor origin leaves
// the viewport. Bound source Roll (the largest five-motion atlas), existing
// knockout scale, heavy lean and airborne lift in SCREEN pixels. This ONLY
// controls Canvas render culling; it cannot change interest, offscreen HUD,
// authoritative actor replication, camera or collision.
export function knightVisibilityMargin(zoom, scale = KNIGHT_PRESENTATION_SCALE) {
  if (!Number.isFinite(zoom) || zoom <= 0 || zoom > 1) {
    throw new RangeError("Valid presentation zoom required for Silver culling");
  }
  const rect = knightPresentationRect(true, scale);
  const x = Math.max(Math.abs(rect.x), Math.abs(rect.x + rect.width));
  const y = Math.max(Math.abs(rect.y), Math.abs(rect.y + rect.height));
  // Render-only maxima from current original Canvas presentation. Conservative
  // combination intentionally covers all motion poses, not a hitbox radius.
  const combatX = x * 1.38 + 16;
  const airborneY = y + 18;
  return Math.max(64, Math.ceil(Math.hypot(combatX, airborneY) * zoom));
}
export const KNIGHT_DIRECTIONS = Object.freeze([
  "south", "southwest", "west", "northwest", "north", "northeast", "east", "southeast",
]);
export const KNIGHT_CLIPS = Object.freeze({
  silver_walk: 8, silver_idle: 4, silver_sprint: 8, silver_jump: 6, silver_roll: 8,
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

// Pre-Alpha arena renders only authenticated human fighter snapshots.
// No Sentinel/NPC assets or alternative actor roles are bundled.
export function knightClip(action, actorKind, speed = 0, moving = false) {
  if (actorKind !== "player") return null;
  if (action === COMBAT_ACTION.dodge || action === COMBAT_ACTION.dodgeRecovery) {
    return actorKind === "npc" ? "t1_roll" : "silver_roll";
  }
  // Every authenticated human remains a Silver Knight. When no source clip
  // exists for an authoritative action, show the directional idle knight while
  // the existing Combat renderer independently paints attack/guard/stun/death
  // tells. This is presentation only; it never claims an action was idle.
  if (action === COMBAT_ACTION.jump) return "silver_jump";
  if (action !== COMBAT_ACTION.idle) return "silver_idle";
  if (moving && speed >= 280) return "silver_sprint";
  return moving ? "silver_walk" : "silver_idle";
}

// The first four original Silver atlases were baked with reversed horizontal
// camera traversal. This is a SOURCE-CLIP orientation fix, not actor facing,
// input direction, Combat or camera rotation. Roll and future art stay native.
const MIRRORED_HORIZONTAL_CLIPS = new Set(["silver_idle", "silver_walk", "silver_sprint", "silver_jump"]);
export function spriteAtlasRect(facing, frame, frames, clip = null, sourceArtVariant = "original") {
  if (!["original", "relit"].includes(sourceArtVariant)) throw new RangeError("Invalid original Silver source art variant");
  const sourceDirection = knightDirectionIndex(facing);
  // The owner-authorized Blender relight uses Roll-native camera directions.
  // Mirror ONLY the immutable dark legacy atlases, never the authentic rebake.
  const direction = sourceArtVariant === "original" && MIRRORED_HORIZONTAL_CLIPS.has(clip)
    ? (8 - sourceDirection) % 8 : sourceDirection;
  const index = ((Math.floor(frame) % frames) + frames) % frames;
  return { x: index * KNIGHT_FRAME_PX, y: direction * KNIGHT_FRAME_PX,
    width: KNIGHT_FRAME_PX, height: KNIGHT_FRAME_PX };
}

export function createKnightSpriteRenderer({ ImageCtor = Image,
  assetBase = new URL("./assets/knights/", import.meta.url),
  presentationScale = KNIGHT_PRESENTATION_SCALE,
  sourceArtVariant = "original" } = {}) {
  // Fail closed for unsupported visual transforms rather than silently
  // scaling A3 source art to arbitrary dimensions.
  knightPresentationRect(false, presentationScale);
  if (!["original", "relit"].includes(sourceArtVariant))
    throw new RangeError("Invalid original Silver source art variant");
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
    // Only a deliberate review URL can display the four source-authored,
    // size-matched Blender relights. Default five frozen Pre-Alpha atlases and
    // original 350ms Roll are unchanged; no new attack sprites are available.
    const file = sourceArtVariant === "relit" && MIRRORED_HORIZONTAL_CLIPS.has(name)
      ? "review/" + name + "_relit.webp" : name + ".webp";
    image.src = new URL(file, assetBase).href;
    atlases.set(name, atlas);
  }
  return {
    draw(ctx, fighter, { remote = false, actorKind = null, rotation = 0, visualLift = 0, nowMs = performance.now() } = {}) {
      if (actorKind !== "player") return false;
      // A fresh authenticated local player is a distinct animation timeline.
      // Never reuse the previous server actor's movement speed or late roll frame.
      const key = actorKind + (remote ? ":remote:" : ":local:") + fighter.netId;
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
      const requestedClip = knightClip(fighter.action ?? COMBAT_ACTION.idle, actorKind, state.speed, moving);
      // A missing/in-flight movement atlas falls back to the genuine Silver
      // idle atlas, never to the prototype circle. Keep the original action
      // telegraphs in the calling renderer.
      const clip = atlases.get(requestedClip)?.ready ? requestedClip : "silver_idle";
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
          : clip === "silver_jump" ? 430 : 470;
        frame = Math.min(frames - 1, Math.floor((nowMs - state.clipStartedMs) / duration * frames));
      }
      const src = spriteAtlasRect(fighter.facing ?? 0, frame, frames, clip, sourceArtVariant);
      // The combat context is rotated for attack telegraphs; the sprite already
      // contains an eight-direction facing. Undo only that presentation rotation.
      ctx.save();
      ctx.rotate(-rotation);
      // The caller lifts the airborne pose, but its floor shadow must remain
      // at the unlifted authoritative world origin. Undo lift for shadow only;
      // restore the original pose transform before drawing the real WebP.
      if (visualLift > 0) ctx.translate(0, visualLift);
      ctx.fillStyle = "rgba(49, 38, 28, .45)";
      ctx.beginPath();
      ctx.ellipse(0, 11 * presentationScale, 20 * presentationScale,
        8 * presentationScale, 0, 0, Math.PI * 2);
      ctx.fill();
      if (visualLift > 0) ctx.translate(0, -visualLift);
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

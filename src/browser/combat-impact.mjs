export const COMBAT_IMPACT_PROFILES = Object.freeze({
  "hit-confirm": Object.freeze({ freezeMs: 34, durationMs: 190, shakePx: 4.5, flashAlpha: 0.12, rays: 7 }),
  "damage-taken": Object.freeze({ freezeMs: 42, durationMs: 230, shakePx: 7, flashAlpha: 0.18, rays: 8 }),
  "block-confirm": Object.freeze({ freezeMs: 18, durationMs: 150, shakePx: 2.5, flashAlpha: 0.08, rays: 5 }),
  "guard-pressure": Object.freeze({ freezeMs: 22, durationMs: 170, shakePx: 3.5, flashAlpha: 0.10, rays: 6 }),
  "parry-success": Object.freeze({ freezeMs: 58, durationMs: 300, shakePx: 8, flashAlpha: 0.22, rays: 12 }),
  "parried": Object.freeze({ freezeMs: 52, durationMs: 280, shakePx: 7, flashAlpha: 0.18, rays: 10 }),
  "guard-broken": Object.freeze({ freezeMs: 66, durationMs: 330, shakePx: 9, flashAlpha: 0.24, rays: 13 }),
  "guard-break-confirm": Object.freeze({ freezeMs: 60, durationMs: 310, shakePx: 8, flashAlpha: 0.20, rays: 12 }),
  "kick-confirm": Object.freeze({ freezeMs: 38, durationMs: 220, shakePx: 6, flashAlpha: 0.14, rays: 8 }),
  "shoved": Object.freeze({ freezeMs: 42, durationMs: 240, shakePx: 7, flashAlpha: 0.17, rays: 8 }),
  "roll-impact": Object.freeze({ freezeMs: 32, durationMs: 210, shakePx: 5.5, flashAlpha: 0.12, rays: 7 }),
  "rolled-over": Object.freeze({ freezeMs: 38, durationMs: 230, shakePx: 6.5, flashAlpha: 0.15, rays: 8 }),
  "dodge-success": Object.freeze({ freezeMs: 0, durationMs: 160, shakePx: 1.5, flashAlpha: 0.05, rays: 4 }),
  "dodge-evaded": Object.freeze({ freezeMs: 0, durationMs: 140, shakePx: 1, flashAlpha: 0.04, rays: 3 }),
});

const INACTIVE = Object.freeze({
  active: false,
  feedback: "",
  freeze: false,
  progress: 1,
  shakeX: 0,
  shakeY: 0,
  flashAlpha: 0,
  rays: 0,
});

export function combatImpactProfile(feedback) {
  return COMBAT_IMPACT_PROFILES[feedback] ?? null;
}

export function createCombatImpactController() {
  let current = null;

  return {
    trigger(feedback, nowMs) {
      const profile = combatImpactProfile(feedback);
      if (!profile || !Number.isFinite(nowMs)) return null;
      current = { feedback, startedAt: nowMs, ...profile };
      return current;
    },

    sample(nowMs) {
      if (!current || !Number.isFinite(nowMs)) return INACTIVE;
      const ageMs = Math.max(0, nowMs - current.startedAt);
      if (ageMs >= current.durationMs) {
        current = null;
        return INACTIVE;
      }

      const progress = current.durationMs > 0 ? ageMs / current.durationMs : 1;
      const envelope = 1 - progress;
      const phase = ageMs * 0.19;
      return {
        active: true,
        feedback: current.feedback,
        freeze: ageMs < current.freezeMs,
        progress,
        shakeX: Math.sin(phase + 0.7) * current.shakePx * envelope,
        shakeY: Math.cos(phase * 1.37 + 1.1) * current.shakePx * 0.72 * envelope,
        flashAlpha: current.flashAlpha * envelope,
        rays: current.rays,
      };
    },

    clear() {
      current = null;
    },
  };
}

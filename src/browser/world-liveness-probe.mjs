// Read-only, opt-in rendering diagnostics for localhost authored-world staging.
export function isWorldLivenessProbeEnabled(location) {
  if (!["localhost", "127.0.0.1", "[::1]"].includes(location.hostname) || location.protocol !== "http:") return false;
  const query = new URLSearchParams(location.search);
  return query.get("world") === "1" && !query.has("scenario") && query.get("uiLivenessProbe") === "1";
}
export function createWorldLivenessProbe() {
  const state = { snapshots: 0, snapshotTick: null, snapshotAt: null,
    frames: 0, frameAt: null, paints: 0, paintStartAt: null, paintAt: null,
    paintDurationMs: null, maxPaintMs: 0, visibleTiles: 0, createdTiles: 0,
    statusUpdates: 0, statusTick: null, statusAt: null };
  const valid = value => Number.isFinite(value) && value >= 0;
  return {
    recordSnapshot(tick, at) {
      if (!Number.isInteger(tick) || tick < 0 || tick > 0xffffffff || !valid(at)) return;
      state.snapshots++; state.snapshotTick = tick; state.snapshotAt = at;
    },
    recordFrame(at) {
      if (!valid(at)) return;
      state.frames++; state.frameAt = at;
    },
    startPaint(at) { if (valid(at)) state.paintStartAt = at; },
    endPaint(at, durationMs, stats) {
      if (!valid(at) || !valid(durationMs)) return;
      state.paints++; state.paintAt = at; state.paintDurationMs = Math.round(durationMs * 10) / 10;
      state.maxPaintMs = Math.max(state.maxPaintMs, state.paintDurationMs);
      state.visibleTiles = Number.isInteger(stats?.visible) ? stats.visible : 0;
      state.createdTiles = Number.isInteger(stats?.created) ? stats.created : 0;
    },
    recordStatus(text, at) {
      if (typeof text !== "string" || !valid(at)) return;
      state.statusUpdates++; state.statusAt = at;
      const tick = /server tick (\d+)/.exec(text);
      state.statusTick = tick ? Number(tick[1]) : null;
    },
    snapshot(at) {
      if (!valid(at)) return null;
      const age = t => t === null ? null : Math.max(0, Math.round(at - t));
      return { snapshots: state.snapshots, snapshotTick: state.snapshotTick,
        snapshotAgeMs: age(state.snapshotAt), frames: state.frames, frameAgeMs: age(state.frameAt),
        paints: state.paints, paintStartAgeMs: age(state.paintStartAt), paintAgeMs: age(state.paintAt),
        paintDurationMs: state.paintDurationMs, maxPaintMs: state.maxPaintMs,
        visibleTiles: state.visibleTiles, createdTiles: state.createdTiles,
        statusUpdates: state.statusUpdates, statusTick: state.statusTick,
        statusAgeMs: age(state.statusAt) };
    },
  };
}

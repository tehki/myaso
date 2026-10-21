// P2 visual QA lab only. No gameplay, network calls or spell activation.
import { createMagicParticlePool, PARTICLE_KINDS } from "../src/browser/magic-particle-pool.mjs";
import { drawMagicParticles } from "../src/browser/magic-particle-renderer.mjs";
import { ARENA_VIEW_ZOOM } from "../src/browser/arena-viewport.mjs";

const canvas = document.querySelector("#magic-preview-canvas");
const ctx = canvas?.getContext("2d", { alpha: false });
const buttons = [...document.querySelectorAll("#effect-controls button[data-kind]")];
const quality = document.querySelector("#quality");
const metrics = document.querySelector("#metrics");

if (!ctx || !quality || !metrics) throw new Error("Visual lab canvas is unavailable");

const pool = createMagicParticlePool({ quality: "medium" });
const camera = Object.freeze({ x: 0, y: 0 });
const view = Object.freeze({
  x: 0, y: 0,
  radius: Math.hypot(canvas.width / 2, canvas.height / 2) / ARENA_VIEW_ZOOM,
});
let selectedKind = "fire";
let seed = 1;
let lastNow = null;
let lastMetricMs = -Infinity;
let animationFrameId = 0;

function emit(kind, worldX, worldY) {
  if (!PARTICLE_KINDS.includes(kind)) return;
  pool.emit({ kind, x: worldX, y: worldY, seed: seed++, intensity: 1 }, view);
}

for (const button of buttons) {
  button.addEventListener("click", () => {
    const next = button.dataset.kind;
    if (!PARTICLE_KINDS.includes(next)) return;
    selectedKind = next;
    for (const candidate of buttons) {
      candidate.setAttribute("aria-pressed", String(candidate.dataset.kind === next));
    }
    emit(next, 0, 0);
  });
}

quality.addEventListener("change", () => {
  const choice = quality.value;
  if (!["low", "medium", "high"].includes(choice)) return;
  pool.setQuality(choice);
});

canvas.addEventListener("pointerdown", (event) => {
  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;
  const screenX = (event.clientX - rect.left) * canvas.width / rect.width;
  const screenY = (event.clientY - rect.top) * canvas.height / rect.height;
  emit(selectedKind,
    (screenX - canvas.width / 2) / ARENA_VIEW_ZOOM,
    (screenY - canvas.height / 2) / ARENA_VIEW_ZOOM);
});

function drawBackdrop() {
  const w = canvas.width, h = canvas.height;
  ctx.fillStyle = "#1b292f";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(207, 206, 164, 0.09)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= w; x += 48) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
  }
  for (let y = 0; y <= h; y += 48) {
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
  }
  ctx.stroke();
  ctx.strokeStyle = "rgba(240, 218, 156, 0.28)";
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, 42, 0, Math.PI * 2);
  ctx.stroke();
}

function frame(now) {
  if (document.hidden) {
    animationFrameId = 0;
    return;
  }
  const elapsed = lastNow === null ? 0 : Math.max(0, now - lastNow);
  lastNow = now;
  pool.advance(elapsed);
  drawBackdrop();
  drawMagicParticles(ctx, pool, camera, canvas.width, canvas.height);
  if (now - lastMetricMs >= 250) {
    const m = pool.metrics();
    metrics.textContent = `Cosmetic particles: ${m.active}/${m.capacity} · Quality: ${m.quality} · Skipped by budget: ${m.dropped} · Culled effects: ${m.culled}`;
    lastMetricMs = now;
  }
  animationFrameId = requestAnimationFrame(frame);
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    animationFrameId = 0;
    lastNow = null;
    pool.clear();
  } else if (!animationFrameId) {
    animationFrameId = requestAnimationFrame(frame);
  }
});

emit("fire", 0, 0);
animationFrameId = requestAnimationFrame(frame);

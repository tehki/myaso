import { NETWORK } from "../src/network/constants.mjs";
import { reconcilePrediction } from "../src/browser/reconciliation.mjs";
import { connectAuthoritativeClient, parseSha256Hex } from "./authoritative-client.mjs";

const params = new URLSearchParams(location.search);
const server = params.get("server");
const cert = params.get("cert");
const durationMs = clampNumber(Number(params.get("duration") ?? 4000), 2000, 12000);
const stressEntities = clampNumber(Number(params.get("stress") ?? 128), 0, 512);
const canvas = document.querySelector("#arena");
const ctx = canvas.getContext("2d", { alpha: false });
const status = document.querySelector("#status");

window.__MYASO_FLIGHT_RESULT__ = null;
window.__MYASO_FLIGHT_ERROR__ = null;

if (!server) fail(new Error("flight requires ?server=https://host:port/game"));

const frameDeltas = [];
const corrections = [];
let longTasks = 0;
let snapshots = 0;
let acknowledgements = 0;
let sentInputs = 0;
let maxPredictionHistory = 0;
let latestAuthoritativeOwn = null;
let reliableBaselineAt = null;
let firstBackgroundReliableMs = null;
let reliableCatchups = 0;
let reliableAdvancedEntities = 0;
let maxReliableAdvancedEntities = 0;
let maxAuthoritativeEntities = 0;
let reliableBaselineEntities = 0;
let client = null;
let clientTick = 1;
let lastFrameAt = 0;
let accumulatorMs = 0;
let predictionSteps = 0;
let startAt = 0;
let finished = false;
const predictionStepMs = 1000 / NETWORK.clientPredictionHz;
const sendEveryPredictionSteps = Math.round(NETWORK.clientPredictionHz / NETWORK.inputSendHz);
const local = { x: 0, y: 0, facing: 0, initialized: false };

if (globalThis.PerformanceObserver?.supportedEntryTypes?.includes("longtask")) {
  const observer = new PerformanceObserver((list) => { longTasks += list.getEntries().length; });
  observer.observe({ type: "longtask", buffered: true });
}

try {
  const webTransportOptions = cert
    ? { serverCertificateHashes: [{ algorithm: "sha-256", value: parseSha256Hex(cert) }] }
    : undefined;
  client = await connectAuthoritativeClient({
    webTransportUrl: server,
    webTransportOptions,
    onProtocolError(error) { fail(error); },
    onSnapshot(_result, state) {
      snapshots += 1;
      maxAuthoritativeEntities = Math.max(maxAuthoritativeEntities, state.size);
      const ownId = client?.playerNetId;
      const own = ownId ? state.get(ownId) : null;
      if (!own) return;
      latestAuthoritativeOwn = own;
      if (!local.initialized) restoreAuthoritative(own);
    },
    onReliableSnapshot(_result, state, meta = {}) {
      const now = performance.now();
      maxAuthoritativeEntities = Math.max(maxAuthoritativeEntities, state.size);
      const advanced = Array.isArray(meta.advancedIds) ? meta.advancedIds.length : 0;
      if (reliableBaselineAt === null) {
        reliableBaselineAt = now;
        reliableBaselineEntities = state.size;
        return;
      }
      reliableCatchups += 1;
      reliableAdvancedEntities += advanced;
      maxReliableAdvancedEntities = Math.max(maxReliableAdvancedEntities, advanced);
      if (firstBackgroundReliableMs === null && advanced > 0) firstBackgroundReliableMs = now - reliableBaselineAt;
    },
    onAck() {
      acknowledgements += 1;
      const ownId = client?.playerNetId;
      const own = ownId ? client.state.get(ownId) : null;
      if (!own) return;
      latestAuthoritativeOwn = own;
      if (local.initialized) corrections.push(Math.hypot(own.x - local.x, own.y - local.y));
      reconcilePrediction({
        history: client.predictionHistory,
        processedClientTick: client.processedClientTick,
        authoritativeState: own,
        restoreAuthoritative,
        replayInput(entry) { predictMovement(entry, 1000 / NETWORK.inputSendHz); },
      });
      maxPredictionHistory = Math.max(maxPredictionHistory, client.predictionHistory.size);
    },
  });
  status.textContent = "connected";
  startAt = performance.now();
  requestAnimationFrame(frame);
} catch (error) {
  fail(error);
}

function frame(now) {
  if (finished) return;
  if (lastFrameAt) frameDeltas.push(now - lastFrameAt);
  const frameDelta = lastFrameAt ? Math.min(50, Math.max(0, now - lastFrameAt)) : 0;
  lastFrameAt = now;
  accumulatorMs += frameDelta;

  let steps = 0;
  while (accumulatorMs >= predictionStepMs && steps < 6) {
    const elapsed = now - startAt;
    const input = deterministicInput(elapsed);
    predictMovement(input, predictionStepMs);
    predictionSteps += 1;
    if (predictionSteps % sendEveryPredictionSteps === 0) {
      client.sendInput({ tick: clientTick, ...input });
      clientTick = (clientTick + 1) >>> 0;
      sentInputs += 1;
      maxPredictionHistory = Math.max(maxPredictionHistory, client.predictionHistory.size);
    }
    accumulatorMs -= predictionStepMs;
    steps += 1;
  }
  if (steps === 6 && accumulatorMs >= predictionStepMs) accumulatorMs = 0;

  render(now - startAt);
  if (now - startAt >= durationMs) {
    finish(now - startAt);
    return;
  }
  requestAnimationFrame(frame);
}

function deterministicInput(elapsedMs) {
  const phase = Math.floor(elapsedMs / 700) % 4;
  const vectors = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  const [moveX, moveY] = vectors[phase];
  return {
    moveX,
    moveY,
    facing: (elapsedMs / 1000) % (Math.PI * 2),
    attack: sentInputs > 0 && sentInputs % 90 === 0,
    dodge: sentInputs > 0 && sentInputs % 150 === 0,
    block: sentInputs % 120 >= 96,
  };
}

function predictMovement(input, dtMs) {
  if (!local.initialized) return;
  let moveX = Number.isFinite(input.moveX) ? input.moveX : 0;
  let moveY = Number.isFinite(input.moveY) ? input.moveY : 0;
  const length = Math.hypot(moveX, moveY);
  if (length > 1) { moveX /= length; moveY /= length; }
  local.facing = Number.isFinite(input.facing) ? input.facing : local.facing;
  const speed = 215;
  const seconds = dtMs / 1000;
  local.x = clamp(local.x + moveX * speed * seconds, 18, NETWORK.worldWidth - 18);
  local.y = clamp(local.y + moveY * speed * seconds, 18, NETWORK.worldHeight - 18);
}

function restoreAuthoritative(own) {
  local.x = own.x;
  local.y = own.y;
  local.facing = own.facing;
  local.initialized = true;
}

function render(elapsedMs) {
  ctx.fillStyle = "#18150f";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const cameraX = local.initialized ? local.x - canvas.width / 2 : 0;
  const cameraY = local.initialized ? local.y - canvas.height / 2 : 0;

  ctx.strokeStyle = "rgba(214,195,148,.08)";
  ctx.lineWidth = 1;
  const grid = 48;
  const offsetX = ((-cameraX % grid) + grid) % grid;
  const offsetY = ((-cameraY % grid) + grid) % grid;
  for (let x = offsetX; x < canvas.width; x += grid) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); }
  for (let y = offsetY; y < canvas.height; y += grid) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); }

  for (let index = 0; index < stressEntities; index += 1) {
    const angle = index * 2.399963229728653 + elapsedMs * 0.00008;
    const radius = 80 + (index % 12) * 24;
    const x = canvas.width / 2 + Math.cos(angle) * radius;
    const y = canvas.height / 2 + Math.sin(angle) * radius;
    ctx.fillStyle = index % 3 === 0 ? "#9a4d41" : "#665b45";
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.fill();
  }

  if (client) {
    ctx.fillStyle = "#b96350";
    for (const entity of client.state.values()) {
      if (entity.netId === client.playerNetId) continue;
      const x = entity.x - cameraX;
      const y = entity.y - cameraY;
      if (x < -20 || y < -20 || x > canvas.width + 20 || y > canvas.height + 20) continue;
      ctx.beginPath();
      ctx.arc(x, y, 18, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (local.initialized) {
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(local.facing);
    ctx.fillStyle = "#e2d5b4";
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#c8b684";
    ctx.fillRect(12, -2, 26, 4);
    ctx.restore();
  }
}

function finish(elapsedMs) {
  if (finished) return;
  finished = true;
  client?.close("flight complete");
  const sortedFrames = [...frameDeltas].sort((a, b) => a - b);
  const sortedCorrections = [...corrections].sort((a, b) => a - b);
  const result = {
    ok: Boolean(local.initialized && snapshots > 0 && acknowledgements > 0 && (client?.reliableSnapshots ?? 0) > 0),
    userAgent: navigator.userAgent,
    webTransportAvailable: typeof WebTransport === "function",
    elapsedMs: round(elapsedMs),
    frames: frameDeltas.length,
    frameMs: summarize(sortedFrames),
    framesOver25Ms: frameDeltas.filter((value) => value > 25).length,
    framesOver50Ms: frameDeltas.filter((value) => value > 50).length,
    longTasks,
    snapshots,
    reliableSnapshots: client?.reliableSnapshots ?? 0,
    reliableCatchups,
    reliableAdvancedEntities,
    maxReliableAdvancedEntities,
    maxAuthoritativeEntities,
    reliableBaselineEntities,
    firstBackgroundReliableMs: firstBackgroundReliableMs === null ? null : round(firstBackgroundReliableMs),
    acknowledgements,
    sentInputs,
    maxPredictionHistory,
    correctionPx: summarize(sortedCorrections),
    stressEntities,
    playerNetId: client?.playerNetId ?? null,
    serverTick: client?.latestServerTick ?? null,
    heapUsedBytes: Number.isFinite(performance.memory?.usedJSHeapSize) ? performance.memory.usedJSHeapSize : null,
  };
  window.__MYASO_FLIGHT_RESULT__ = result;
  status.textContent = result.ok ? "complete" : "incomplete";
}

function summarize(sorted) {
  if (!sorted.length) return { count: 0, p50: null, p95: null, p99: null, max: null };
  return {
    count: sorted.length,
    p50: round(percentile(sorted, 0.50)),
    p95: round(percentile(sorted, 0.95)),
    p99: round(percentile(sorted, 0.99)),
    max: round(sorted.at(-1)),
  };
}

function percentile(sorted, fraction) {
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1))];
}

function fail(error) {
  if (finished) return;
  finished = true;
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  window.__MYASO_FLIGHT_ERROR__ = message;
  status.textContent = message;
  console.error(error);
}

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function clampNumber(value, min, max) { return Number.isFinite(value) ? clamp(value, min, max) : min; }
function round(value) { return Math.round(value * 1000) / 1000; }

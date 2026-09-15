import { NETWORK } from "../src/network/constants.mjs";
import { connectAuthoritativeClient, parseSha256Hex } from "./authoritative-client.mjs";

const params = new URLSearchParams(location.search);
const server = params.get("server");
const cert = params.get("cert");
const durationMs = clamp(Number(params.get("duration") ?? 7000), 3000, 12000);
const canvas = document.querySelector("#arena");
const ctx = canvas.getContext("2d", { alpha: false });
const status = document.querySelector("#status");

window.__MYASO_PVP_RESULT__ = null;
window.__MYASO_PVP_ERROR__ = null;
if (!server) fail(new Error("PvP flight requires ?server=https://host:port/game"));

let client = null;
let clientTick = 1;
let sentInputs = 0;
let snapshots = 0;
let acknowledgements = 0;
let maxAuthoritativeEntities = 0;
let peerNetId = null;
let peerSeenAt = null;
let firstDamageAt = null;
let successAt = null;
let minOwnHp = 100;
let minPeerHp = 100;
let ownDamageTransitions = 0;
let peerDamageTransitions = 0;
let previousOwnHp = 100;
let previousPeerHp = 100;
let lastFrameAt = 0;
let frameCount = 0;
const frameDeltas = [];
let inputTimer = null;
let animationFrame = 0;
let finished = false;
const startedAt = performance.now();

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
      observeState(state);
    },
    onReliableSnapshot(_result, state) {
      observeState(state);
    },
    onAck() {
      acknowledgements += 1;
      observeState(client.state);
    },
  });
  status.textContent = "connected; waiting for opponent";
  inputTimer = setInterval(sendCombatInput, 1000 / NETWORK.inputSendHz);
  animationFrame = requestAnimationFrame(render);
  setTimeout(() => finish(), durationMs);
} catch (error) {
  fail(error);
}
function observeState(state) {
  maxAuthoritativeEntities = Math.max(maxAuthoritativeEntities, state.size);
  const ownId = client?.playerNetId;
  if (!ownId) return;
  const own = state.get(ownId);
  const peer = [...state.values()].find((entity) => entity.netId !== ownId);
  if (!own || !peer) return;

  if (peerNetId === null) {
    peerNetId = peer.netId;
    peerSeenAt = performance.now();
    previousOwnHp = own.hp;
    previousPeerHp = peer.hp;
    status.textContent = `combat: #${ownId} vs #${peerNetId}`;
  }

  if (own.hp < previousOwnHp) ownDamageTransitions += 1;
  if (peer.hp < previousPeerHp) peerDamageTransitions += 1;
  previousOwnHp = own.hp;
  previousPeerHp = peer.hp;
  minOwnHp = Math.min(minOwnHp, own.hp);
  minPeerHp = Math.min(minPeerHp, peer.hp);

  if (firstDamageAt === null && (minOwnHp < 100 || minPeerHp < 100)) {
    firstDamageAt = performance.now();
  }
  if (successAt === null && minOwnHp < 100 && minPeerHp < 100) {
    successAt = performance.now();
  }
  if (successAt !== null && performance.now() - successAt >= 500) finish();
}

function sendCombatInput() {
  if (finished || !client) return;
  const ownId = client.playerNetId;
  const own = ownId ? client.state.get(ownId) : null;
  const peer = ownId ? [...client.state.values()].find((entity) => entity.netId !== ownId) : null;
  let moveX = 0;
  let moveY = 0;
  let facing = own?.facing ?? 0;
  let attack = false;
  if (own && peer) {
    const dx = peer.x - own.x;
    const dy = peer.y - own.y;
    const distance = Math.hypot(dx, dy);
    if (distance > 68 && distance > 0.001) {
      moveX = dx / distance;
      moveY = dy / distance;
    }
    facing = Math.atan2(dy, dx);
    attack = distance <= 92 && sentInputs % 30 === 0;
  }

  client.sendInput({
    tick: clientTick,
    moveX,
    moveY,
    facing,
    attack,
    dodge: false,
    block: false,
  });
  clientTick = (clientTick + 1) >>> 0;
  sentInputs += 1;
}

function render(now) {
  if (finished) return;
  if (lastFrameAt) frameDeltas.push(now - lastFrameAt);
  lastFrameAt = now;
  frameCount += 1;
  ctx.fillStyle = "#18150f";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const ownId = client?.playerNetId;
  const own = ownId ? client.state.get(ownId) : null;
  const cameraX = own ? own.x - canvas.width / 2 : 0;
  const cameraY = own ? own.y - canvas.height / 2 : 0;
  for (const entity of client?.state.values() ?? []) {
    const x = entity.x - cameraX;
    const y = entity.y - cameraY;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(entity.facing ?? 0);
    ctx.fillStyle = entity.netId === ownId ? "#e2d5b4" : "#b96350";
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#c8b684";
    ctx.fillRect(12, -2, 26, 4);
    ctx.restore();
  }

  animationFrame = requestAnimationFrame(render);
}

function finish() {
  if (finished) return;
  finished = true;
  if (inputTimer !== null) clearInterval(inputTimer);
  if (animationFrame) cancelAnimationFrame(animationFrame);

  const ownId = client?.playerNetId ?? null;
  const sortedFrames = [...frameDeltas].sort((a, b) => a - b);
  const frameP95 = percentile(sortedFrames, 0.95);
  const result = {
    ok: Boolean(
      ownId && peerNetId && ownId !== peerNetId
      && maxAuthoritativeEntities >= 2
      && minOwnHp < 100 && minPeerHp < 100
      && ownDamageTransitions > 0 && peerDamageTransitions > 0
      && snapshots >= 10 && acknowledgements >= 10 && sentInputs >= 20
      && Number.isFinite(frameP95) && frameP95 < 25
    ),
    playerNetId: ownId,
    peerNetId,
    snapshots,
    acknowledgements,
    sentInputs,
    frames: frameCount,
    frameP95: round(frameP95),
    maxAuthoritativeEntities,
    minOwnHp,
    minPeerHp,
    ownDamageTransitions,
    peerDamageTransitions,
    peerSeenMs: peerSeenAt === null ? null : round(peerSeenAt - startedAt),
    firstDamageMs: firstDamageAt === null ? null : round(firstDamageAt - startedAt),
    elapsedMs: round(performance.now() - startedAt),
  };
  window.__MYASO_PVP_RESULT__ = result;
  status.textContent = result.ok ? "authoritative PvP damage verified" : "PvP flight incomplete";
  client?.close("M22 PvP flight complete");
}

function fail(error) {
  if (finished) return;
  finished = true;
  if (inputTimer !== null) clearInterval(inputTimer);
  if (animationFrame) cancelAnimationFrame(animationFrame);
  window.__MYASO_PVP_ERROR__ = String(error?.stack ?? error);
  status.textContent = "failed";
  client?.close("M22 PvP flight failed");
}

function percentile(sorted, fraction) {
  if (!sorted.length) return null;
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * fraction))];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round(value) {
  return Number.isFinite(value) ? Math.round(value * 1000) / 1000 : null;
}

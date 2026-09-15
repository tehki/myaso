import { createFrameBudget } from "../src/browser/frame-budget.mjs";
import { COMBAT_ACTION, combatActionHint, combatLifePresentation, createCombatReadabilityTracker } from "../src/browser/combat-readability.mjs";
import { COMBAT } from "../src/combat/model.mjs";
import { reconcilePrediction } from "../src/browser/reconciliation.mjs";
import { NETWORK } from "../src/network/constants.mjs";
import { connectAuthoritativeClient, parseSha256Hex } from "./authoritative-client.mjs";

const canvas = document.querySelector("#arena");
const ctx = canvas.getContext("2d", { alpha: false });
const eventText = document.querySelector("#event-text");
const hud = {
  playerHp: document.querySelector("#player-hp"),
  playerHpValue: document.querySelector("#player-hp-value"),
  playerGuard: document.querySelector("#player-guard"),
  playerGuardValue: document.querySelector("#player-guard-value"),
  botHp: document.querySelector("#bot-hp"),
  botHpValue: document.querySelector("#bot-hp-value"),
  botGuard: document.querySelector("#bot-guard"),
  botGuardValue: document.querySelector("#bot-guard-value"),
};
const hudCache = { playerHp: null, playerGuard: null, botHp: null, botGuard: null, status: null };
const combatOverlay = {
  root: document.querySelector("#combat-overlay"),
  title: document.querySelector("#combat-overlay-title"),
  detail: document.querySelector("#combat-overlay-detail"),
};
const combatReadability = createCombatReadabilityTracker();
let networkStatus = "Connecting to authoritative server...";
let combatMessage = null;
let combatMessageUntil = 0;

const params = new URLSearchParams(window.location.search);
const server = params.get("server");
const cert = params.get("cert");
if (!server) throw new Error("online mode requires ?server=https://host:port/game");

const webTransportOptions = cert
  ? { serverCertificateHashes: [{ algorithm: "sha-256", value: parseSha256Hex(cert) }] }
  : undefined;

const keys = new Set();
const mouse = { x: canvas.width / 2, y: canvas.height / 2, block: false };
const local = { x: 0, y: 0, facing: 0, hp: 100, guard: 100, action: 0, initialized: false };
const currentInput = { moveX: 0, moveY: 0, facing: 0, attack: false, dodge: false, block: false };
const arenaLayer = createArenaLayer();
const remoteScratch = new Map();
const fixedStepMs = 1000 / NETWORK.clientPredictionHz;
const frameBudget = createFrameBudget({ stepMs: fixedStepMs, maxFrameDeltaMs: 50, maxStepsPerFrame: 6 });
let networkClient = null;
let animationFrameId = 0;
let predictionStep = 0;
let clientTick = 0;
let attackRequested = false;
let dodgeRequested = false;

canvas.addEventListener("contextmenu", (event) => event.preventDefault());
canvas.addEventListener("pointerdown", (event) => {
  canvas.focus();
  if (event.button === 0) attackRequested = true;
  if (event.button === 2) mouse.block = true;
  updateMouse(event);
});
canvas.addEventListener("pointerup", (event) => {
  if (event.button === 2) mouse.block = false;
});
canvas.addEventListener("pointermove", updateMouse);
canvas.addEventListener("keydown", (event) => {
  if (["KeyW", "KeyA", "KeyS", "KeyD", "Space"].includes(event.code)) event.preventDefault();
  keys.add(event.code);
  if (event.code === "Space" && !event.repeat) dodgeRequested = true;
});
canvas.addEventListener("keyup", (event) => keys.delete(event.code));
window.addEventListener("blur", releaseInputs);
document.addEventListener("visibilitychange", handleVisibilityChange);

setStatus("Connecting to authoritative server…");
networkClient = await connectAuthoritativeClient({
  webTransportUrl: server,
  webTransportOptions,
  onProtocolError(error) {
    console.warn("authoritative protocol error", error);
    networkStatus = "Protocol error - invalid realtime packet ignored.";
  },
  onSnapshot(_result, state) {
    const ownId = networkClient?.playerNetId;
    if (!ownId) return;
    const own = state.get(ownId);
    if (own && !local.initialized) restoreAuthoritative(own);
    observeCombatState(state);
  },
  onReliableSnapshot(_result, state) {
    observeCombatState(state);
  },
  onAck() {
    const ownId = networkClient?.playerNetId;
    const own = ownId ? networkClient.state.get(ownId) : null;
    if (!own) return;
    reconcilePrediction({
      history: networkClient.predictionHistory,
      processedClientTick: networkClient.processedClientTick,
      authoritativeState: own,
      restoreAuthoritative,
      replayInput(entry) { predictMovement(entry, 1000 / NETWORK.inputSendHz); },
    });
    networkStatus = `Online - player #${ownId} - server tick ${networkClient.latestServerTick}`;
  },
});

function observeCombatState(state) {
  const ownId = networkClient?.playerNetId;
  if (!ownId) return;
  const event = combatReadability.observe(state, ownId);
  if (!event) return;
  combatMessage = event.text;
  combatMessageUntil = performance.now() + event.durationMs;
  setStatus(combatMessage);
}

function updateMouse(event) {
  const rect = canvas.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * canvas.width;
  mouse.y = ((event.clientY - rect.top) / rect.height) * canvas.height;
}

function releaseInputs() {
  keys.clear();
  attackRequested = false;
  dodgeRequested = false;
  mouse.block = false;
}

function sampleInput() {
  currentInput.moveX = (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0);
  currentInput.moveY = (keys.has("KeyS") ? 1 : 0) - (keys.has("KeyW") ? 1 : 0);
  currentInput.facing = Math.atan2(mouse.y - canvas.height / 2, mouse.x - canvas.width / 2);
  currentInput.attack = attackRequested;
  currentInput.dodge = dodgeRequested;
  currentInput.block = mouse.block;
}

function simulatePrediction(stepMs) {
  sampleInput();
  if (local.initialized) predictMovement(currentInput, stepMs);
  predictionStep += 1;
  if (predictionStep % 2 === 0 && networkClient) {
    networkClient.sendInput({ tick: clientTick, ...currentInput });
    clientTick = (clientTick + 1) >>> 0;
    attackRequested = false;
    dodgeRequested = false;
  }
}

function predictMovement(input, dtMs) {
  let moveX = Number.isFinite(input.moveX) ? input.moveX : 0;
  let moveY = Number.isFinite(input.moveY) ? input.moveY : 0;
  const length = Math.hypot(moveX, moveY);
  if (length > 1) {
    moveX /= length;
    moveY /= length;
  }
  local.facing = Number.isFinite(input.facing) ? input.facing : local.facing;
  let speed = COMBAT.moveSpeed;
  if (local.action === 6 || input.block) speed *= COMBAT.block.moveMultiplier;
  else if (local.action === 1) speed *= 0.35;
  else if (local.action === 2 || local.action === 7 || local.action === 8) speed = 0;
  else if (local.action === 3 || local.action === 5) speed *= 0.48;
  else if (local.action === 4) speed = COMBAT.dodge.speed;
  const seconds = dtMs / 1000;
  local.x = clamp(local.x + moveX * speed * seconds, COMBAT.fighterRadius, NETWORK.worldWidth - COMBAT.fighterRadius);
  local.y = clamp(local.y + moveY * speed * seconds, COMBAT.fighterRadius, NETWORK.worldHeight - COMBAT.fighterRadius);
}

function restoreAuthoritative(own) {
  local.x = own.x;
  local.y = own.y;
  local.facing = own.facing;
  local.hp = own.hp;
  local.guard = own.guard;
  local.action = own.action;
  local.initialized = true;
}

function render() {
  ctx.drawImage(arenaLayer, 0, 0);
  if (!networkClient) return;
  const ownId = networkClient.playerNetId;
  if (ownId && !local.initialized) {
    const own = networkClient.state.get(ownId);
    if (own) restoreAuthoritative(own);
  }
  const interpolationTicks = Math.round((NETWORK.reconciliation.remoteInterpolationMs / 1000) * NETWORK.serverSimulationHz);
  const renderServerTick = networkClient.latestServerTick >= interpolationTicks
    ? networkClient.latestServerTick - interpolationTicks
    : 0;

  for (const entity of networkClient.state.values()) {
    if (entity.netId === ownId) continue;
    let scratch = remoteScratch.get(entity.netId);
    if (!scratch) {
      scratch = {};
      remoteScratch.set(entity.netId, scratch);
    }
    const sampled = networkClient.remoteInterpolator.sample(entity.netId, renderServerTick, scratch) ?? entity;
    drawFighterWorld(sampled, "#b96350", "#47251f");
  }
  if (ownId && local.initialized) drawFighterScreen(canvas.width / 2, canvas.height / 2, local, "#e2d5b4", "#51452d");
  updateHud(ownId);
}

function drawFighterWorld(fighter, body, shadow) {
  if (!local.initialized) return;
  const screenX = canvas.width / 2 + fighter.x - local.x;
  const screenY = canvas.height / 2 + fighter.y - local.y;
  if (screenX < -64 || screenX > canvas.width + 64 || screenY < -64 || screenY > canvas.height + 64) return;
  drawFighterScreen(screenX, screenY, fighter, body, shadow);
}

function drawFighterScreen(x, y, fighter, body, shadow) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(fighter.facing ?? 0);
  const action = fighter.action ?? COMBAT_ACTION.idle;
  ctx.globalAlpha = action === COMBAT_ACTION.dead ? 0.28 : 1;
  if (action === COMBAT_ACTION.attackWindup || action === COMBAT_ACTION.attackActive) drawAttackTell(action);
  if (action === COMBAT_ACTION.block) drawBlockTell();
  if (action === COMBAT_ACTION.dodge) drawDodgeTell();
  if (action === COMBAT_ACTION.stunned) drawStunTell();
  ctx.fillStyle = shadow;
  ctx.beginPath();
  ctx.ellipse(-2, 8, 20, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(0, 0, COMBAT.fighterRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#13110d";
  ctx.beginPath();
  ctx.arc(7, -5, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#c8b684";
  ctx.fillRect(12, -2, 26, 4);
  ctx.restore();
}

function drawAttackTell(action) {
  const alpha = action === COMBAT_ACTION.attackActive ? 0.34 : 0.14;
  ctx.fillStyle = `rgba(214, 187, 112, ${alpha})`;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, COMBAT.attack.reach + COMBAT.fighterRadius, -COMBAT.attack.arcRadians / 2, COMBAT.attack.arcRadians / 2);
  ctx.closePath();
  ctx.fill();
}

function drawBlockTell() {
  ctx.strokeStyle = "rgba(241, 218, 142, .72)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, 32, -COMBAT.block.halfAngleRadians, COMBAT.block.halfAngleRadians);
  ctx.stroke();
}

function drawDodgeTell() {
  ctx.strokeStyle = "rgba(216, 202, 160, .58)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 28, 0, Math.PI * 2);
  ctx.stroke();
}

function drawStunTell() {
  ctx.strokeStyle = "rgba(185, 99, 80, .9)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 25, 0, Math.PI * 2);
  ctx.stroke();
}

function updateHud(ownId) {
  const own = ownId ? networkClient.state.get(ownId) : null;
  let remote = null;
  for (const entity of networkClient.state.values()) {
    if (entity.netId !== ownId) {
      remote = entity;
      break;
    }
  }
  setMeter("playerHp", hud.playerHp, hud.playerHpValue, own?.hp ?? local.hp);
  setMeter("playerGuard", hud.playerGuard, hud.playerGuardValue, own?.guard ?? local.guard);
  setMeter("botHp", hud.botHp, hud.botHpValue, remote?.hp ?? 0);
  setMeter("botGuard", hud.botGuard, hud.botGuardValue, remote?.guard ?? 0);
  updateCombatOverlay(own);
  const now = performance.now();
  if (combatMessage && now <= combatMessageUntil) {
    setStatus(combatMessage);
  } else {
    combatMessage = null;
    setStatus(combatActionHint(own) ?? networkStatus);
  }
}

function updateCombatOverlay(own) {
  const presentation = combatLifePresentation(own);
  const shouldHide = !presentation.visible;
  if (combatOverlay.root.hidden !== shouldHide) combatOverlay.root.hidden = shouldHide;
  if (!presentation.visible) return;
  if (combatOverlay.title.textContent !== presentation.title) combatOverlay.title.textContent = presentation.title;
  if (combatOverlay.detail.textContent !== presentation.detail) combatOverlay.detail.textContent = presentation.detail;
}

function setMeter(cacheKey, bar, label, value) {
  const rounded = Math.max(0, Math.min(100, Math.round(value)));
  if (hudCache[cacheKey] === rounded) return;
  hudCache[cacheKey] = rounded;
  bar.style.transform = `scaleX(${rounded / 100})`;
  label.textContent = String(rounded);
}

function setStatus(text) {
  if (hudCache.status === text) return;
  hudCache.status = text;
  eventText.textContent = text;
}

function createArenaLayer() {
  const layer = document.createElement("canvas");
  layer.width = canvas.width;
  layer.height = canvas.height;
  const layerContext = layer.getContext("2d", { alpha: false });
  layerContext.fillStyle = "#1c1913";
  layerContext.fillRect(0, 0, layer.width, layer.height);
  layerContext.strokeStyle = "rgba(214, 195, 148, .065)";
  layerContext.lineWidth = 1;
  for (let x = 0; x <= layer.width; x += 48) {
    layerContext.beginPath();
    layerContext.moveTo(x, 0);
    layerContext.lineTo(x, layer.height);
    layerContext.stroke();
  }
  for (let y = 0; y <= layer.height; y += 48) {
    layerContext.beginPath();
    layerContext.moveTo(0, y);
    layerContext.lineTo(layer.width, y);
    layerContext.stroke();
  }
  layerContext.strokeStyle = "rgba(214, 195, 148, .22)";
  layerContext.lineWidth = 3;
  layerContext.strokeRect(12, 12, layer.width - 24, layer.height - 24);
  return layer;
}

function frame(now) {
  if (document.hidden) return;
  frameBudget.advance(now, simulatePrediction);
  render();
  animationFrameId = requestAnimationFrame(frame);
}

function handleVisibilityChange() {
  releaseInputs();
  if (document.hidden) {
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    animationFrameId = 0;
    frameBudget.reset();
    return;
  }
  frameBudget.reset(performance.now());
  if (!animationFrameId) animationFrameId = requestAnimationFrame(frame);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

render();
frameBudget.reset(performance.now());
animationFrameId = requestAnimationFrame(frame);

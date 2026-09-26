import { createFrameBudget } from "../src/browser/frame-budget.mjs";
import { createCombatImpactController } from "../src/browser/combat-impact.mjs";
import { COMBAT_ACTION, blockSpatialPresentation, combatActionHint, combatOverlayPresentation, createCombatReadabilityTracker, createRemoteDamageTracker, fighterFocusNetId, fighterIdentityPresentation, fighterThreatBearingLabel, fighterThreatGuardArcLabel, fighterThreatNetId, fighterThreatPhaseLabel, fighterMatchPresentation, fighterScoreboardPresentation, fighterVitalsPresentation, guardBreakSpatialPresentation, killFeedPresentation, opponentRecoveryPresentation, parrySpatialPresentation } from "../src/browser/combat-readability.mjs";
import { COMBAT } from "../src/combat/model.mjs";
import { reconcilePrediction } from "../src/browser/reconciliation.mjs";
import { NETWORK } from "../src/network/constants.mjs";
import { connectAuthoritativeClient, parseSha256Hex } from "./authoritative-client.mjs";

const canvas = document.querySelector("#arena");
const ctx = canvas.getContext("2d", { alpha: false });
const eventText = document.querySelector("#event-text");
const arenaStage = document.querySelector(".arena-stage");
const scoreboardList = document.querySelector("#scoreboard-list");
const killFeedList = document.querySelector("#kill-feed-list");
const hud = {
  playerHp: document.querySelector("#player-hp"),
  playerHpValue: document.querySelector("#player-hp-value"),
  playerGuard: document.querySelector("#player-guard"),
  playerGuardValue: document.querySelector("#player-guard-value"),
  playerStamina: document.querySelector("#player-stamina"),
  playerStaminaValue: document.querySelector("#player-stamina-value"),
  botHp: document.querySelector("#bot-hp"),
  botHpValue: document.querySelector("#bot-hp-value"),
  botGuard: document.querySelector("#bot-guard"),
  botGuardValue: document.querySelector("#bot-guard-value"),
  focusLabel: document.querySelector("#focus-label"),
};
const hudCache = { playerHp: null, playerGuard: null, playerStamina: null, botHp: null, botGuard: null, focusNetId: null, status: null, scoreboard: null };
const combatOverlay = {
  root: document.querySelector("#combat-overlay"),
  title: document.querySelector("#combat-overlay-title"),
  detail: document.querySelector("#combat-overlay-detail"),
};
const opponentRecovery = {
  root: document.querySelector("#opponent-recovery"),
  label: document.querySelector("#opponent-recovery-label"),
  detail: document.querySelector("#opponent-recovery-detail"),
};
const threatCue = {
  root: document.querySelector("#threat-cue"),
  label: document.querySelector("#threat-label"),
  phase: document.querySelector("#threat-phase"),
  countLabel: document.querySelector("#threat-count"),
  secondaryLabel: document.querySelector("#threat-secondary"),
  secondaryBearingLabel: document.querySelector("#threat-secondary-bearing"),
  secondaryPhaseLabel: document.querySelector("#threat-secondary-phase"),
  secondaryGuardArcLabel: document.querySelector("#threat-secondary-guard-arc"),
  bearingLabel: document.querySelector("#threat-bearing"),
  guardArcLabel: document.querySelector("#threat-guard-arc"),
  netId: 0,
  state: "",
  count: 0,
  secondaryNetId: 0,
  secondaryBearing: "",
  secondaryPhase: "",
  secondaryGuardArc: "",
  bearing: "",
  guardArc: "",
};
const threatScan = { count: 0, secondaryNetId: 0 };
const combatReadability = createCombatReadabilityTracker();
const combatImpact = createCombatImpactController();
const remoteDamage = createRemoteDamageTracker();
let networkStatus = "Connecting to authoritative server...";
let combatMessage = null;
let combatMessageUntil = 0;
let combatFeedbackTimer = 0;
let matchOver = false;
const killFeedEntries = [];
const killFeedSequences = new Set();

const params = new URLSearchParams(window.location.search);
const server = params.get("server");
const cert = params.get("cert");
if (!server) throw new Error("online mode requires ?server=https://host:port/game");

const webTransportOptions = cert
  ? { serverCertificateHashes: [{ algorithm: "sha-256", value: parseSha256Hex(cert) }] }
  : undefined;

const keys = new Set();
const mouse = { x: canvas.width / 2, y: canvas.height / 2 };
const local = { x: 0, y: 0, facing: 0, hp: 100, guard: 100, stamina: 100, action: 0, initialized: false };
const currentInput = {
  moveX: 0, moveY: 0, facing: 0, attack: false, heavyAttack: false,
  dodge: false, block: false, kick: false, run: false, jump: false,
};
const arenaLayer = createArenaLayer();
const remoteScratch = new Map();
const fixedStepMs = 1000 / NETWORK.clientPredictionHz;
const frameBudget = createFrameBudget({ stepMs: fixedStepMs, maxFrameDeltaMs: 50, maxStepsPerFrame: 6 });
let networkClient = null;
let animationFrameId = 0;
let predictionStep = 0;
let clientTick = 0;
let attackRequested = false;
let heavyAttackRequested = false;
let rollRequested = false;
let kickRequested = false;
let jumpRequested = false;
let shortBlockUntil = 0;
let rightButtonDown = false;
let rightButtonDownAt = 0;
const runHoldThresholdMs = 180;
let staminaRegenBlockedUntil = 0;

canvas.addEventListener("contextmenu", (event) => event.preventDefault());
canvas.addEventListener("pointerdown", (event) => {
  canvas.focus();
  if (event.button === 0) attackRequested = true;
  if (event.button === 2) {
    rightButtonDown = true;
    rightButtonDownAt = performance.now();
  }
  updateMouse(event);
});
canvas.addEventListener("pointerup", (event) => {
  if (event.button === 2) {
    const heldMs = performance.now() - rightButtonDownAt;
    rightButtonDown = false;
    if (heldMs < runHoldThresholdMs) kickRequested = true;
  }
});
canvas.addEventListener("wheel", (event) => {
  event.preventDefault();
  canvas.focus();
  if (event.deltaY < 0) rollRequested = true;
  else if (event.deltaY > 0) shortBlockUntil = Math.max(shortBlockUntil, performance.now() + COMBAT.block.shortBlockMs);
}, { passive: false });
canvas.addEventListener("pointermove", updateMouse);
canvas.addEventListener("keydown", (event) => {
  if (["KeyW", "KeyA", "KeyS", "KeyD", "KeyE", "Space"].includes(event.code)) event.preventDefault();
  keys.add(event.code);
  if (event.code === "KeyE" && !event.repeat) heavyAttackRequested = true;
  if (event.code === "Space" && !event.repeat) jumpRequested = true;
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
  onKillEvent(event) {
    recordKillEvent(event);
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
  const match = fighterMatchPresentation(state.values(), ownId);
  if (match.visible && !matchOver) {
    matchOver = true;
    releaseInputs();
  } else if (!match.visible && matchOver) {
    const rows = fighterScoreboardPresentation(state.values(), ownId);
    if (rows.length > 0 && rows.every((row) => row.kills === 0)) {
      matchOver = false;
      clearKillFeed();
    }
  }
  const now = performance.now();
  remoteDamage.observe(state, ownId, now);
  const event = combatReadability.observe(state, ownId);
  if (!event) return;
  combatMessage = event.text;
  combatMessageUntil = now + event.durationMs;
  setStatus(combatMessage);
  showCombatFeedback(event.feedback);
}

function recordKillEvent(event) {
  if (!killFeedList || killFeedSequences.has(event?.sequence)) return;
  const ownId = networkClient?.playerNetId ?? 0;
  const presentation = killFeedPresentation(event, ownId);
  if (!presentation.visible) return;
  killFeedSequences.add(event.sequence);
  killFeedEntries.unshift({ sequence: event.sequence, ...presentation });
  while (killFeedEntries.length > 4) {
    const removed = killFeedEntries.pop();
    killFeedSequences.delete(removed.sequence);
  }
  renderKillFeed();
}

function renderKillFeed() {
  if (!killFeedList) return;
  killFeedList.replaceChildren(...killFeedEntries.map((entry) => {
    const item = document.createElement("li");
    item.dataset.sequence = String(entry.sequence);
    item.dataset.killerOwn = String(entry.killerOwn);
    item.dataset.victimOwn = String(entry.victimOwn);
    item.textContent = entry.text;
    return item;
  }));
}

function clearKillFeed() {
  killFeedEntries.length = 0;
  killFeedSequences.clear();
  renderKillFeed();
}

function showCombatFeedback(feedback) {
  if (!feedback || !arenaStage) return;
  combatImpact.trigger(feedback, performance.now());
  if (combatFeedbackTimer) clearTimeout(combatFeedbackTimer);
  delete arenaStage.dataset.combatFeedback;
  void arenaStage.offsetWidth;
  arenaStage.dataset.combatFeedback = feedback;
  const durationMs = feedback === "guard-broken" || feedback === "guard-break-confirm" ? 420
    : feedback === "parry-success" || feedback === "parried" ? 380
      : 320;
  combatFeedbackTimer = window.setTimeout(() => {
    if (arenaStage.dataset.combatFeedback === feedback) delete arenaStage.dataset.combatFeedback;
    combatFeedbackTimer = 0;
  }, durationMs);
}

function updateMouse(event) {
  const rect = canvas.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * canvas.width;
  mouse.y = ((event.clientY - rect.top) / rect.height) * canvas.height;
}

function releaseInputs() {
  keys.clear();
  attackRequested = false;
  heavyAttackRequested = false;
  rollRequested = false;
  kickRequested = false;
  jumpRequested = false;
  shortBlockUntil = 0;
  rightButtonDown = false;
}

function sampleInput() {
  if (matchOver) {
    currentInput.moveX = 0;
    currentInput.moveY = 0;
    currentInput.attack = false;
    currentInput.heavyAttack = false;
    currentInput.dodge = false;
    currentInput.block = false;
    currentInput.kick = false;
    currentInput.run = false;
    currentInput.jump = false;
    return;
  }
  currentInput.moveX = (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0);
  currentInput.moveY = (keys.has("KeyS") ? 1 : 0) - (keys.has("KeyW") ? 1 : 0);
  currentInput.facing = Math.atan2(mouse.y - canvas.height / 2, mouse.x - canvas.width / 2);
  currentInput.attack = attackRequested;
  currentInput.heavyAttack = heavyAttackRequested;
  currentInput.dodge = rollRequested;
  currentInput.block = performance.now() < shortBlockUntil;
  currentInput.kick = kickRequested;
  currentInput.run = rightButtonDown && performance.now() - rightButtonDownAt >= runHoldThresholdMs;
  currentInput.jump = jumpRequested;
}

function simulatePrediction(stepMs) {
  sampleInput();
  if (!matchOver && local.initialized) predictMovement(currentInput, stepMs);
  predictionStep += 1;
  if (predictionStep % 2 === 0 && networkClient) {
    networkClient.sendInput({ tick: clientTick, ...currentInput });
    clientTick = (clientTick + 1) >>> 0;
    attackRequested = false;
    heavyAttackRequested = false;
    rollRequested = false;
    kickRequested = false;
    jumpRequested = false;
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
  const now = performance.now();
  const moving = Math.hypot(moveX, moveY) > 1e-6;
  if (input.run && local.action === COMBAT_ACTION.idle && moving && local.stamina > 0) {
    speed *= COMBAT.stamina.runMoveMultiplier;
    local.stamina = Math.max(0, local.stamina - COMBAT.stamina.runDrainPerSecond * dtMs / 1000);
    staminaRegenBlockedUntil = now + COMBAT.stamina.regenDelayMs;
  } else if (now >= staminaRegenBlockedUntil) {
    local.stamina = Math.min(COMBAT.stamina.max, local.stamina + COMBAT.stamina.regenPerSecond * dtMs / 1000);
  }
  if (input.dodge || local.action === COMBAT_ACTION.dodge) {
    moveX = Math.cos(local.facing);
    moveY = Math.sin(local.facing);
    speed = COMBAT.dodge.speed;
  } else if (local.action === 6 || input.block) speed *= COMBAT.block.moveMultiplier;
  else if (local.action === 1) speed *= 0.35;
  else if (local.action === COMBAT_ACTION.heavyAttackWindup) speed *= 0.20;
  else if (local.action === 2 || local.action === COMBAT_ACTION.heavyAttackActive || local.action === 7 || local.action === 8) speed = 0;
  else if (local.action === 3 || local.action === 5) speed *= 0.48;
  else if (local.action === COMBAT_ACTION.heavyAttackRecovery) speed *= 0.35;
  else if (local.action === COMBAT_ACTION.jump) speed *= COMBAT.jump.moveMultiplier;
  else if (local.action === COMBAT_ACTION.jumpAttackWindup) speed *= 0.9;
  else if (local.action === COMBAT_ACTION.jumpAttackActive) speed *= 0.55;
  else if (local.action === COMBAT_ACTION.kickWindup) speed *= 0.45;
  else if (local.action === COMBAT_ACTION.kickActive) speed *= 0.2;
  else if (local.action === COMBAT_ACTION.kickRecovery || local.action === COMBAT_ACTION.jumpAttackRecovery) speed *= 0.42;
  else if (local.action === COMBAT_ACTION.feintRecovery) speed *= COMBAT.feint.moveMultiplier;
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

function render(nowMs = performance.now(), impact = combatImpact.sample(nowMs)) {
  ctx.save();
  ctx.translate(impact.shakeX, impact.shakeY);
  ctx.drawImage(arenaLayer, 0, 0);
  if (!networkClient) {
    ctx.restore();
    drawImpactBurst(impact);
    return;
  }
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
    const damageTell = remoteDamage.visible(entity.netId, nowMs);
    drawFighterWorld(sampled, "#b96350", "#47251f", damageTell, entity.netId);
  }
  if (ownId && local.initialized) drawFighterScreen(canvas.width / 2, canvas.height / 2, local, "#e2d5b4", "#51452d");
  updateHud(ownId);
  drawThreatMarkers();
  ctx.restore();
  drawImpactBurst(impact);
}

function drawImpactBurst(impact) {
  if (!impact?.active || impact.rays <= 0) return;
  const feedback = impact.feedback;
  const remoteOwned = feedback === "hit-confirm"
    || feedback === "block-confirm"
    || feedback === "guard-break-confirm"
    || feedback === "kick-confirm"
    || feedback === "roll-impact"
    || feedback === "dodge-evaded";
  let x = canvas.width / 2;
  let y = canvas.height / 2;
  if (remoteOwned && networkClient?.playerNetId) {
    const focusNetId = fighterFocusNetId(networkClient.state, networkClient.playerNetId);
    const focus = focusNetId ? networkClient.state.get(focusNetId) : null;
    if (focus && local.initialized) {
      x += focus.x - local.x;
      y += focus.y - local.y;
    }
  }

  const radius = 18 + impact.progress * 42;
  const alpha = Math.max(0, (1 - impact.progress) * 0.9);
  const parry = feedback === "parry-success" || feedback === "parried";
  const guard = feedback === "guard-pressure" || feedback === "block-confirm"
    || feedback === "guard-broken" || feedback === "guard-break-confirm";
  const roll = feedback === "roll-impact" || feedback === "rolled-over"
    || feedback === "dodge-success" || feedback === "dodge-evaded";
  const tone = parry ? "174, 209, 147" : guard ? "224, 187, 91" : roll ? "150, 194, 190" : "255, 170, 104";

  ctx.save();
  ctx.strokeStyle = `rgba(${tone}, ${alpha})`;
  ctx.lineWidth = 2.5;
  for (let i = 0; i < impact.rays; i += 1) {
    const angle = (i / impact.rays) * Math.PI * 2 + impact.progress * 0.45;
    const inner = radius * 0.42;
    const outer = radius;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(angle) * inner, y + Math.sin(angle) * inner);
    ctx.lineTo(x + Math.cos(angle) * outer, y + Math.sin(angle) * outer);
    ctx.stroke();
  }
  ctx.fillStyle = `rgba(${tone}, ${impact.flashAlpha})`;
  ctx.beginPath();
  ctx.arc(x, y, Math.max(4, radius * 0.34), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawThreatMarkers() {
  if (!threatCue.netId || !threatCue.bearing) return;
  drawThreatMarker(threatCue.bearing, false);
  if (threatCue.count > 1 && threatCue.secondaryNetId > 0 && threatCue.secondaryBearing) {
    drawThreatMarker(threatCue.secondaryBearing, true);
  }
}

function drawThreatMarker(bearing, secondary) {
  let dx = 0;
  let dy = 0;
  if (bearing === "FROM LEFT") dx = -1;
  else if (bearing === "FROM RIGHT") dx = 1;
  else if (bearing === "FROM ABOVE") dy = -1;
  else if (bearing === "FROM BELOW") dy = 1;
  else return;

  const radius = secondary ? 78 : 62;
  const x = canvas.width / 2 + dx * radius;
  const y = canvas.height / 2 + dy * radius;
  ctx.save();
  ctx.strokeStyle = secondary ? "#f7e1b0" : "#ff8f72";
  ctx.lineWidth = secondary ? 3 : 4;
  ctx.beginPath();
  if (dx < 0) {
    ctx.moveTo(x - 6, y - 7);
    ctx.lineTo(x + 3, y);
    ctx.lineTo(x - 6, y + 7);
  } else if (dx > 0) {
    ctx.moveTo(x + 6, y - 7);
    ctx.lineTo(x - 3, y);
    ctx.lineTo(x + 6, y + 7);
  } else if (dy < 0) {
    ctx.moveTo(x - 7, y - 6);
    ctx.lineTo(x, y + 3);
    ctx.lineTo(x + 7, y - 6);
  } else {
    ctx.moveTo(x - 7, y + 6);
    ctx.lineTo(x, y - 3);
    ctx.lineTo(x + 7, y + 6);
  }
  ctx.stroke();
  ctx.restore();
}

function drawFighterWorld(fighter, body, shadow, damageTell = false, netId = 0) {
  if (!local.initialized) return;
  const screenX = canvas.width / 2 + fighter.x - local.x;
  const screenY = canvas.height / 2 + fighter.y - local.y;
  if (screenX < -64 || screenX > canvas.width + 64 || screenY < -64 || screenY > canvas.height + 64) return;
  drawFighterScreen(screenX, screenY, fighter, body, shadow, true, damageTell);
  drawRemoteVitals(screenX, screenY, fighter);
  drawRemoteIdentity(screenX, screenY, netId);
}

function drawFighterScreen(x, y, fighter, body, shadow, remote = false, damageTell = false) {
  ctx.save();
  const action = fighter.action ?? COMBAT_ACTION.idle;
  const airborne = action === COMBAT_ACTION.jump
    || action === COMBAT_ACTION.jumpAttackWindup
    || action === COMBAT_ACTION.jumpAttackActive
    || action === COMBAT_ACTION.jumpAttackRecovery;
  const lift = airborne ? 18 : 0;
  ctx.translate(x, y - lift);
  ctx.rotate((fighter.facing ?? 0) + (action === COMBAT_ACTION.dodge ? Math.PI * 0.35 : 0));
  ctx.globalAlpha = action === COMBAT_ACTION.dead ? 0.28 : 1;
  if (action === COMBAT_ACTION.attackWindup || action === COMBAT_ACTION.attackActive) drawAttackTell(action, remote);
  if (action === COMBAT_ACTION.heavyAttackWindup || action === COMBAT_ACTION.heavyAttackActive) drawHeavyAttackTell(action, remote);
  if (action === COMBAT_ACTION.jumpAttackWindup || action === COMBAT_ACTION.jumpAttackActive) drawJumpAttackTell(action, remote);
  if (action === COMBAT_ACTION.kickWindup || action === COMBAT_ACTION.kickActive) drawKickTell(action);
  drawWeaponTrail(action);
  if (action === COMBAT_ACTION.block) drawBlockTell(remote, fighter);
  if (action === COMBAT_ACTION.dodge) drawDodgeTell(remote);
  if (action === COMBAT_ACTION.stunned) drawStunTell();
  if (remote && parrySpatialPresentation(fighter).visible) drawParryTell();
  if (remote && guardBreakSpatialPresentation(fighter).visible) drawGuardBreakTell();
  if (remote && opponentRecoveryPresentation(fighter).visible) drawRecoveryTell();
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
  if (remote && action !== COMBAT_ACTION.dead && damageTell) {
    drawDamageTell();
  }
  if (remote && action === COMBAT_ACTION.dead) {
    ctx.globalAlpha = 1;
    drawDeathTell();
  }
  ctx.restore();
}

function drawRemoteVitals(x, y, fighter) {
  const presentation = fighterVitalsPresentation(fighter);
  if (!presentation.visible) return;
  const width = 42;
  const left = Math.round(x - width / 2);
  const hpTop = Math.round(y - 38);
  const guardTop = hpTop + 6;
  ctx.fillStyle = "#231b19";
  ctx.fillRect(left - 1, hpTop - 1, width + 2, 5);
  ctx.fillRect(left - 1, guardTop - 1, width + 2, 5);
  ctx.fillStyle = "#f25f5c";
  ctx.fillRect(left, hpTop, Math.round(width * presentation.hp / 100), 3);
  ctx.fillStyle = "#59c98b";
  ctx.fillRect(left, guardTop, Math.round(width * presentation.guard / 100), 3);
}

function drawRemoteIdentity(x, y, netId) {
  const presentation = fighterIdentityPresentation(netId);
  if (!presentation.visible) return;
  const width = 34;
  const height = 14;
  const left = Math.round(x - width / 2);
  const top = Math.round(y - 58);
  ctx.fillStyle = "#34445c";
  ctx.fillRect(left, top, width, height);
  ctx.fillStyle = "#f7f1de";
  ctx.font = "10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(presentation.label, Math.round(x), top + height / 2 + 0.5);
}

function drawAttackTell(action, remote) {
  const radius = COMBAT.attack.reach + COMBAT.fighterRadius;
  const halfArc = COMBAT.attack.arcRadians / 2;
  const alpha = action === COMBAT_ACTION.attackActive ? 0.34 : 0.14;
  ctx.fillStyle = `rgba(214, 187, 112, ${alpha})`;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, radius, -halfArc, halfArc);
  ctx.closePath();
  ctx.fill();
  if (remote && action === COMBAT_ACTION.attackWindup) {
    ctx.strokeStyle = "#f3d68f";
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 5]);
    ctx.stroke();
  }
}

function drawWeaponTrail(action) {
  const light = action === COMBAT_ACTION.attackWindup || action === COMBAT_ACTION.attackActive;
  const heavy = action === COMBAT_ACTION.heavyAttackWindup || action === COMBAT_ACTION.heavyAttackActive;
  const jump = action === COMBAT_ACTION.jumpAttackWindup || action === COMBAT_ACTION.jumpAttackActive;
  if (!light && !heavy && !jump) return;

  const active = action === COMBAT_ACTION.attackActive
    || action === COMBAT_ACTION.heavyAttackActive
    || action === COMBAT_ACTION.jumpAttackActive;
  const radius = heavy ? 44 : jump ? 40 : 36;
  const start = heavy ? -1.05 : jump ? -0.34 : -0.72;
  const end = heavy ? 0.72 : jump ? 0.30 : 0.48;
  ctx.save();
  ctx.strokeStyle = heavy
    ? (active ? "rgba(255, 105, 58, .88)" : "rgba(255, 173, 92, .42)")
    : jump
      ? (active ? "rgba(255, 150, 72, .9)" : "rgba(255, 195, 102, .42)")
      : (active ? "rgba(238, 219, 160, .82)" : "rgba(214, 195, 148, .34)");
  ctx.lineWidth = heavy ? 8 : jump ? 6 : 5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(0, 0, radius, start, end);
  ctx.stroke();
  ctx.globalAlpha = 0.34;
  ctx.lineWidth *= 1.75;
  ctx.beginPath();
  ctx.arc(0, 0, radius - 4, start + 0.10, end - 0.08);
  ctx.stroke();
  ctx.restore();
}

function drawHeavyAttackTell(action, remote) {
  const active = action === COMBAT_ACTION.heavyAttackActive;
  ctx.save();
  ctx.strokeStyle = active ? "#ff4d2e" : "#ffad5c";
  ctx.fillStyle = active ? "rgba(255, 77, 46, 0.20)" : "rgba(255, 173, 92, 0.13)";
  ctx.lineWidth = remote ? 4 : 3;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(
    0,
    0,
    COMBAT.heavyAttack.reach + COMBAT.fighterRadius,
    -COMBAT.heavyAttack.arcRadians / 2,
    COMBAT.heavyAttack.arcRadians / 2,
  );
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.arc(0, 0, COMBAT.fighterRadius + 8, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawBlockTell(remote, fighter) {
  ctx.strokeStyle = "rgba(241, 218, 142, .72)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, 32, -COMBAT.block.halfAngleRadians, COMBAT.block.halfAngleRadians);
  ctx.stroke();
  if (!remote || !blockSpatialPresentation(fighter).visible) return;
  ctx.strokeStyle = "#9ad7a7";
  ctx.lineWidth = 3;
  ctx.setLineDash([7, 4]);
  ctx.beginPath();
  ctx.arc(0, 0, 42, -COMBAT.block.halfAngleRadians, COMBAT.block.halfAngleRadians);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawJumpAttackTell(action, remote) {
  const active = action === COMBAT_ACTION.jumpAttackActive;
  ctx.save();
  ctx.strokeStyle = active ? "#ff7040" : "#ffc06a";
  ctx.fillStyle = active ? "rgba(255, 112, 64, 0.24)" : "rgba(255, 192, 106, 0.12)";
  ctx.lineWidth = remote ? 4 : 3;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(
    0,
    0,
    COMBAT.jumpAttack.reach + COMBAT.fighterRadius,
    -COMBAT.jumpAttack.arcRadians / 2,
    COMBAT.jumpAttack.arcRadians / 2,
  );
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawKickTell(action) {
  ctx.strokeStyle = action === COMBAT_ACTION.kickActive ? "rgba(255, 214, 120, .95)" : "rgba(255, 214, 120, .48)";
  ctx.lineWidth = action === COMBAT_ACTION.kickActive ? 6 : 3;
  ctx.beginPath();
  ctx.arc(0, 0, COMBAT.kick.reach + COMBAT.fighterRadius, -COMBAT.kick.arcRadians / 2, COMBAT.kick.arcRadians / 2);
  ctx.stroke();
}

function drawDodgeTell(remote) {
  ctx.strokeStyle = "rgba(216, 202, 160, .58)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 28, 0, Math.PI * 2);
  ctx.stroke();
  if (!remote) return;
  ctx.strokeStyle = "#c7b5ff";
  ctx.lineWidth = 3;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.arc(0, 0, 36, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawStunTell() {
  ctx.strokeStyle = "rgba(185, 99, 80, .9)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 25, 0, Math.PI * 2);
  ctx.stroke();
}

function drawParryTell() {
  ctx.strokeStyle = "#7fcff4";
  ctx.lineWidth = 3;
  ctx.setLineDash([3, 4]);
  ctx.beginPath();
  ctx.arc(0, 0, 32, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawGuardBreakTell() {
  ctx.strokeStyle = "#f47f5f";
  ctx.lineWidth = 4;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.arc(0, 0, 32, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawRecoveryTell() {
  ctx.strokeStyle = "#efcf73";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 36, 0, Math.PI * 2);
  ctx.stroke();
}

function drawDamageTell() {
  ctx.strokeStyle = "#ffad66";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, 30, 0, Math.PI * 2);
  ctx.stroke();
  for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
    const inner = 34;
    const outer = 42;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
    ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
    ctx.stroke();
  }
}

function drawDeathTell() {
  ctx.strokeStyle = "#ff6f91";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, 31, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-10, -10);
  ctx.lineTo(10, 10);
  ctx.moveTo(10, -10);
  ctx.lineTo(-10, 10);
  ctx.stroke();
}

function updateHud(ownId) {
  const own = ownId ? networkClient.state.get(ownId) : null;
  const focusNetId = fighterFocusNetId(networkClient.state, ownId);
  const remote = focusNetId ? networkClient.state.get(focusNetId) : null;
  setMeter("playerHp", hud.playerHp, hud.playerHpValue, own?.hp ?? local.hp);
  setMeter("playerGuard", hud.playerGuard, hud.playerGuardValue, own?.guard ?? local.guard);
  setMeter("playerStamina", hud.playerStamina, hud.playerStaminaValue, local.stamina);
  setMeter("botHp", hud.botHp, hud.botHpValue, remote?.hp ?? 0);
  setMeter("botGuard", hud.botGuard, hud.botGuardValue, remote?.guard ?? 0);
  setFocusTarget(focusNetId);
  updateThreatCue(ownId);
  updateCombatOverlay(own, ownId);
  updateOpponentRecovery(remote);
  updateScoreboard(ownId);
  const now = performance.now();
  if (combatMessage && now <= combatMessageUntil) {
    setStatus(combatMessage);
  } else {
    combatMessage = null;
    setStatus(combatActionHint(own) ?? networkStatus);
  }
}

function updateThreatCue(ownId) {
  if (!threatCue.root || !networkClient) return;
  const netId = fighterThreatNetId(networkClient.state, ownId, threatScan);
  const threatCount = threatScan.count;
  const secondaryNetId = threatScan.secondaryNetId;
  const attacker = netId ? networkClient.state.get(netId) : null;
  const secondaryAttacker = secondaryNetId ? networkClient.state.get(secondaryNetId) : null;
  const own = ownId ? networkClient.state.get(ownId) : null;
  const bearing = fighterThreatBearingLabel(own, attacker);
  const guardArc = fighterThreatGuardArcLabel(own, attacker);
  const secondaryBearing = fighterThreatBearingLabel(own, secondaryAttacker);
  const secondaryGuardArc = fighterThreatGuardArcLabel(own, secondaryAttacker);
  const phase = fighterThreatPhaseLabel(attacker);
  const secondaryPhase = fighterThreatPhaseLabel(secondaryAttacker);
  const state = phase === "STRIKE" || phase === "HEAVY STRIKE"
    ? "strike"
    : phase === "WINDUP" || phase === "HEAVY WINDUP"
      ? "windup"
      : "";
  const shouldHide = netId === 0 || !state;
  if (threatCue.root.hidden !== shouldHide) threatCue.root.hidden = shouldHide;
  if (shouldHide) {
    threatCue.netId = 0;
    threatCue.state = "";
    threatCue.count = 0;
    threatCue.secondaryNetId = 0;
    threatCue.secondaryBearing = "";
    threatCue.secondaryPhase = "";
    threatCue.secondaryGuardArc = "";
    threatCue.bearing = "";
    threatCue.guardArc = "";
    if (threatCue.countLabel) threatCue.countLabel.hidden = true;
    if (threatCue.secondaryLabel) threatCue.secondaryLabel.hidden = true;
    if (threatCue.secondaryBearingLabel) threatCue.secondaryBearingLabel.hidden = true;
    if (threatCue.secondaryPhaseLabel) threatCue.secondaryPhaseLabel.hidden = true;
    if (threatCue.secondaryGuardArcLabel) threatCue.secondaryGuardArcLabel.hidden = true;
    if (threatCue.bearingLabel) threatCue.bearingLabel.hidden = true;
    if (threatCue.guardArcLabel) threatCue.guardArcLabel.hidden = true;
    delete threatCue.root.dataset.state;
    return;
  }
  threatCue.root.dataset.state = state;
  if (threatCue.netId !== netId) {
    threatCue.netId = netId;
    threatCue.label.textContent = `#${netId}`;
  }
  if (threatCue.state !== state) {
    threatCue.state = state;
    threatCue.phase.textContent = phase;
  }
  if (threatCue.countLabel) {
    const showCount = threatCount > 1;
    if (threatCue.countLabel.hidden === showCount) threatCue.countLabel.hidden = !showCount;
    if (showCount && threatCue.count !== threatCount) threatCue.countLabel.textContent = `${threatCount} THREATS`;
  }
  if (threatCue.secondaryLabel) {
    const showSecondary = threatCount > 1 && secondaryNetId > 0;
    if (threatCue.secondaryLabel.hidden === showSecondary) threatCue.secondaryLabel.hidden = !showSecondary;
    if (showSecondary && threatCue.secondaryNetId !== secondaryNetId) {
      threatCue.secondaryLabel.textContent = `NEXT #${secondaryNetId}`;
    }
  }
  if (threatCue.secondaryPhaseLabel) {
    const showSecondaryPhase = threatCount > 1 && secondaryNetId > 0 && Boolean(secondaryPhase);
    if (threatCue.secondaryPhaseLabel.hidden === showSecondaryPhase) threatCue.secondaryPhaseLabel.hidden = !showSecondaryPhase;
    if (showSecondaryPhase && threatCue.secondaryPhase !== secondaryPhase) {
      threatCue.secondaryPhaseLabel.textContent = secondaryPhase;
    }
  }
  if (threatCue.secondaryBearingLabel) {
    const showSecondaryBearing = threatCount > 1 && secondaryNetId > 0 && Boolean(secondaryBearing);
    if (threatCue.secondaryBearingLabel.hidden === showSecondaryBearing) threatCue.secondaryBearingLabel.hidden = !showSecondaryBearing;
    if (showSecondaryBearing && threatCue.secondaryBearing !== secondaryBearing) {
      threatCue.secondaryBearingLabel.textContent = secondaryBearing;
    }
  }
  if (threatCue.secondaryGuardArcLabel) {
    const showSecondaryGuardArc = threatCount > 1 && secondaryNetId > 0 && Boolean(secondaryGuardArc);
    if (threatCue.secondaryGuardArcLabel.hidden === showSecondaryGuardArc) threatCue.secondaryGuardArcLabel.hidden = !showSecondaryGuardArc;
    if (showSecondaryGuardArc && threatCue.secondaryGuardArc !== secondaryGuardArc) {
      threatCue.secondaryGuardArcLabel.textContent = secondaryGuardArc;
    }
  }
  if (threatCue.guardArcLabel) {
    const showGuardArc = Boolean(guardArc);
    if (threatCue.guardArcLabel.hidden === showGuardArc) threatCue.guardArcLabel.hidden = !showGuardArc;
    if (showGuardArc && threatCue.guardArc !== guardArc) threatCue.guardArcLabel.textContent = guardArc;
  }
  if (threatCue.bearingLabel) {
    const showBearing = Boolean(bearing);
    if (threatCue.bearingLabel.hidden === showBearing) threatCue.bearingLabel.hidden = !showBearing;
    if (showBearing && threatCue.bearing !== bearing) threatCue.bearingLabel.textContent = bearing;
  }
  threatCue.count = threatCount;
  threatCue.secondaryNetId = secondaryNetId;
  threatCue.secondaryBearing = secondaryBearing;
  threatCue.secondaryPhase = secondaryPhase;
  threatCue.secondaryGuardArc = secondaryGuardArc;
  threatCue.bearing = bearing;
  threatCue.guardArc = guardArc;
}

function updateCombatOverlay(own, ownId) {
  const matchPresentation = networkClient ? fighterMatchPresentation(networkClient.state.values(), ownId) : null;
  const presentation = matchPresentation?.visible ? matchPresentation : combatOverlayPresentation(own);
  const shouldHide = !presentation.visible;
  if (combatOverlay.root.hidden !== shouldHide) combatOverlay.root.hidden = shouldHide;
  if (!presentation.visible) return;
  if (combatOverlay.title.textContent !== presentation.title) combatOverlay.title.textContent = presentation.title;
  if (combatOverlay.detail.textContent !== presentation.detail) combatOverlay.detail.textContent = presentation.detail;
}

function updateOpponentRecovery(remote) {
  const presentation = opponentRecoveryPresentation(remote);
  const shouldHide = !presentation.visible;
  if (opponentRecovery.root.hidden !== shouldHide) opponentRecovery.root.hidden = shouldHide;
  if (!presentation.visible) {
    delete opponentRecovery.root.dataset.state;
    return;
  }
  opponentRecovery.root.dataset.state = presentation.state;
  if (opponentRecovery.label.textContent !== presentation.label) opponentRecovery.label.textContent = presentation.label;
  if (opponentRecovery.detail.textContent !== presentation.detail) opponentRecovery.detail.textContent = presentation.detail;
}

function updateScoreboard(ownId) {
  if (!scoreboardList || !networkClient) return;
  const rows = fighterScoreboardPresentation(networkClient.state.values(), ownId);
  const signature = rows.map((row) => `${row.netId}:${row.kills}:${row.own ? 1 : 0}`).join("|");
  if (hudCache.scoreboard === signature) return;
  hudCache.scoreboard = signature;
  scoreboardList.replaceChildren(...rows.map((row) => {
    const item = document.createElement("li");
    item.dataset.own = String(row.own);
    const label = document.createElement("span");
    label.textContent = row.label;
    const score = document.createElement("b");
    score.textContent = String(row.kills);
    item.append(label, score);
    return item;
  }));
}

function setFocusTarget(netId) {
  if (!hud.focusLabel || hudCache.focusNetId === netId) return;
  hudCache.focusNetId = netId;
  hud.focusLabel.textContent = netId ? `NEAREST #${netId}` : "NO RIVAL";
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
  const impact = combatImpact.sample(now);
  if (impact.freeze) {
    const ownId = networkClient?.playerNetId;
    if (ownId) updateHud(ownId);
  } else {
    render(now, impact);
  }
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

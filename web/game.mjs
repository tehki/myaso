import { createFrameBudget } from "../src/browser/frame-budget.mjs";
import { COMBAT, createFighter, createWorld, stepWorld } from "../src/combat/model.mjs";

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
const hudCache = {
  playerHp: null,
  playerGuard: null,
  botHp: null,
  botGuard: null,
  eventText: null,
};

const player = createFighter({ id: "player", x: 270, y: 270, facing: 0 });
const bot = createFighter({ id: "bot", x: 690, y: 270, facing: Math.PI });
const world = createWorld({ width: canvas.width, height: canvas.height, fighters: [player, bot] });

const keys = new Set();
const mouse = { x: 700, y: 270, block: false };
const playerInputState = { moveX: 0, moveY: 0, aimX: mouse.x, aimY: mouse.y, attack: false, heavyAttack: false, block: false, dodge: false };
const botInputState = { moveX: 0, moveY: 0, aimX: player.x, aimY: player.y, attack: false, heavyAttack: false, block: false, dodge: false };
const inputs = { player: playerInputState, bot: botInputState };
let attackRequested = false;
let heavyAttackRequested = false;
let dodgeRequested = false;
let lastBotAttackAt = -1000;
let botBlockUntil = 0;
let botDodgeUntil = 0;
let messageUntil = 0;
let animationFrameId = 0;
const fixedStepMs = 1000 / 120;
const frameBudget = createFrameBudget({
  stepMs: fixedStepMs,
  maxFrameDeltaMs: 50,
  maxStepsPerFrame: 6,
});
const arenaLayer = createArenaLayer();

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
window.addEventListener("blur", releaseInputs);
canvas.addEventListener("keydown", (event) => {
  if (["KeyW", "KeyA", "KeyS", "KeyD", "KeyE", "Space"].includes(event.code)) event.preventDefault();
  keys.add(event.code);
  if (event.code === "KeyE" && !event.repeat) heavyAttackRequested = true;
  if (event.code === "Space" && !event.repeat) dodgeRequested = true;
});
canvas.addEventListener("keyup", (event) => keys.delete(event.code));
document.addEventListener("visibilitychange", handleVisibilityChange);

function releaseInputs() {
  keys.clear();
  attackRequested = false;
  heavyAttackRequested = false;
  dodgeRequested = false;
  mouse.block = false;
}

function updateMouse(event) {
  const rect = canvas.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * canvas.width;
  mouse.y = ((event.clientY - rect.top) / rect.height) * canvas.height;
}

function playerInput() {
  playerInputState.moveX = (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0);
  playerInputState.moveY = (keys.has("KeyS") ? 1 : 0) - (keys.has("KeyW") ? 1 : 0);
  playerInputState.aimX = mouse.x;
  playerInputState.aimY = mouse.y;
  playerInputState.attack = attackRequested;
  playerInputState.heavyAttack = heavyAttackRequested;
  playerInputState.block = mouse.block;
  playerInputState.dodge = dodgeRequested;
  attackRequested = false;
  heavyAttackRequested = false;
  dodgeRequested = false;
  return playerInputState;
}

function botInput() {
  const dx = player.x - bot.x;
  const dy = player.y - bot.y;
  const distance = Math.hypot(dx, dy) || 1;
  const nx = dx / distance;
  const ny = dy / distance;
  const side = Math.sin(world.nowMs / 650) >= 0 ? 1 : -1;
  botInputState.aimX = player.x;
  botInputState.aimY = player.y;
  botInputState.moveX = 0;
  botInputState.moveY = 0;
  botInputState.attack = false;
  botInputState.heavyAttack = false;
  botInputState.block = false;
  botInputState.dodge = false;

  if ((player.action === "attack_windup" || player.action === "heavy_attack_windup") && distance < 124) {
    const observedWindup = player.actionElapsedMs;
    if (observedWindup > 72 && botBlockUntil < world.nowMs && botDodgeUntil < world.nowMs) {
      const decision = Math.floor(world.nowMs / 900) % 3;
      if (decision === 0) botDodgeUntil = world.nowMs + 80;
      else botBlockUntil = world.nowMs + 210;
    }
  }

  if (botDodgeUntil > world.nowMs) {
    botInputState.dodge = true;
    botInputState.moveX = -ny * side;
    botInputState.moveY = nx * side;
    return botInputState;
  }

  if (botBlockUntil > world.nowMs) {
    botInputState.block = true;
    return botInputState;
  }

  if (distance > 118) {
    botInputState.moveX = nx;
    botInputState.moveY = ny;
  } else if (distance < 64) {
    botInputState.moveX = -nx * 0.7 - ny * side * 0.3;
    botInputState.moveY = -ny * 0.7 + nx * side * 0.3;
  } else {
    botInputState.moveX = -ny * side * 0.55;
    botInputState.moveY = nx * side * 0.55;
  }

  if (distance < 94 && world.nowMs - lastBotAttackAt > 760 && bot.action === "idle") {
    botInputState.attack = true;
    lastBotAttackAt = world.nowMs;
  }
  return botInputState;
}

function handleEvents(events) {
  for (const event of events) {
    const names = { player: "You", bot: "Bot" };
    if (event.type === "hit") say(`${names[event.attackerId]} hit ${names[event.targetId]} for ${event.damage}.`, 560);
    if (event.type === "block") say(`${names[event.targetId]} blocked.`, 480);
    if (event.type === "parry") say(`${names[event.targetId]} PARRIED ${names[event.attackerId]}.`, 720);
    if (event.type === "guard_break") say(`${names[event.targetId]}'s guard broke. Punish!`, 760);
    if (event.type === "evade") say(`${names[event.targetId]} dodged through the strike.`, 520);
    if (event.type === "death") say(`${names[event.killerId]} wins the exchange.`, 980);
    if (event.type === "respawn") say(`${names[event.fighterId]} re-enters the arena.`, 620);
  }
}

function say(text, durationMs) {
  setEventText(text);
  messageUntil = world.nowMs + durationMs;
}

function updateHud() {
  setMeter("playerHp", hud.playerHp, hud.playerHpValue, player.hp);
  setMeter("playerGuard", hud.playerGuard, hud.playerGuardValue, player.guard);
  setMeter("botHp", hud.botHp, hud.botHpValue, bot.hp);
  setMeter("botGuard", hud.botGuard, hud.botGuardValue, bot.guard);
  if (world.nowMs > messageUntil) setEventText(actionHint());
}

function setMeter(cacheKey, bar, label, value) {
  const rounded = Math.max(0, Math.round(value));
  if (hudCache[cacheKey] === rounded) return;
  hudCache[cacheKey] = rounded;
  bar.style.transform = `scaleX(${rounded / 100})`;
  label.textContent = String(rounded);
}

function setEventText(text) {
  if (hudCache.eventText === text) return;
  hudCache.eventText = text;
  eventText.textContent = text;
}

function actionHint() {
  if (player.action === "dead") return "Down. Read the exchange and reset.";
  if (player.action === "attack_windup") return "Committed — your strike is readable now.";
  if (player.action === "heavy_attack_windup") return "Heavy committed — the long tell can be dodged or parried.";
  if (player.action === "attack_recovery") return "Recovery — this is where careless attacks get punished.";
  if (player.action === "heavy_attack_recovery") return "Heavy recovery — you are very punishable now.";
  if (player.action === "block" && player.actionElapsedMs <= COMBAT.block.parryWindowMs) return "Parry window active.";
  if (player.action === "block") return "Blocking — keep your opponent in front of you.";
  if (player.action === "dodge") return "Dodge i-frames — reposition, don't spam.";
  return "Spacing decides the next exchange.";
}

function render() {
  ctx.drawImage(arenaLayer, 0, 0);
  drawFighter(player, "#e2d5b4", "#51452d");
  drawFighter(bot, "#b96350", "#47251f");
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

function drawFighter(fighter, body, shadow) {
  const dead = fighter.action === "dead";
  ctx.save();
  ctx.translate(fighter.x, fighter.y);
  ctx.rotate(fighter.facing);
  ctx.globalAlpha = dead ? 0.28 : 1;

  if (fighter.action === "attack_windup" || fighter.action === "attack_active") drawAttackArc(fighter);
  if (fighter.action === "heavy_attack_windup" || fighter.action === "heavy_attack_active") drawHeavyAttackArc(fighter);
  if (fighter.action === "block") drawBlockArc(fighter);
  if (fighter.action === "dodge" && fighter.actionElapsedMs <= COMBAT.dodge.iframeMs) {
    ctx.strokeStyle = "rgba(216, 202, 160, .5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 27, 0, Math.PI * 2);
    ctx.stroke();
  }

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

function drawAttackArc(fighter) {
  const progress = fighter.action === "attack_windup"
    ? fighter.actionElapsedMs / COMBAT.attack.windupMs
    : 1;
  const alpha = fighter.action === "attack_active" ? 0.34 : 0.08 + progress * 0.11;
  ctx.fillStyle = `rgba(214, 187, 112, ${alpha})`;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, COMBAT.attack.reach + COMBAT.fighterRadius, -COMBAT.attack.arcRadians / 2, COMBAT.attack.arcRadians / 2);
  ctx.closePath();
  ctx.fill();
}

function drawHeavyAttackArc(fighter) {
  const progress = fighter.action === "heavy_attack_windup"
    ? fighter.actionElapsedMs / COMBAT.heavyAttack.windupMs
    : 1;
  const alpha = fighter.action === "heavy_attack_active" ? 0.32 : 0.10 + Math.min(1, progress) * 0.16;
  ctx.fillStyle = `rgba(255, 112, 64, ${alpha})`;
  ctx.strokeStyle = fighter.action === "heavy_attack_active"
    ? "rgba(255, 72, 42, .95)"
    : "rgba(255, 174, 92, .82)";
  ctx.lineWidth = 3;
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
  ctx.setLineDash([]);
}

function drawBlockArc(fighter) {
  const parry = fighter.actionElapsedMs <= COMBAT.block.parryWindowMs;
  ctx.strokeStyle = parry ? "rgba(241, 218, 142, .9)" : "rgba(177, 160, 112, .58)";
  ctx.lineWidth = parry ? 5 : 3;
  ctx.beginPath();
  ctx.arc(0, 0, 32, -COMBAT.block.halfAngleRadians, COMBAT.block.halfAngleRadians);
  ctx.stroke();
}

function simulateStep(stepMs) {
  inputs.player = playerInput();
  inputs.bot = botInput();
  handleEvents(stepWorld(world, inputs, stepMs));
}

function frame(now) {
  if (document.hidden) return;
  frameBudget.advance(now, simulateStep);
  updateHud();
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

updateHud();
render();
frameBudget.reset(performance.now());
animationFrameId = requestAnimationFrame(frame);
